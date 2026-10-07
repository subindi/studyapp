package com.family.sseuro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// 로그인은 AuthController 가 직접 처리하므로 기본 메모리 사용자(임시 비밀번호 로그)는 만들지 않는다
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class SseuroApplication {
    public static void main(String[] args) {
        SpringApplication.run(SseuroApplication.class, args);
    }
}
