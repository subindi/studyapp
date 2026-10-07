package com.family.sseuro.auth;

import com.family.sseuro.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** 같은 이메일로 로그인 실패가 계속되면 잠시 막는다 (서버 메모리, 재시작하면 초기화) */
@Component
public class LoginAttemptLimiter {
    private record Failures(int count, Instant since) {}

    private final Map<String, Failures> failures = new ConcurrentHashMap<>();
    private final int maxFailures;
    private final Duration lock;
    private final Clock clock;

    @Autowired
    public LoginAttemptLimiter(AppProperties props) {
        this(props.login().maxFailures(), Duration.ofMinutes(props.login().lockMinutes()), Clock.systemUTC());
    }

    LoginAttemptLimiter(int maxFailures, Duration lock, Clock clock) {
        this.maxFailures = maxFailures;
        this.lock = lock;
        this.clock = clock;
    }

    public boolean isLocked(String key) {
        Failures f = failures.get(key);
        if (f == null) return false;
        if (f.since().plus(lock).isBefore(clock.instant())) {
            failures.remove(key);
            return false;
        }
        return f.count() >= maxFailures;
    }

    public void fail(String key) {
        Instant now = clock.instant();
        failures.merge(key, new Failures(1, now), (old, fresh) ->
                old.since().plus(lock).isBefore(now) ? fresh : new Failures(old.count() + 1, old.since()));
    }

    public void succeed(String key) {
        failures.remove(key);
    }
}
