-- 스스로 초기 스키마 (MySQL 8 / H2 MySQL 모드 공통)
-- 운영 DB(ciat)를 다른 앱과 함께 쓰므로 모든 테이블에 ss_ 접두어
-- 원칙: 반복 원본(routine)과 날짜별 할 일(task)을 나누고, 부모 승인(day_record)과 자유시간 이용권(free_pass)을 나눈다

-- 가족: 데이터 격리 단위. PIN 은 부모 화면 진입 보조 수단 (해시로만 저장)
CREATE TABLE ss_family (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    name             VARCHAR(30)  NOT NULL,
    pin_hash         VARCHAR(100),
    pin_failures     INT          NOT NULL DEFAULT 0,
    pin_locked_until DATETIME(6),
    created_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id)
);

-- 부모 계정 (로그인 주체). 한 가족에 여러 부모가 있을 수 있다
CREATE TABLE ss_parent_user (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    family_id     BIGINT       NOT NULL,
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(20)  NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_parent_email UNIQUE (email),
    CONSTRAINT ss_fk_parent_family FOREIGN KEY (family_id) REFERENCES ss_family (id) ON DELETE CASCADE
);

-- 아이 프로필. level = 자기주도 단계(나이와 별개), ui_style = quest(큰 카드) | planner(차분한 목록)
CREATE TABLE ss_child (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    family_id         BIGINT      NOT NULL,
    name              VARCHAR(20) NOT NULL,
    age               INT         NOT NULL,
    level             INT         NOT NULL,
    ui_style          VARCHAR(10) NOT NULL,
    weekday_free_min  INT         NOT NULL,
    weekend_free_min  INT         NOT NULL,
    approval_required BOOLEAN     NOT NULL,
    sort_order        INT         NOT NULL,
    request_id        VARCHAR(40),
    created_at        DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_child_request UNIQUE (family_id, request_id),
    CONSTRAINT ss_fk_child_family FOREIGN KEY (family_id) REFERENCES ss_family (id) ON DELETE CASCADE
);

-- 반복 원본. days_mask: 월=1, 화=2, 수=4 … 일=64
-- 수정해도 이미 생성된 날짜별 할 일은 바뀌지 않는다 (다음 생성일부터 적용)
CREATE TABLE ss_routine (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    child_id     BIGINT      NOT NULL,
    icon         VARCHAR(16) NOT NULL,
    title        VARCHAR(60) NOT NULL,
    amount       VARCHAR(60) NOT NULL,
    estimate_min INT         NOT NULL,
    required     BOOLEAN     NOT NULL,
    days_mask    INT         NOT NULL,
    active       BOOLEAN     NOT NULL,
    sort_order   INT         NOT NULL,
    request_id   VARCHAR(40),
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_routine_request UNIQUE (child_id, request_id),
    CONSTRAINT ss_fk_routine_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE
);

-- 아이의 하루: 반복 생성 여부 · 계획 여부 · 부모의 하루 승인 (이용권 발급과는 별개)
CREATE TABLE ss_day_record (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    child_id     BIGINT      NOT NULL,
    activity_day DATE        NOT NULL,
    generated    BOOLEAN     NOT NULL,
    planned      BOOLEAN     NOT NULL,
    approved_at  DATETIME(6),
    approved_by  BIGINT,
    free_request_at DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_day_child_day UNIQUE (child_id, activity_day),
    CONSTRAINT ss_fk_day_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE
);

-- 날짜별 할 일 인스턴스. status: ready | active | paused | done | waived | moved
-- 타이머: elapsed_sec(누적) + running_since(진행 중이면 시작 시각) → 새로고침 · 다른 기기에서도 같은 값
CREATE TABLE ss_task (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    child_id       BIGINT      NOT NULL,
    activity_day   DATE        NOT NULL,
    routine_id     BIGINT,
    origin_task_id BIGINT,
    icon           VARCHAR(16) NOT NULL,
    title          VARCHAR(60) NOT NULL,
    amount         VARCHAR(60) NOT NULL,
    estimate_min   INT         NOT NULL,
    required       BOOLEAN     NOT NULL,
    sort_order     INT         NOT NULL,
    status         VARCHAR(10) NOT NULL,
    done_by        VARCHAR(10),
    elapsed_sec    INT         NOT NULL,
    running_since  DATETIME(6),
    moved_to       DATE,
    adjust_reason  VARCHAR(60),
    request_id     VARCHAR(40),
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_task_routine_day UNIQUE (child_id, activity_day, routine_id),
    CONSTRAINT ss_uk_task_origin UNIQUE (origin_task_id),
    CONSTRAINT ss_uk_task_request UNIQUE (child_id, request_id),
    CONSTRAINT ss_fk_task_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE
);
CREATE INDEX ss_ix_task_child_day ON ss_task (child_id, activity_day);

-- 자유시간 이용권: 아이+활동일마다 하나만 (재시도는 기존 이용권 반환)
-- status: ready | running | paused | used, minutes 는 발급 시점 설정값 (이후 설정 변경은 소급하지 않음)
CREATE TABLE ss_free_pass (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    child_id      BIGINT      NOT NULL,
    activity_day  DATE        NOT NULL,
    minutes       INT         NOT NULL,
    status        VARCHAR(10) NOT NULL,
    remaining_sec INT         NOT NULL,
    running_since DATETIME(6),
    activity      VARCHAR(20),
    issued_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ss_uk_pass_child_day UNIQUE (child_id, activity_day),
    CONSTRAINT ss_fk_pass_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE
);

-- 도움 요청 (같은 할 일에 열린 요청은 하나만 유지)
CREATE TABLE ss_help_request (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    child_id    BIGINT      NOT NULL,
    task_id     BIGINT      NOT NULL,
    reason      VARCHAR(40) NOT NULL,
    status      VARCHAR(10) NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    resolved_at DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT ss_fk_help_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE,
    CONSTRAINT ss_fk_help_task FOREIGN KEY (task_id) REFERENCES ss_task (id) ON DELETE CASCADE
);
CREATE INDEX ss_ix_help_child_status ON ss_help_request (child_id, status);

-- 하루 회고 (아이+날짜마다 하나, 다시 저장하면 덮어씀)
CREATE TABLE ss_review (
    child_id   BIGINT      NOT NULL,
    activity_day DATE        NOT NULL,
    mood       VARCHAR(10) NOT NULL,
    note       VARCHAR(200),
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (child_id, activity_day),
    CONSTRAINT ss_fk_review_child FOREIGN KEY (child_id) REFERENCES ss_child (id) ON DELETE CASCADE
);

-- 로그인 세션 (spring-session-jdbc 기본 스키마, 같은 DB 의 다른 앱과 겹치지 않게 SS_SESSION 이름)
CREATE TABLE SS_SESSION (
    PRIMARY_ID            CHAR(36)     NOT NULL,
    SESSION_ID            CHAR(36)     NOT NULL,
    CREATION_TIME         BIGINT       NOT NULL,
    LAST_ACCESS_TIME      BIGINT       NOT NULL,
    MAX_INACTIVE_INTERVAL INT          NOT NULL,
    EXPIRY_TIME           BIGINT       NOT NULL,
    PRINCIPAL_NAME        VARCHAR(100),
    CONSTRAINT SS_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);
CREATE UNIQUE INDEX SS_SESSION_IX1 ON SS_SESSION (SESSION_ID);
CREATE INDEX SS_SESSION_IX2 ON SS_SESSION (EXPIRY_TIME);
CREATE INDEX SS_SESSION_IX3 ON SS_SESSION (PRINCIPAL_NAME);

CREATE TABLE SS_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36)     NOT NULL,
    ATTRIBUTE_NAME     VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES    BLOB         NOT NULL,
    CONSTRAINT SS_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SS_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID) REFERENCES SS_SESSION (PRIMARY_ID) ON DELETE CASCADE
);
