package com.family.sseuro.day;

import com.family.sseuro.family.FamilyDtos.ChildDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class DayDtos {
    private DayDtos() {}

    /**
     * elapsedSec 는 serverNow 시점의 누적 시간. running 이면 화면은 그 뒤로 1초씩 더해 보여 주기만 하고,
     * 실제 시간은 항상 서버가 다시 계산한다 (새로고침 · 다른 기기에서도 중복 증가 없음).
     */
    public record TaskDto(long id, String icon, String title, String amount, int estimateMin, boolean required,
                          String status, String doneBy, int elapsedSec, boolean running, String movedTo,
                          String adjustReason, boolean fromRoutine, boolean movedIn, boolean helpOpen) {}

    /** 필수 할 일 진행 (면제 · 이동은 total 에서 빠지고 done 에도 들어가지 않는다) */
    public record Progress(int done, int total) {}

    /**
     * 자유시간 상태.
     * locked(필수 남음) · waiting(부모 확인 대기) · rest(오늘 필수 0개 → 부모가 정함) · available(받을 수 있음)
     * · ready / running / paused / used (이용권 발급 뒤)
     */
    public record FreeDto(String state, int minutes, int remainingSec, boolean running, String activity,
                          boolean approvalRequired, boolean approved, boolean requested) {}

    public record HelpDto(long id, long childId, long taskId, String taskTitle, String reason, long createdAt) {}

    public record ReviewDto(String mood, String note) {}

    public record DayView(ChildDto child, String day, long serverNow, boolean planned, List<TaskDto> tasks,
                          Progress progress, FreeDto free, ReviewDto review, List<HelpDto> help) {}

    /** 부모 오늘 화면: 아이별 요약 */
    public record ChildToday(ChildDto child, Progress progress, FreeDto free, List<HelpDto> help, boolean planned) {}

    public record Overview(String today, long serverNow, List<ChildToday> children) {}

    public record EstimateItem(@NotNull Long taskId, @NotNull @Min(1) @Max(180) Integer minutes) {}

    /** 아이의 계획: 할 일 순서 (+ Lv.3 이상은 예상시간) */
    public record PlanRequest(@NotNull @Size(max = 50) List<Long> order, @Size(max = 50) List<@Valid EstimateItem> estimates) {}

    public record HelpRequestBody(@NotBlank @Size(max = 40) String reason) {}

    public record ReviewRequest(@NotNull @Pattern(regexp = "good|different|hard") String mood, @Size(max = 200) String note) {}

    public record FreeStartRequest(@Size(max = 20) String activity) {}

    /** 부모의 오늘만 조정. action: amount | waive | move | recognize | restore */
    public record AdjustRequest(@NotNull @Pattern(regexp = "amount|waive|move|recognize|restore") String action,
                                @Size(max = 60) String amount, @Size(max = 60) String reason) {}

    /** 리포트 하루 (기록이 없는 날은 recorded=false. 예시 숫자를 채우지 않는다) */
    public record DaySummary(String day, boolean recorded, int requiredDone, int requiredTotal, int optionalDone,
                             int excused, int studySec, boolean planned, boolean approved, int freeMinutes, String mood, String note) {}

    public record Report(ChildDto child, String from, String to, List<DaySummary> days) {}
}
