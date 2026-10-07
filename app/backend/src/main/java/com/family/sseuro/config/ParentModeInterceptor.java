package com.family.sseuro.config;

import com.family.sseuro.auth.ParentMode;
import com.family.sseuro.common.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * /api/parent/** 는 부모 모드가 열린 세션만 쓸 수 있다.
 * PIN 화면은 화면일 뿐이고, 권한은 여기(서버)에서 매 요청 확인한다. 아이 모드 기기에서 주소를 직접 불러도 403.
 */
@Configuration
public class ParentModeInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    private final ParentMode parentMode;
    private final ObjectMapper json;

    public ParentModeInterceptor(ParentMode parentMode, ObjectMapper json) {
        this.parentMode = parentMode;
        this.json = json;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/parent/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        if (parentMode.touch(req.getSession(false))) return true;
        res.setStatus(403);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        json.writeValue(res.getWriter(), new ErrorResponse("PARENT_LOCKED", "부모 PIN 을 입력해 주세요"));
        return false;
    }
}
