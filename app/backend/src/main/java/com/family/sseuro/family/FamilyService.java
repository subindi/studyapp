package com.family.sseuro.family;

import com.family.sseuro.auth.AuthService;
import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.auth.FamilyRepository;
import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.family.FamilyDtos.ChildDto;
import com.family.sseuro.family.FamilyDtos.ChildSettings;
import com.family.sseuro.family.FamilyDtos.FamilyView;
import com.family.sseuro.family.FamilyDtos.NewChildRequest;
import com.family.sseuro.routine.RoutineService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가족 · 아이 프로필 (아이 등록과 설정 변경은 부모 모드에서만) */
@Service
public class FamilyService {
    private static final int MAX_CHILDREN = 8;
    private final FamilyRepository families;
    private final ChildRepository children;
    private final RoutineService routines;
    private final TimeService time;

    public FamilyService(FamilyRepository families, ChildRepository children, RoutineService routines, TimeService time) {
        this.families = families;
        this.children = children;
        this.routines = routines;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public FamilyView view(AuthUser me) {
        var family = families.findById(me.familyId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요해요"));
        return new FamilyView(family.getName(), time.today().toString(),
                children.findByFamilyIdOrderBySortOrderAscIdAsc(me.familyId()).stream().map(ChildDto::of).toList());
    }

    /** 아이 등록 + 첫 반복 할 일. 같은 requestId 로 다시 오면(재시도 · 중복 클릭) 이미 만든 아이를 돌려준다 */
    @Transactional
    public ChildDto create(AuthUser me, NewChildRequest body) {
        var existing = children.findByFamilyIdAndRequestId(me.familyId(), body.requestId());
        if (existing.isPresent()) return ChildDto.of(existing.get());
        long count = children.countByFamilyId(me.familyId());
        if (count >= MAX_CHILDREN) throw new ApiException(HttpStatus.CONFLICT, "TOO_MANY_CHILDREN", "아이는 " + MAX_CHILDREN + "명까지 등록할 수 있어요");
        Child child = new Child(me.familyId(), body.requestId(), (int) count + 1, time.now());
        apply(child, body.settings());
        children.saveAndFlush(child);
        if (body.routines() != null) {
            int i = 0;
            for (var r : body.routines()) {
                routines.create(child, body.requestId() + ":" + (i++), r, body.addToday());
            }
        }
        return ChildDto.of(child);
    }

    /** 아이 설정. 이미 발급된 오늘 이용권에는 바뀐 자유시간이 소급되지 않는다 (이용권이 발급 시 값을 갖고 있음) */
    @Transactional
    public ChildDto update(AuthUser me, long childId, ChildSettings s) {
        Child child = children.findByIdAndFamilyId(childId, me.familyId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CHILD_NOT_FOUND", "아이 정보를 찾을 수 없어요"));
        apply(child, s);
        return ChildDto.of(child);
    }

    @Transactional
    public FamilyView rename(AuthUser me, String name) {
        families.findById(me.familyId()).ifPresent(f -> f.rename(AuthService.clean(name, 30, "가족 이름")));
        return view(me);
    }

    private static void apply(Child child, ChildSettings s) {
        child.update(AuthService.clean(s.name(), 20, "아이 이름"), s.age(), s.level(), s.uiStyle(),
                s.weekdayFreeMin(), s.weekendFreeMin(), s.approvalRequired());
    }
}
