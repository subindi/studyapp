package com.family.sseuro.routine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 반복 원본. 날짜별 할 일(Task)은 생성 시점의 값을 복사하므로, 원본을 고쳐도 이미 생성된 날은 그대로이고
 * 오늘만 조정해도 원본은 바뀌지 않는다. daysMask: 월=1, 화=2, 수=4 … 일=64
 */
@Entity
@Table(name = "ss_routine")
public class Routine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "child_id", nullable = false)
    private Long childId;

    @Column(nullable = false, length = 16)
    private String icon;

    @Column(nullable = false, length = 60)
    private String title;

    @Column(nullable = false, length = 60)
    private String amount;

    @Column(name = "estimate_min", nullable = false)
    private int estimateMin;

    @Column(nullable = false)
    private boolean required;

    @Column(name = "days_mask", nullable = false)
    private int daysMask;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "request_id", length = 40)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Routine() {}

    public Routine(long childId, String requestId, int sortOrder, Instant now) {
        this.childId = childId;
        this.requestId = requestId;
        this.sortOrder = sortOrder;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String icon, String title, String amount, int estimateMin, boolean required, int daysMask, Instant now) {
        this.icon = icon;
        this.title = title;
        this.amount = amount;
        this.estimateMin = estimateMin;
        this.required = required;
        this.daysMask = daysMask;
        this.updatedAt = now;
    }

    public void deactivate(Instant now) {
        this.active = false;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getChildId() {
        return childId;
    }

    public String getIcon() {
        return icon;
    }

    public String getTitle() {
        return title;
    }

    public String getAmount() {
        return amount;
    }

    public int getEstimateMin() {
        return estimateMin;
    }

    public boolean isRequired() {
        return required;
    }

    public int getDaysMask() {
        return daysMask;
    }

    public boolean isActive() {
        return active;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
