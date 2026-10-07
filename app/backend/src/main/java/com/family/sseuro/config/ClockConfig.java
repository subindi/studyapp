package com.family.sseuro.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 시각은 모두 이 Clock 으로 (테스트에서 시간을 움직여 타이머 · 하루 마감을 검증) */
@Configuration
public class ClockConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
