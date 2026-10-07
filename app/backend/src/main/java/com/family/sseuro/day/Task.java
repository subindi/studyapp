package com.family.sseuro.day;

import com.family.sseuro.routine.Routine;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 날짜별 할 일 인스턴스.
 * status: ready(시작 전) · active(진행) · paused(쉬는 중) · done(완료) · waived(오늘만 면제) · moved(다른 날로 이동)
 * 면제 · 이동은 완료가 아니다 (완료 건수에 더하지 않는다).
 * 타이머: elapsedSec(멈출 때까지 쌓인 초) + runningSince(진행 중이면 시작 시각). 시간은 서버 시계로만 센다.
 */
@Entity
@Table(name = "task")
public class Task {
    public static final String READY = "ready", ACTIVE = "active", PAUSED = "paused", DONE = "done", WAIVED = "waived", MOVED = "moved";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "child_id", nullable = false)
    private Long childId;

    @Column(name = "activity_day", nullable = false)
    private LocalDate day;

    @Column(name = "routine_id")
    private Long routineId;

    /** 다른 날에서 옮겨 온 할 일이면 원래 할 일 번호 (같은 이동이 두 번 생기지 않게 유일) */
    @Column(name = "origin_task_id")
    private Long originTaskId;

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

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false, length = 10)
    private String status = READY;

    /** child(아이 자기확인) | parent(부모가 완료 인정) */
    @Column(name = "done_by", length = 10)
    private String doneBy;

    @Column(name = "elapsed_sec", nullable = false)
    private int elapsedSec;

    @Column(name = "running_since")
    private Instant runningSince;

    @Column(name = "moved_to")
    private LocalDate movedTo;

    @Column(name = "adjust_reason", length = 60)
    private String adjustReason;

    @Column(name = "request_id", length = 40)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Task() {}

    Task(long childId, LocalDate day, int sortOrder, Instant now) {
        this.childId = childId;
        this.day = day;
        this.sortOrder = sortOrder;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** 반복 원본의 지금 값을 복사한 그날의 할 일 */
    static Task fromRoutine(Routine r, LocalDate day, int sortOrder, Instant now) {
        Task t = new Task(r.getChildId(), day, sortOrder, now);
        t.routineId = r.getId();
        t.icon = r.getIcon();
        t.title = r.getTitle();
        t.amount = r.getAmount();
        t.estimateMin = r.getEstimateMin();
        t.required = r.isRequired();
        return t;
    }

    /** 다른 날로 옮긴 할 일의 복사본 (타이머 · 상태는 새로 시작) */
    Task copyTo(LocalDate target, int sortOrder, Instant now) {
        Task t = new Task(childId, target, sortOrder, now);
        t.originTaskId = id;
        t.icon = icon;
        t.title = title;
        t.amount = amount;
        t.estimateMin = estimateMin;
        t.required = required;
        return t;
    }

    public boolean isRunning() {
        return runningSince != null;
    }

    /** 진행 중이면 멈추고 흐른 시간을 쌓는다 */
    void stop(int secondsSinceStart, Instant now) {
        if (runningSince != null) {
            elapsedSec += secondsSinceStart;
            runningSince = null;
        }
        touch(now);
    }

    void start(Instant now) {
        runningSince = now;
        status = ACTIVE;
        touch(now);
    }

    void setStatus(String status, Instant now) {
        this.status = status;
        touch(now);
    }

    void markDone(String by, Instant now) {
        this.status = DONE;
        this.doneBy = by;
        touch(now);
    }

    /** 다시 할 일로: 쓴 시간이 있으면 '쉬는 중', 없으면 '시작 전' (쌓인 시간은 지우지 않는다) */
    void reopen(Instant now) {
        this.status = elapsedSec > 0 ? PAUSED : READY;
        this.doneBy = null;
        this.movedTo = null;
        touch(now);
    }

    void moveTo(LocalDate target, Instant now) {
        this.status = MOVED;
        this.movedTo = target;
        touch(now);
    }

    void changeAmount(String amount, Instant now) {
        this.amount = amount;
        touch(now);
    }

    void setAdjustReason(String reason) {
        this.adjustReason = reason;
    }

    void setOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    void setEstimate(int estimateMin, Instant now) {
        this.estimateMin = estimateMin;
        touch(now);
    }

    void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    private void touch(Instant now) {
        this.updatedAt = now;
    }

    public boolean isClosed() {
        return DONE.equals(status) || WAIVED.equals(status) || MOVED.equals(status);
    }

    /** 자유시간 조건에서 빠지는 할 일 (면제 · 이동) */
    public boolean isExcused() {
        return WAIVED.equals(status) || MOVED.equals(status);
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

    public Long getRoutineId() {
        return routineId;
    }

    public Long getOriginTaskId() {
        return originTaskId;
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

    public int getSortOrder() {
        return sortOrder;
    }

    public String getStatus() {
        return status;
    }

    public String getDoneBy() {
        return doneBy;
    }

    public int getElapsedSec() {
        return elapsedSec;
    }

    public Instant getRunningSince() {
        return runningSince;
    }

    public LocalDate getMovedTo() {
        return movedTo;
    }

    public String getAdjustReason() {
        return adjustReason;
    }
}
