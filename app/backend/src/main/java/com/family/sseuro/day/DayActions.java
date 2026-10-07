package com.family.sseuro.day;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.day.DayDtos.AdjustRequest;
import com.family.sseuro.day.DayDtos.DayView;
import com.family.sseuro.day.DayDtos.ChildToday;
import com.family.sseuro.day.DayDtos.EstimateItem;
import com.family.sseuro.day.DayDtos.Overview;
import com.family.sseuro.day.DayDtos.PlanRequest;
import com.family.sseuro.family.Child;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 오늘의 할 일 · 자유시간 · 회고 변경. 아이 화면과 부모 화면이 같은 규칙을 쓴다.
 * 모든 동작은 같은 요청이 다시 와도(재시도 · 중복 클릭) 결과가 같게 만든다.
 */
@Service
public class DayActions {
    private final DayService d;
    private final TimeService time;

    public DayActions(DayService d, TimeService time) {
        this.d = d;
        this.time = time;
    }

    /** 오늘 열고 → 동작 → 승인 유효성 재확인 → 오늘 화면 */
    private interface Action {
        void run(Child child, DayRecord rec, List<Task> today);
    }

    private DayView act(AuthUser me, long childId, Action action) {
        Child child = d.child(me, childId);
        DayRecord rec = d.openDay(child, time.today());
        action.run(child, rec, d.tasks.findByChildIdAndDayOrderBySortOrderAscIdAsc(child.getId(), rec.getDay()));
        d.tasks.flush();
        d.recheckApproval(child, rec);
        return d.view(child, rec);
    }

    private static Task find(List<Task> today, long taskId) {
        return today.stream().filter(t -> t.getId() == taskId).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "오늘 할 일에서 찾을 수 없어요"));
    }

    private void stop(Task t) {
        if (t.isRunning()) t.stop(time.secondsSince(t.getRunningSince(), t.getDay()), time.now());
    }

    // ---------------------------------------------------------------- 아이

    /** 오늘 화면 (열면서 반복 생성 · 지난 날 마감도 처리하므로 쓰기 트랜잭션) */
    @Transactional
    public DayView today(AuthUser me, long childId) {
        Child child = d.child(me, childId);
        DayRecord rec = d.openDay(child, time.today());
        return d.view(child, rec);
    }


    /** 부모 오늘 화면: 아이별 진행 · 확인 대기 · 도움 요청 */
    @Transactional
    public Overview overview(AuthUser me) {
        LocalDate today = time.today();
        List<ChildToday> list = d.children.findByFamilyIdOrderBySortOrderAscIdAsc(me.familyId()).stream().map(child -> {
            DayView v = d.view(child, d.openDay(child, today));
            return new ChildToday(v.child(), v.progress(), v.free(), v.help(), v.planned());
        }).toList();
        return new Overview(today.toString(), time.now().toEpochMilli(), list);
    }


    /** 계획: 아직 끝나지 않은 할 일의 순서 (Lv.2 이상), 예상시간 (Lv.3 이상) */
    @Transactional
    public DayView plan(AuthUser me, long childId, PlanRequest body) {
        return act(me, childId, (child, rec, today) -> {
            if (child.getLevel() < 2) throw new ApiException(HttpStatus.FORBIDDEN, "LEVEL", "순서는 부모님과 함께 정해요");
            List<EstimateItem> estimates = body.estimates() == null ? List.of() : body.estimates();
            if (!estimates.isEmpty() && child.getLevel() < 3) {
                throw new ApiException(HttpStatus.FORBIDDEN, "LEVEL", "예상시간은 Lv.3부터 직접 정해요");
            }
            Set<Long> seen = new HashSet<>();
            List<Task> ordered = new ArrayList<>();
            for (Long id : body.order()) {
                if (id != null && seen.add(id)) ordered.add(find(today, id));
            }
            for (Task t : today) if (!seen.contains(t.getId())) ordered.add(t); // 목록에 없던 할 일은 뒤에 그대로
            for (int i = 0; i < ordered.size(); i++) ordered.get(i).setOrder(i + 1);
            for (EstimateItem e : estimates) {
                Task t = find(today, e.taskId());
                if (!t.isClosed()) t.setEstimate(e.minutes(), time.now());
            }
            rec.markPlanned();
        });
    }

    /** 시작 · 재개. 한 번에 한 과제: 다른 진행 중인 과제는 쉬는 중으로 */
    @Transactional
    public DayView start(AuthUser me, long childId, long taskId) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            if (t.isClosed()) throw closed();
            if (t.isRunning()) return; // 이미 진행 중 (재시도)
            for (Task other : today) {
                if (other.isRunning()) {
                    stop(other);
                    other.setStatus(Task.PAUSED, time.now());
                }
            }
            t.start(time.now());
        });
    }

    @Transactional
    public DayView pause(AuthUser me, long childId, long taskId) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            if (!t.isRunning()) return;
            stop(t);
            t.setStatus(Task.PAUSED, time.now());
        });
    }

    /** 아이 자기확인 완료. 예상시간을 넘겨도 실패가 아니다 */
    @Transactional
    public DayView complete(AuthUser me, long childId, long taskId) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            if (Task.DONE.equals(t.getStatus())) return;
            if (t.isExcused()) throw closed();
            stop(t);
            t.markDone("child", time.now());
        });
    }

    /** 잘못 누른 완료 되돌리기 (아이가 완료한 것만). 이미 발급된 이용권은 회수하지 않는다 */
    @Transactional
    public DayView undo(AuthUser me, long childId, long taskId) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            if (!Task.DONE.equals(t.getStatus())) return;
            if (!"child".equals(t.getDoneBy())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "PARENT_DONE", "부모님이 완료로 인정한 할 일이에요");
            }
            t.reopen(time.now());
        });
    }

    /** 도움 요청: 타이머는 잠깐 멈추고, 같은 할 일의 열린 요청은 하나만 */
    @Transactional
    public DayView help(AuthUser me, long childId, long taskId, String reason) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            if (t.isClosed()) throw closed();
            if (t.isRunning()) {
                stop(t);
                t.setStatus(Task.PAUSED, time.now());
            }
            if (d.helps.findFirstByTaskIdAndStatus(taskId, HelpRequest.OPEN).isEmpty()) {
                d.helps.save(new HelpRequest(child.getId(), taskId, reason.strip(), time.now()));
            }
        });
    }

    /** 아이가 도움 요청을 거두기 ('괜찮아요, 혼자 해볼게요'). 이미 닫힌 요청이면 그대로 (재시도 안전) */
    @Transactional
    public DayView cancelHelp(AuthUser me, long childId, long taskId) {
        return act(me, childId, (child, rec, today) -> {
            find(today, taskId);
            d.helps.findFirstByTaskIdAndStatus(taskId, HelpRequest.OPEN).ifPresent(h -> h.cancel(time.now()));
        });
    }

    /** 자유시간 이용권 받기: 아이+오늘에 하나만. 이미 있으면 그대로 돌려준다 */
    @Transactional
    public DayView issuePass(AuthUser me, long childId) {
        return act(me, childId, (child, rec, today) -> {
            if (d.passes.findByChildIdAndDay(child.getId(), rec.getDay()).isPresent()) return;
            if (!DayService.canIssue(child, DayService.condition(today), rec)) {
                throw new ApiException(HttpStatus.CONFLICT, "FREE_LOCKED", "아직 자유시간을 받을 수 없어요");
            }
            d.passes.saveAndFlush(new FreePass(child.getId(), rec.getDay(), d.freeMinutesFor(child, rec.getDay()), time.now()));
        });
    }

    @Transactional
    public DayView startPass(AuthUser me, long childId, String activity) {
        return act(me, childId, (child, rec, today) -> {
            FreePass p = pass(child, rec);
            d.settle(p);
            if (activity != null && !activity.isBlank()) p.chooseActivity(activity.strip());
            if (FreePass.USED.equals(p.getStatus()) || FreePass.RUNNING.equals(p.getStatus())) return;
            p.start(time.now());
        });
    }

    @Transactional
    public DayView pausePass(AuthUser me, long childId) {
        return act(me, childId, (child, rec, today) -> {
            FreePass p = pass(child, rec);
            d.settle(p);
            if (FreePass.RUNNING.equals(p.getStatus())) p.pause();
        });
    }

    private FreePass pass(Child child, DayRecord rec) {
        return d.passes.findByChildIdAndDay(child.getId(), rec.getDay())
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NO_PASS", "먼저 자유시간을 받아 주세요"));
    }

    /** 필수 할 일이 없는 날: 부모님께 자유시간 요청 (자동으로 열리지 않음) */
    @Transactional
    public DayView requestFree(AuthUser me, long childId) {
        return act(me, childId, (child, rec, today) -> rec.requestFree(time.now()));
    }

    @Transactional
    public DayView review(AuthUser me, long childId, String mood, String note) {
        return act(me, childId, (child, rec, today) -> {
            Review r = d.reviews.findById(new Review.Key(child.getId(), rec.getDay())).orElseGet(() -> new Review(child.getId(), rec.getDay()));
            String cleanNote = note == null ? null : note.replaceAll("\\p{Cntrl}", " ").strip();
            r.update(mood, cleanNote == null || cleanNote.isEmpty() ? null : cleanNote, time.now());
            d.reviews.save(r);
        });
    }

    // ---------------------------------------------------------------- 부모 (/api/parent/**, 부모 모드에서만)

    /** 오늘만 조정: 반복 원본은 바꾸지 않는다. 면제 · 이동은 완료로 세지 않는다 */
    @Transactional
    public DayView adjust(AuthUser me, long childId, long taskId, AdjustRequest body) {
        return act(me, childId, (child, rec, today) -> {
            Task t = find(today, taskId);
            Instant now = time.now();
            String reason = body.reason() == null || body.reason().isBlank() ? null : body.reason().strip();
            switch (body.action()) {
                case "amount" -> {
                    String amount = body.amount() == null ? "" : body.amount().strip();
                    if (amount.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "오늘 분량을 입력해 주세요");
                    t.changeAmount(amount, now);
                }
                case "waive" -> {
                    if (Task.MOVED.equals(t.getStatus())) throw new ApiException(HttpStatus.CONFLICT, "MOVED", "먼저 이동을 되돌려 주세요");
                    if (Task.DONE.equals(t.getStatus())) throw doneFirst();
                    stop(t);
                    t.setStatus(Task.WAIVED, now);
                }
                case "move" -> {
                    if (Task.MOVED.equals(t.getStatus())) return;
                    if (Task.DONE.equals(t.getStatus())) throw doneFirst();
                    stop(t);
                    LocalDate target = rec.getDay().plusDays(1);
                    t.moveTo(target, now);
                    if (d.tasks.findByOriginTaskId(t.getId()).isEmpty()) {
                        d.tasks.save(t.copyTo(target, 1000 + t.getSortOrder(), now));
                    }
                }
                case "recognize" -> {
                    if (Task.MOVED.equals(t.getStatus())) throw new ApiException(HttpStatus.CONFLICT, "MOVED", "먼저 이동을 되돌려 주세요");
                    if (Task.DONE.equals(t.getStatus())) return;
                    stop(t);
                    t.markDone("parent", now);
                }
                case "restore" -> {
                    if (Task.MOVED.equals(t.getStatus())) {
                        d.tasks.findByOriginTaskId(t.getId()).ifPresent(copy -> {
                            if (!Task.READY.equals(copy.getStatus()) || copy.getElapsedSec() > 0 || copy.isRunning()) {
                                throw new ApiException(HttpStatus.CONFLICT, "MOVED_STARTED", "옮긴 날에 이미 시작한 할 일이에요");
                            }
                            d.tasks.delete(copy);
                        });
                    }
                    if (Task.READY.equals(t.getStatus()) || Task.PAUSED.equals(t.getStatus()) || Task.ACTIVE.equals(t.getStatus())) return;
                    t.reopen(now);
                }
                default -> throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "입력값을 확인해 주세요");
            }
            if (!"amount".equals(body.action())) t.setAdjustReason(reason);
        });
    }

    /** 부모의 하루 확인. 필수를 다 했거나 오늘 필수가 0개일 때만 (완료 클릭만으로는 열리지 않음) */
    @Transactional
    public DayView approve(AuthUser me, long childId) {
        return act(me, childId, (child, rec, today) -> {
            if (rec.isApproved()) return;
            if (!DayService.condition(today).approvable()) {
                throw new ApiException(HttpStatus.CONFLICT, "NOT_READY", "남은 필수 할 일이 있어요");
            }
            rec.approve(me.id(), time.now());
        });
    }

    /** 도움 요청 처리 (가족 안의 요청만) */
    @Transactional
    public DayView resolveHelp(AuthUser me, long childId, long helpId) {
        return act(me, childId, (child, rec, today) -> {
            HelpRequest h = d.helps.findById(helpId).filter(x -> x.getChildId().equals(child.getId()))
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HELP_NOT_FOUND", "도움 요청을 찾을 수 없어요"));
            if (HelpRequest.OPEN.equals(h.getStatus())) h.resolve(time.now());
        });
    }

    private static ApiException doneFirst() {
        return new ApiException(HttpStatus.CONFLICT, "DONE", "완료한 할 일이에요. 먼저 다시 할 일로 되돌려 주세요");
    }

    private static ApiException closed() {
        return new ApiException(HttpStatus.CONFLICT, "TASK_CLOSED", "오늘은 하지 않아도 되는 할 일이에요");
    }
}
