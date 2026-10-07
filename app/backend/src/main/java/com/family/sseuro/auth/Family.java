package com.family.sseuro.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 가족: 데이터 격리 단위. 모든 아이 · 할 일 조회는 로그인한 부모의 가족 안에서만 한다 */
@Entity
@Table(name = "ss_family")
public class Family {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String name;

    /** 부모 화면 진입 보조 PIN (BCrypt). 없으면 아직 설정 전 */
    @Column(name = "pin_hash", length = 100)
    private String pinHash;

    @Column(name = "pin_failures", nullable = false)
    private int pinFailures;

    @Column(name = "pin_locked_until")
    private Instant pinLockedUntil;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Family() {}

    public Family(String name, Instant now) {
        this.name = name;
        this.createdAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void rename(String name) {
        this.name = name;
    }

    public String getPinHash() {
        return pinHash;
    }

    public boolean hasPin() {
        return pinHash != null;
    }

    public void setPin(String hash) {
        this.pinHash = hash;
        this.pinFailures = 0;
        this.pinLockedUntil = null;
    }

    public boolean isPinLocked(Instant now) {
        return pinLockedUntil != null && pinLockedUntil.isAfter(now);
    }

    public Instant getPinLockedUntil() {
        return pinLockedUntil;
    }

    /** 틀린 횟수를 세고, 한도에 닿으면 잠근다. 남은 횟수를 돌려준다 */
    public int pinFailed(int max, Instant lockUntil) {
        pinFailures++;
        if (pinFailures >= max) {
            pinFailures = 0;
            pinLockedUntil = lockUntil;
            return 0;
        }
        return max - pinFailures;
    }

    public void pinSucceeded() {
        pinFailures = 0;
        pinLockedUntil = null;
    }
}
