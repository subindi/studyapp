package com.family.sseuro.day;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.day.DayDtos.ChildToday;
import com.family.sseuro.day.DayDtos.DayView;
import com.family.sseuro.day.DayDtos.FreeDto;
import com.family.sseuro.day.DayDtos.HelpDto;
import com.family.sseuro.day.DayDtos.Overview;
import com.family.sseuro.day.DayDtos.Progress;
import com.family.sseuro.day.DayDtos.ReviewDto;
import com.family.sseuro.day.DayDtos.TaskDto;
import com.family.sseuro.family.Child;
import com.family.sseuro.family.ChildRepository;
import com.family.sseuro.family.FamilyDtos;
import com.family.sseuro.routine.Routine;
import com.family.sseuro.routine.RoutineRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 아이의 하루: 반복 생성 · 화면 데이터 · 자유시간 조건.
 * 모든 변경은 openDay() 로 그날 행을 잠근 뒤 한다 (동시 요청 · 재시도에도 생성 · 발급이 한 번만).
 * 트랜잭션은 부르는 쪽(DayActions · RoutineService)이 연다. 이 클래스는 프록시 없이 필드를 직접 쓴다.
 */
@Service
public class DayService {
    final TaskRepository tasks;
    final DayRecordRepository days;
    final FreePassRepository passes;
    final HelpRequestRepository helps;
    final ReviewRepository reviews;
    final ChildRepository children;
    final RoutineRepository routines;
    final TimeService time;

    public DayService(TaskRepository tasks, DayRecordRepository days, FreePassRepository passes, HelpRequestRepository helps,
                      ReviewRepository reviews, ChildRepository children, RoutineRepository routines, TimeService time) {
        this.tasks = tasks;
        this.days = days;
        this.passes = passes;
        this.helps = helps;
        this.reviews = reviews;
        this.children = children;
        this.routines = routines;
        this.time = time;
    }

    /** 가족 격리: 로그인한 부모의 가족 아이만 (다른 가족 아이 번호면 없는 것과 같게 404) */
    public Child child(AuthUser me, long childId) {
        return children.findByIdAndFamilyId(childId, me.familyId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CHILD_NOT_FOUND", "아이 정보를 찾을 수 없어요"));
    }

    // ---------------------------------------------------------------- 하루 열기 (잠금 · 마감 · 반복 생성)

    /** 그날 행을 만들고(없으면) 잠근 뒤, 지난 날 타이머를 마감하고 반복 할 일을 한 번만 만든다 */
    DayRecord openDay(Child child, LocalDate day) {
        long childId = child.getId();
        // 없으면 만든다. 동시에 두 요청이 와도 INSERT IGNORE 라 하나만 생기고, 이어지는 잠금 조회로 줄을 선다
        if (!days.existsByChildIdAndDay(childId, day)) days.insertIgnore(childId, day);
        DayRecord rec = days.lock(childId, day).orElseThrow();
        closePastDays(childId, day);
        if (!rec.isGenerated()) {
            generate(child, day);
            rec.markGenerated();
        }
        return rec;
    }

    /** 하루 마감(가족 시간대 자정): 지난 날에 켜진 타이머는 마감 시각까지만 세고 멈춘다. 남은 자유시간은 넘기지 않는다 */
    private void closePastDays(long childId, LocalDate today) {
        Instant now = time.now();
        for (Task t : tasks.findByChildIdAndDayBeforeAndRunningSinceIsNotNull(childId, today)) {
            t.stop(time.secondsSince(t.getRunningSince(), t.getDay()), now);
            t.setStatus(Task.PAUSED, now);
        }
        for (FreePass p : passes.findByChildIdAndDayBeforeAndStatusNot(childId, today, FreePass.USED)) {
            p.settle(p.getRunningSince() == null ? 0 : time.secondsSince(p.getRunningSince(), p.getDay()), now, true);
        }
    }

    private void generate(Child child, LocalDate day) {
        int bit = TimeService.dayBit(day);
        int order = tasks.maxOrder(child.getId(), day);
        for (Routine r : routines.findByChildIdAndActiveTrueOrderBySortOrderAscIdAsc(child.getId())) {
            if ((r.getDaysMask() & bit) == 0) continue;
            if (tasks.existsByChildIdAndDayAndRoutineId(child.getId(), day, r.getId())) continue;
            tasks.save(Task.fromRoutine(r, day, ++order, time.now()));
        }
        tasks.flush();
    }

    /** 오늘 할 일을 지금 값으로 먼저 만들어 둔다 ('오늘에도 추가'를 고르지 않은 새 반복이 오늘 생성에 끼지 않게) */
    public void ensureToday(Child child) {
        openDay(child, time.today());
    }

    /** 반복 원본을 오늘에도 추가 ('오늘에도 추가' 선택 시, 요일과 상관없이) */
    public void addRoutineToday(Child child, Routine r) {
        LocalDate today = time.today();
        DayRecord rec = openDay(child, today);
        if (!tasks.existsByChildIdAndDayAndRoutineId(child.getId(), today, r.getId())) {
            tasks.saveAndFlush(Task.fromRoutine(r, today, tasks.maxOrder(child.getId(), today) + 1, time.now()));
        }
        recheckApproval(child, rec);
    }

    // ---------------------------------------------------------------- 자유시간 조건

    record Condition(int done, int total, int optionalDone) {
        boolean allRequiredDone() {
            return total > 0 && done == total;
        }

        /** 부모가 오늘을 확인(승인)할 수 있는 상태: 필수를 다 했거나, 유효한 필수가 0개인 날 */
        boolean approvable() {
            return allRequiredDone() || total == 0;
        }
    }

    static Condition condition(List<Task> list) {
        int done = 0, total = 0, optional = 0;
        for (Task t : list) {
            if (t.isExcused()) continue; // 면제 · 이동은 조건에서 빠지고 완료로도 세지 않는다
            if (t.isRequired()) {
                total++;
                if (Task.DONE.equals(t.getStatus())) done++;
            } else if (Task.DONE.equals(t.getStatus())) {
                optional++;
            }
        }
        return new Condition(done, total, optional);
    }

    /**
     * 이용권을 받을 수 있는지.
     * - 필수가 0개인 날(모두 면제 · 이동 포함)은 자동으로 열지 않고 부모 확인이 있어야 한다.
     * - 부모 확인을 쓰는 아이는 필수를 다 하고 부모가 확인해야 한다.
     */
    static boolean canIssue(Child child, Condition c, DayRecord rec) {
        if (c.total() == 0) return rec.isApproved();
        if (!c.allRequiredDone()) return false;
        return !child.isApprovalRequired() || rec.isApproved();
    }

    /** 이용권 발급 전에 조건이 바뀌면(완료 되돌리기 · 필수 추가 등) 부모 확인을 다시 받는다 */
    void recheckApproval(Child child, DayRecord rec) {
        if (!rec.isApproved() || passes.findByChildIdAndDay(child.getId(), rec.getDay()).isPresent()) return;
        if (!condition(tasks.findByChildIdAndDayOrderBySortOrderAscIdAsc(child.getId(), rec.getDay())).approvable()) {
            rec.clearApproval();
        }
    }

    int freeMinutesFor(Child child, LocalDate day) {
        return TimeService.isWeekend(day) ? child.getWeekendFreeMin() : child.getWeekdayFreeMin();
    }

    // ---------------------------------------------------------------- 화면 데이터

    DayView view(Child child, DayRecord rec) {
        LocalDate day = rec.getDay();
        List<Task> list = tasks.findByChildIdAndDayOrderBySortOrderAscIdAsc(child.getId(), day);
        List<HelpRequest> open = helps.findByChildIdAndStatusOrderByIdAsc(child.getId(), HelpRequest.OPEN);
        Map<Long, Task> byId = new HashMap<>();
        list.forEach(t -> byId.put(t.getId(), t));
        Set<Long> helpTasks = open.stream().map(HelpRequest::getTaskId).collect(Collectors.toSet());
        List<TaskDto> taskDtos = list.stream().map(t -> taskDto(t, helpTasks.contains(t.getId()))).toList();
        Condition c = condition(list);
        Review review = reviews.findById(new Review.Key(child.getId(), day)).orElse(null);
        return new DayView(childDto(child), day.toString(), time.now().toEpochMilli(), rec.isPlanned(), taskDtos,
                new Progress(c.done(), c.total()), free(child, rec, c),
                review == null ? null : new ReviewDto(review.getMood(), review.getNote()),
                open.stream().map(h -> helpDto(h, byId.get(h.getTaskId()))).toList());
    }

    FreeDto free(Child child, DayRecord rec, Condition c) {
        FreePass pass = passes.findByChildIdAndDay(child.getId(), rec.getDay()).orElse(null);
        boolean requested = rec.getFreeRequestAt() != null;
        if (pass != null) {
            settle(pass);
            return new FreeDto(pass.getStatus(), pass.getMinutes(), pass.getRemainingSec(), pass.getRunningSince() != null,
                    pass.getActivity(), child.isApprovalRequired(), rec.isApproved(), requested);
        }
        String state;
        if (canIssue(child, c, rec)) state = "available";
        else if (c.total() == 0) state = "rest";
        else if (c.allRequiredDone()) state = "waiting";
        else state = "locked";
        int minutes = freeMinutesFor(child, rec.getDay());
        return new FreeDto(state, minutes, minutes * 60, false, null, child.isApprovalRequired(), rec.isApproved(), requested);
    }

    /** 진행 중인 이용권의 남은 시간을 서버 시계로 다시 계산 */
    void settle(FreePass pass) {
        boolean dayOver = !time.now().isBefore(time.dayEnd(pass.getDay()));
        int secs = pass.getRunningSince() == null ? 0 : time.secondsSince(pass.getRunningSince(), pass.getDay());
        pass.settle(secs, time.now(), dayOver);
    }

    TaskDto taskDto(Task t, boolean helpOpen) {
        int elapsed = t.getElapsedSec() + (t.isRunning() ? time.secondsSince(t.getRunningSince(), t.getDay()) : 0);
        return new TaskDto(t.getId(), t.getIcon(), t.getTitle(), t.getAmount(), t.getEstimateMin(), t.isRequired(),
                t.getStatus(), t.getDoneBy(), elapsed, t.isRunning(), t.getMovedTo() == null ? null : t.getMovedTo().toString(),
                t.getAdjustReason(), t.getRoutineId() != null, t.getOriginTaskId() != null, helpOpen);
    }

    static HelpDto helpDto(HelpRequest h, Task t) {
        return new HelpDto(h.getId(), h.getChildId(), h.getTaskId(), t == null ? "" : t.getTitle(), h.getReason(),
                h.getCreatedAt().toEpochMilli());
    }

    static FamilyDtos.ChildDto childDto(Child c) {
        return new FamilyDtos.ChildDto(c.getId(), c.getName(), c.getAge(), c.getLevel(), c.getUiStyle(),
                c.getWeekdayFreeMin(), c.getWeekendFreeMin(), c.isApprovalRequired());
    }
}
