package com.family.sseuro.common;

import org.springframework.http.HttpStatus;

/** 사용자에게 보여줄 코드/메시지를 가진 예외 (ApiExceptionHandler 가 JSON 으로 변환) */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
