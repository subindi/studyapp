package com.family.sseuro.day;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 아이의 도움 요청. status: open | resolved (처리된 요청은 처리 상태로 보여 준다) */
@Entity
@Table(name = "help_request")
public class HelpRequest {
    public static final String OPEN = "open", RESOLVED = "resolved";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "child_id", nullable = false)
    private Long childId;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(nullable = false, length = 40)
    private String reason;

    @Column(nullable = false, length = 10)
    private String status = OPEN;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected HelpRequest() {}

    HelpRequest(long childId, long taskId, String reason, Instant now) {
        this.childId = childId;
        this.taskId = taskId;
        this.reason = reason;
        this.createdAt = now;
    }

    void resolve(Instant now) {
        status = RESOLVED;
        resolvedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getChildId() {
        return childId;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getReason() {
        return reason;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
