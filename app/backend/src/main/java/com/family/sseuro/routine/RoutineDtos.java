package com.family.sseuro.routine;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class RoutineDtos {
    private RoutineDtos() {}

    /** daysMask: 월=1, 화=2, 수=4, 목=8, 금=16, 토=32, 일=64 (하나 이상) */
    public record RoutineRequest(
            @NotBlank @Size(max = 16) String icon,
            @NotBlank @Size(max = 60) String title,
            @NotBlank @Size(max = 60) String amount,
            @NotNull @Min(1) @Max(180) Integer estimateMin,
            @NotNull Boolean required,
            @NotNull @Min(1) @Max(127) Integer daysMask) {}

    /** 새 반복 할 일. addToday: 오늘 할 일에도 추가 (요일과 상관없이) */
    public record NewRoutineRequest(
            @NotBlank @Size(max = 40) String requestId,
            @NotNull @jakarta.validation.Valid RoutineRequest routine,
            boolean addToday) {}

    public record RoutineDto(long id, String icon, String title, String amount, int estimateMin, boolean required, int daysMask) {
        public static RoutineDto of(Routine r) {
            return new RoutineDto(r.getId(), r.getIcon(), r.getTitle(), r.getAmount(), r.getEstimateMin(), r.isRequired(), r.getDaysMask());
        }
    }
}
