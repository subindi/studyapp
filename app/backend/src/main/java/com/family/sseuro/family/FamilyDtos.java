package com.family.sseuro.family;

import com.family.sseuro.routine.RoutineDtos.RoutineRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class FamilyDtos {
    private FamilyDtos() {}

    public record ChildDto(long id, String name, int age, int level, String uiStyle,
                           int weekdayFreeMin, int weekendFreeMin, boolean approvalRequired, String theme) {
        public static ChildDto of(Child c) {
            return new ChildDto(c.getId(), c.getName(), c.getAge(), c.getLevel(), c.getUiStyle(),
                    c.getWeekdayFreeMin(), c.getWeekendFreeMin(), c.isApprovalRequired(), c.getTheme());
        }
    }

    /** 모드 선택 화면: 가족 이름 · 아이 목록 · 오늘 날짜(가족 시간대) */
    public record FamilyView(String name, String today, List<ChildDto> children) {}

    public record ChildSettings(
            @NotBlank @Size(max = 20) String name,
            @NotNull @Min(3) @Max(18) Integer age,
            @NotNull @Min(1) @Max(3) Integer level,
            @NotNull @Pattern(regexp = "quest|planner") String uiStyle,
            @NotNull @Min(0) @Max(180) Integer weekdayFreeMin,
            @NotNull @Min(0) @Max(180) Integer weekendFreeMin,
            @NotNull Boolean approvalRequired,
            /** 없으면 지금 테마를 그대로 둔다 (예전 화면에서 보낸 요청) */
            @Pattern(regexp = "dragon|capybara|seal") String theme) {}

    /** 아이 등록 (+ 첫 반복 할 일). requestId 가 같으면 이미 만든 아이를 돌려준다 */
    public record NewChildRequest(
            @NotBlank @Size(max = 40) String requestId,
            @NotNull @Valid ChildSettings settings,
            @Size(max = 20) List<@Valid RoutineRequest> routines,
            boolean addToday) {}
}
