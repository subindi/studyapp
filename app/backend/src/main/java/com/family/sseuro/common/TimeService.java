package com.family.sseuro.common;

import com.family.sseuro.config.AppProperties;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/** 지금 시각 · 오늘(가족 시간대 기준) · 하루 마감 시각 */
@Component
public class TimeService {
    private final Clock clock;
    private final ZoneId zone;

    public TimeService(Clock clock, AppProperties props) {
        this.clock = clock;
        this.zone = ZoneId.of(props.zone() == null ? "Asia/Seoul" : props.zone());
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate today() {
        return LocalDate.ofInstant(now(), zone);
    }

    /** 그날의 끝 (다음 날 0시). 진행 중이던 타이머는 이 시각까지만 센다 */
    public Instant dayEnd(LocalDate day) {
        return day.plusDays(1).atStartOfDay(zone).toInstant();
    }

    public static boolean isWeekend(LocalDate day) {
        DayOfWeek d = day.getDayOfWeek();
        return d == DayOfWeek.SATURDAY || d == DayOfWeek.SUNDAY;
    }

    /** 월=1, 화=2, 수=4 … 일=64 */
    public static int dayBit(LocalDate day) {
        return 1 << (day.getDayOfWeek().getValue() - 1);
    }

    /** since 부터 지금(단, 그날 마감까지)까지 흐른 초 */
    public int secondsSince(Instant since, LocalDate day) {
        Instant end = now().isBefore(dayEnd(day)) ? now() : dayEnd(day);
        long s = Duration.between(since, end).getSeconds();
        return (int) Math.max(0, s);
    }
}
