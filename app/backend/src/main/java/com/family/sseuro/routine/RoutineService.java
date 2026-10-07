package com.family.sseuro.routine;

import com.family.sseuro.auth.AuthService;
import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.day.DayService;
import com.family.sseuro.family.Child;
import com.family.sseuro.routine.RoutineDtos.RoutineDto;
import com.family.sseuro.routine.RoutineDtos.RoutineRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 반복 원본 관리 (부모 모드). 원본을 고치면 다음 생성일부터 적용되고, 이미 만들어진 날짜별 할 일은 그대로다.
 */
@Service
public class RoutineService {
    private static final int MAX_ROUTINES = 30;
    private final RoutineRepository routines;
    private final DayService days;
    private final TimeService time;

    public RoutineService(RoutineRepository routines, DayService days, TimeService time) {
        this.routines = routines;
        this.days = days;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public List<RoutineDto> list(AuthUser me, long childId) {
        Child child = days.child(me, childId);
        return routines.findByChildIdAndActiveTrueOrderBySortOrderAscIdAsc(child.getId()).stream().map(RoutineDto::of).toList();
    }

    @Transactional
    public RoutineDto create(AuthUser me, long childId, String requestId, RoutineRequest body, boolean addToday) {
        return create(days.child(me, childId), requestId, body, addToday);
    }

    /** 같은 requestId 면 이미 만든 원본을 돌려준다 (저장 재시도 · 중복 클릭으로 두 번 생기지 않게) */
    @Transactional
    public RoutineDto create(Child child, String requestId, RoutineRequest body, boolean addToday) {
        var existing = routines.findByChildIdAndRequestId(child.getId(), requestId);
        if (existing.isPresent()) return RoutineDto.of(existing.get());
        long count = routines.countByChildId(child.getId());
        if (count >= MAX_ROUTINES * 3L) throw new ApiException(HttpStatus.CONFLICT, "TOO_MANY_ROUTINES", "반복 할 일이 너무 많아요");
        if (!addToday) days.ensureToday(child); // 새 반복은 다음 생성일부터
        Routine r = new Routine(child.getId(), requestId, (int) count + 1, time.now());
        apply(r, body);
        routines.saveAndFlush(r);
        if (addToday) days.addRoutineToday(child, r);
        return RoutineDto.of(r);
    }

    @Transactional
    public RoutineDto update(AuthUser me, long childId, long routineId, RoutineRequest body) {
        Routine r = find(me, childId, routineId);
        apply(r, body);
        return RoutineDto.of(r);
    }

    /** 반복 끝내기: 다음 생성일부터 만들지 않는다 (오늘 이미 만든 할 일과 지난 기록은 남는다) */
    @Transactional
    public void deactivate(AuthUser me, long childId, long routineId) {
        find(me, childId, routineId).deactivate(time.now());
    }

    private Routine find(AuthUser me, long childId, long routineId) {
        Child child = days.child(me, childId);
        Routine r = routines.findByIdAndChildId(routineId, child.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROUTINE_NOT_FOUND", "반복 할 일을 찾을 수 없어요"));
        if (!r.isActive()) throw new ApiException(HttpStatus.NOT_FOUND, "ROUTINE_NOT_FOUND", "반복 할 일을 찾을 수 없어요");
        return r;
    }

    private void apply(Routine r, RoutineRequest b) {
        r.update(AuthService.clean(b.icon(), 16, "아이콘"), AuthService.clean(b.title(), 60, "할 일 이름"),
                AuthService.clean(b.amount(), 60, "분량"), b.estimateMin(), b.required(), b.daysMask(), time.now());
    }
}
