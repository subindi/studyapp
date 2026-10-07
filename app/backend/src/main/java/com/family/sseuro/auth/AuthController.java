package com.family.sseuro.auth;

import com.family.sseuro.auth.AuthDtos.LoginRequest;
import com.family.sseuro.auth.AuthDtos.MeResponse;
import com.family.sseuro.auth.AuthDtos.PinRequest;
import com.family.sseuro.auth.AuthDtos.PinResetRequest;
import com.family.sseuro.auth.AuthDtos.SignupRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
    private final AuthService auth;
    private final ParentMode parentMode;
    private final SecurityContextRepository contexts;

    public AuthController(AuthService auth, ParentMode parentMode, SecurityContextRepository contexts) {
        this.auth = auth;
        this.parentMode = parentMode;
        this.contexts = contexts;
    }

    /** 가입: 새 가족을 만들고 로그인. 비밀번호로 확인했으므로 부모 모드로 시작 */
    @PostMapping(path = "/api/auth/signup", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MeResponse> signup(@Valid @RequestBody SignupRequest body, HttpServletRequest req, HttpServletResponse res) {
        AuthUser user = auth.signup(body.email(), body.password(), body.displayName(), body.familyName(), req.getRemoteAddr());
        HttpSession session = startSession(user, req, res);
        parentMode.open(session);
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.me(user, true));
    }

    @PostMapping(path = "/api/auth/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    public MeResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
        AuthUser user = auth.login(body.email(), body.password());
        HttpSession session = startSession(user, req, res);
        parentMode.open(session);
        return auth.me(user, true);
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/auth/me")
    public MeResponse me(@AuthenticationPrincipal AuthUser user, HttpServletRequest req) {
        if (user == null) throw AuthService.unauthorized();
        return auth.me(user, parentMode.isOpen(req.getSession(false)));
    }

    /** 부모 모드 열기 (PIN 확인은 서버에서, 연속 오류는 가족 단위로 잠금) */
    @PostMapping(path = "/api/auth/pin/unlock", consumes = MediaType.APPLICATION_JSON_VALUE)
    public MeResponse unlock(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody PinRequest body, HttpServletRequest req) {
        auth.checkPin(user, body.pin());
        parentMode.open(req.getSession(true));
        return auth.me(user, true);
    }

    /** 아이 모드로 전환 = 부모 모드 잠금 */
    @PostMapping("/api/auth/pin/lock")
    public MeResponse lock(@AuthenticationPrincipal AuthUser user, HttpServletRequest req) {
        parentMode.close(req.getSession(false));
        return auth.me(user, false);
    }

    /** PIN 을 잊었을 때: 계정 비밀번호로 확인하고 새 PIN 설정 → 부모 모드 */
    @PostMapping(path = "/api/auth/pin/reset", consumes = MediaType.APPLICATION_JSON_VALUE)
    public MeResponse reset(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody PinResetRequest body, HttpServletRequest req) {
        auth.resetPin(user, body.password(), body.pin());
        parentMode.open(req.getSession(true));
        return auth.me(user, true);
    }

    /** PIN 설정 · 변경 (부모 모드에서만: /api/parent/** 는 ParentModeInterceptor 가 확인) */
    @PutMapping(path = "/api/parent/pin", consumes = MediaType.APPLICATION_JSON_VALUE)
    public MeResponse setPin(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody PinRequest body) {
        auth.setPin(user, body.pin());
        return auth.me(user, true);
    }

    /** 로그인 성공: 세션 ID를 새로 바꾸고(세션 고정 공격 방지) 로그인 정보를 세션에 저장 */
    private HttpSession startSession(AuthUser user, HttpServletRequest req, HttpServletResponse res) {
        req.getSession(true);
        req.changeSessionId();
        var token = new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_PARENT")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(token);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, req, res);
        return req.getSession();
    }
}
