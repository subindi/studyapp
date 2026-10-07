package com.family.sseuro.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record SignupRequest(
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 20) String displayName,
            @NotBlank @Size(max = 30) String familyName) {}

    public record LoginRequest(
            @NotBlank @Size(max = 190) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record PinRequest(@NotBlank @Pattern(regexp = "\\d{4}") String pin) {}

    /** PIN 을 잊었을 때: 계정 비밀번호로 본인 확인 후 새 PIN */
    public record PinResetRequest(
            @NotBlank @Size(max = 72) String password,
            @NotBlank @Pattern(regexp = "\\d{4}") String pin) {}

    /** parentMode: 지금 이 세션에서 부모 화면이 열려 있는지 (서버가 판단) */
    public record MeResponse(String email, String displayName, String familyName, boolean pinSet, boolean parentMode) {}
}
