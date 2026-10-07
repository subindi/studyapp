package com.family.sseuro.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 app.* 설정. zone: 가족 활동일 기준 시간대 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String zone, Login login, Pin pin) {

    public record Login(int maxFailures, int lockMinutes) {}

    /** PIN 연속 오류 제한 · 부모 모드 유지 시간 */
    public record Pin(int maxFailures, int lockMinutes, int idleMinutes) {}
}
