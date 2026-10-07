package com.family.sseuro.auth;

import com.family.sseuro.common.TimeService;
import com.family.sseuro.config.AppProperties;
import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

/**
 * 부모 모드 = 이 세션에서 PIN(또는 계정 비밀번호)을 확인한 뒤 일정 시간 동안만 열리는 상태.
 * 화면 버튼이 아니라 서버 세션에 기록하고, /api/parent/** 요청마다 ParentModeInterceptor 가 확인한다.
 */
@Component
public class ParentMode {
    static final String ATTR = "parentModeUntil";
    private final TimeService time;
    private final Duration idle;

    public ParentMode(TimeService time, AppProperties props) {
        this.time = time;
        this.idle = Duration.ofMinutes(props.pin().idleMinutes());
    }

    public void open(HttpSession session) {
        session.setAttribute(ATTR, time.now().plus(idle).toEpochMilli());
    }

    public void close(HttpSession session) {
        if (session != null) session.removeAttribute(ATTR);
    }

    public boolean isOpen(HttpSession session) {
        if (session == null) return false;
        Object v = session.getAttribute(ATTR);
        return v instanceof Long until && Instant.ofEpochMilli(until).isAfter(time.now());
    }

    /** 열려 있으면 유지 시간을 다시 늘린다 (마지막 부모 요청 기준) */
    public boolean touch(HttpSession session) {
        if (!isOpen(session)) return false;
        open(session);
        return true;
    }
}
