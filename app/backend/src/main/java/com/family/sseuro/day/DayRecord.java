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
 * 아이의 하루 (아이+날짜마다 하나). 이 행을 잠가서(SELECT … FOR UPDATE) 그날의 변경을 한 줄로 세운다
 * → 반복 생성 · 이용권 발급이 동시에 두 번 일어나지 않는다.
 * 부모의 하루 승인(approvedAt)은 이용권 발급과 별개로 저장한다.
 */
@Entity
@Table(name = "ss_day_record")
public class DayRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "child_id", nullable = false)
    private Long childId;

    @Column(name = "activity_day", nullable = false)
    private LocalDate day;

    /** 반복 원본으로 그날 할 일을 만들었는지 (한 번만) */
    @Column(name = "routines_generated", nullable = false) // 'generated' 는 MySQL 8 예약어
    private boolean generated;

    /** 아이가 순서를 정했는지 */
    @Column(nullable = false)
    private boolean planned;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by")
    private Long approvedBy;

    /** 필수 할 일이 없는 날, 아이가 부모님께 자유시간을 요청한 시각 */
    @Column(name = "free_request_at")
    private Instant freeRequestAt;

    protected DayRecord() {}

    DayRecord(long childId, LocalDate day) {
        this.childId = childId;
        this.day = day;
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

    public boolean isGenerated() {
        return generated;
    }

    void markGenerated() {
        generated = true;
    }

    public boolean isPlanned() {
        return planned;
    }

    void markPlanned() {
        planned = true;
    }

    public boolean isApproved() {
        return approvedAt != null;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    void approve(long parentId, Instant now) {
        approvedAt = now;
        approvedBy = parentId;
    }

    void clearApproval() {
        approvedAt = null;
        approvedBy = null;
    }

    public Instant getFreeRequestAt() {
        return freeRequestAt;
    }

    void requestFree(Instant now) {
        if (freeRequestAt == null) freeRequestAt = now;
    }
}
