package com.family.sseuro.auth;

import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.config.AppProperties;
import java.time.Duration;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가입(가족 생성) · 로그인 · 내 정보 · 부모 PIN */
@Service
public class AuthService {
    private final ParentUserRepository users;
    private final FamilyRepository families;
    private final PasswordEncoder encoder;
    private final LoginAttemptLimiter limiter;
    private final TimeService time;
    private final AppProperties.Pin pinRule;
    /** 없는 이메일도 비밀번호 확인과 비슷한 시간이 걸리게 하는 더미 해시 */
    private final String dummyHash;

    public AuthService(ParentUserRepository users, FamilyRepository families, PasswordEncoder encoder,
                       LoginAttemptLimiter limiter, TimeService time, AppProperties props) {
        this.users = users;
        this.families = families;
        this.encoder = encoder;
        this.limiter = limiter;
        this.time = time;
        this.pinRule = props.pin();
        this.dummyHash = encoder.encode("not-a-real-password");
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** 가입 = 새 가족 + 첫 부모 계정. clientKey(IP)마다 짧은 시간에 너무 많이 가입하지 못하게 막는다 */
    @Transactional
    public AuthUser signup(String rawEmail, String password, String displayName, String familyName, String clientKey) {
        String signupKey = "signup:" + clientKey;
        if (limiter.isLocked(signupKey)) throw tooMany();
        String email = normalize(rawEmail);
        if (users.existsByEmail(email)) throw emailTaken();
        try {
            Family family = families.saveAndFlush(new Family(clean(familyName, 30, "가족 이름"), time.now()));
            ParentUser user = users.saveAndFlush(new ParentUser(family.getId(), email, encoder.encode(password),
                    clean(displayName, 20, "이름"), time.now()));
            limiter.fail(signupKey); // 가입 횟수 세기
            return new AuthUser(user.getId(), family.getId(), user.getEmail());
        } catch (DataIntegrityViolationException e) {
            throw emailTaken(); // 동시에 같은 이메일로 가입한 경우
        }
    }

    @Transactional(readOnly = true)
    public AuthUser login(String rawEmail, String password) {
        ParentUser user = checkPassword(normalize(rawEmail), password);
        return new AuthUser(user.getId(), user.getFamilyId(), user.getEmail());
    }

    private ParentUser checkPassword(String email, String password) {
        if (limiter.isLocked(email)) throw tooMany();
        ParentUser user = users.findByEmail(email).orElse(null);
        boolean matches = encoder.matches(password, user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !matches) {
            limiter.fail(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않아요");
        }
        limiter.succeed(email);
        return user;
    }

    @Transactional(readOnly = true)
    public AuthDtos.MeResponse me(AuthUser me, boolean parentMode) {
        ParentUser user = users.findById(me.id()).orElseThrow(AuthService::unauthorized);
        Family family = family(me);
        return new AuthDtos.MeResponse(user.getEmail(), user.getDisplayName(), family.getName(), family.hasPin(), parentMode);
    }

    /** PIN 확인. 연속으로 틀리면 가족 단위로 잠시 잠근다 (모든 기기 공통) */
    @Transactional(noRollbackFor = ApiException.class)
    public void checkPin(AuthUser me, String pin) {
        Family family = family(me);
        if (!family.hasPin()) throw new ApiException(HttpStatus.CONFLICT, "PIN_NOT_SET", "부모 PIN 을 먼저 설정해 주세요");
        if (family.isPinLocked(time.now())) throw pinLocked();
        if (!encoder.matches(pin, family.getPinHash())) {
            int left = family.pinFailed(pinRule.maxFailures(), time.now().plus(Duration.ofMinutes(pinRule.lockMinutes())));
            if (left == 0) throw pinLocked();
            throw new ApiException(HttpStatus.UNAUTHORIZED, "PIN_WRONG", "PIN 이 맞지 않아요. " + left + "번 더 시도할 수 있어요");
        }
        family.pinSucceeded();
    }

    /** 새 PIN (부모 모드에서만 호출) */
    @Transactional
    public void setPin(AuthUser me, String pin) {
        family(me).setPin(encoder.encode(pin));
    }

    /** PIN 복구: 부모 계정 비밀번호로 본인 확인한 뒤 새 PIN */
    @Transactional
    public void resetPin(AuthUser me, String password, String pin) {
        ParentUser user = users.findById(me.id()).orElseThrow(AuthService::unauthorized);
        checkPassword(user.getEmail(), password);
        family(me).setPin(encoder.encode(pin));
    }

    private Family family(AuthUser me) {
        return families.findById(me.familyId()).orElseThrow(AuthService::unauthorized);
    }

    /** 앞뒤 공백 · 제어 문자를 없앤 이름 (비면 오류) */
    public static String clean(String raw, int max, String label) {
        String s = raw == null ? "" : raw.replaceAll("\\p{Cntrl}", "").strip();
        if (s.isEmpty() || s.length() > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", label + "은(는) 1~" + max + "자로 입력해 주세요");
        }
        return s;
    }

    static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요해요");
    }

    private static ApiException pinLocked() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "PIN_LOCKED", "PIN 을 여러 번 틀려서 잠시 잠갔어요. 잠시 후 다시 해 주세요");
    }

    private static ApiException tooMany() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", "시도가 너무 많아요. 잠시 후 다시 해 주세요");
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "이미 가입된 이메일이에요. 로그인해 주세요");
    }
}
