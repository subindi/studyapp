package com.family.sseuro.day;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 자유시간 이용권 (아이+활동일마다 하나, DB 유일 제약).
 * status: ready(받음, 시작 전) · running · paused · used(다 씀 · 하루가 끝남)
 * minutes 는 발급 때 설정값을 복사 → 이후 설정을 바꿔도 이 이용권에는 소급하지 않는다.
 * 완료를 되돌려도 이미 발급된 이용권은 자동 회수하지 않는다.
 */
@Entity
@Table(name = "ss_free_pass")
public class FreePass {
    public static final String READY = "ready", RUNNING = "running", PAUSED = "paused", USED = "used";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "child_id", nullable = false)
    private Long childId;

    @Column(name = "activity_day", nullable = false)
    private LocalDate day;

    @Column(nullable = false)
    private int minutes;

    @Column(nullable = false, length = 10)
    private String status = READY;

    @Column(name = "remaining_sec", nullable = false)
    private int remainingSec;

    @Column(name = "running_since")
    private Instant runningSince;

    @Column(length = 20)
    private String activity;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    protected FreePass() {}

    FreePass(long childId, LocalDate day, int minutes, Instant now) {
        this.childId = childId;
        this.day = day;
        this.minutes = minutes;
        this.remainingSec = minutes * 60;
        this.issuedAt = now;
        if (remainingSec == 0) status = USED;
    }

    /** 흐른 시간을 남은 시간에서 빼고 진행 중인 시각을 다시 잡는다 */
    void settle(int secondsSinceStart, Instant now, boolean dayOver) {
        if (runningSince != null) {
            remainingSec = Math.max(0, remainingSec - secondsSinceStart);
            runningSince = (remainingSec == 0 || dayOver) ? null : now;
        }
        if (remainingSec == 0 || dayOver) {
            status = USED; // 남은 시간은 다음 날로 넘기지 않는다
            runningSince = null;
        }
    }

    void start(Instant now) {
        status = RUNNING;
        runningSince = now;
    }

    void pause() {
        status = PAUSED;
        runningSince = null;
    }

    void chooseActivity(String activity) {
        this.activity = activity;
    }

    public Long getId() {
        return id;
    }

    public Long getChildId() {
        return childId;
    }

    public LocalDate getDay() {
        return day;
    }

    public int getMinutes() {
        return minutes;
    }

    public String getStatus() {
        return status;
    }

    public int getRemainingSec() {
        return remainingSec;
    }

    public Instant getRunningSince() {
        return runningSince;
    }

    public String getActivity() {
        return activity;
    }
}
