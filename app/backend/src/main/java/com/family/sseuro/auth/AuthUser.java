package com.family.sseuro.auth;

import java.io.Serializable;
import org.springframework.security.core.AuthenticatedPrincipal;

/** 세션에 저장되는 로그인 부모 (DB 세션에 직렬화되므로 Serializable). familyId 로 모든 데이터를 거른다 */
public record AuthUser(long id, long familyId, String email) implements AuthenticatedPrincipal, Serializable {
    @Override
    public String getName() {
        return String.valueOf(id);
    }
}
