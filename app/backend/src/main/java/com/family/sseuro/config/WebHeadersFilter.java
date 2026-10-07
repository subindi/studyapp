package com.family.sseuro.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * nginx 없이 Spring Boot 하나로 화면까지 서비스할 때 붙이는 헤더 (nginx.conf 와 같은 규칙).
 * - 가족용: 검색 엔진에 노출하지 않음
 * - 해시 이름이 붙은 빌드 파일(/assets/)은 오래 캐시, 나머지(첫 화면 · 서비스 워커 · API)는 매번 확인
 */
@Component
public class WebHeadersFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Cache-Control", req.getRequestURI().startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
        chain.doFilter(req, res);
    }
}
