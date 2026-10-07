package com.family.sseuro.family;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 아이 프로필. level(자기주도 단계)은 나이와 별개로 부모가 아이와 함께 정한다.
 * Lv.1 같이 해요 · Lv.2 순서 선택 · Lv.3 순서와 예상시간 선택.
 * uiStyle: quest(큰 카드 · 적은 글자) | planner(정돈된 목록 · 시간 계획) — 화면 모양일 뿐 권한과 무관
 * theme: dragon | capybara | seal — 색 · 캐릭터 · 배경만 바꾸는 화면 테마
 */
@Entity
@Table(name = "ss_child")
public class Child {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(nullable = false)
    private int age;

    @Column(nullable = false)
    private int level;

    @Column(name = "ui_style", nullable = false, length = 10)
    private String uiStyle;

    @Column(nullable = false, length = 20)
    private String theme = "dragon";

    @Column(name = "weekday_free_min", nullable = false)
    private int weekdayFreeMin;

    @Column(name = "weekend_free_min", nullable = false)
    private int weekendFreeMin;

    /** 자유시간 전에 부모의 하루 확인을 받는지 */
    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** 같은 요청(재시도 · 중복 클릭)으로 아이가 두 번 만들어지지 않게 */
    @Column(name = "request_id", length = 40)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Child() {}

    public Child(long familyId, String requestId, int sortOrder, Instant now) {
        this.familyId = familyId;
        this.requestId = requestId;
        this.sortOrder = sortOrder;
        this.createdAt = now;
    }

    public void update(String name, int age, int level, String uiStyle, int weekdayFreeMin, int weekendFreeMin, boolean approvalRequired) {
        this.name = name;
        this.age = age;
        this.level = level;
        this.uiStyle = uiStyle;
        this.weekdayFreeMin = weekdayFreeMin;
        this.weekendFreeMin = weekendFreeMin;
        this.approvalRequired = approvalRequired;
    }

    public Long getId() {
        return id;
    }

    public Long getFamilyId() {
        return familyId;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    public int getLevel() {
        return level;
    }

    public String getUiStyle() {
        return uiStyle;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }

    public int getWeekdayFreeMin() {
        return weekdayFreeMin;
    }

    public int getWeekendFreeMin() {
        return weekendFreeMin;
    }

    public boolean isApprovalRequired() {
        return approvalRequired;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
