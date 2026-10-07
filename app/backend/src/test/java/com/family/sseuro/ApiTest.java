package com.family.sseuro;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** docs/01-product-policy.md 의 검증 목록을 서버 API 로 확인한다 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:api;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
        "app.pin.max-failures=3",
})
@AutoConfigureMockMvc
@Import(ApiTest.TestClock.class)
@SuppressWarnings("unchecked")
class ApiTest {
    static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    /** 2026-10-07 수요일 10:00 (서울) */
    static final Instant WEDNESDAY = ZonedDateTime.of(2026, 10, 7, 10, 0, 0, 0, SEOUL).toInstant();

    /** 테스트에서 시간을 움직이는 시계 */
    static class MovableClock extends Clock {
        volatile Instant now = WEDNESDAY;

        @Override
        public ZoneId getZone() {
            return SEOUL;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }

        void plus(long seconds) {
            now = now.plus(Duration.ofSeconds(seconds));
        }
    }

    @TestConfiguration
    static class TestClock {
        @Bean
        @Primary
        MovableClock movableClock() {
            return new MovableClock();
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    MovableClock clock;

    @BeforeEach
    void resetClock() {
        clock.now = WEDNESDAY;
    }

    // ---------------------------------------------------------------- 도우미

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String body) {
        String ip = "10." + (int) (Math.random() * 250) + "." + (int) (Math.random() * 250) + "." + (int) (Math.random() * 250);
        return b.contentType(MediaType.APPLICATION_JSON).content(body).with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private String body(MockHttpServletRequestBuilder b) throws Exception {
        return mvc.perform(b).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    }

    /** 새 가족(가입) → 부모 모드 세션 + PIN 1357 설정 */
    private Cookie family() throws Exception {
        Cookie c = mvc.perform(json(post("/api/auth/signup"), """
                        {"email":"%s","password":"parent1234","displayName":"엄마","familyName":"우리 가족"}""".formatted(
                        "p-" + UUID.randomUUID() + "@example.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.parentMode").value(true))
                .andExpect(jsonPath("$.pinSet").value(false))
                .andReturn().getResponse().getCookie("SSID");
        assertThat(c).isNotNull();
        assertThat(c.isHttpOnly()).isTrue();
        mvc.perform(json(put("/api/parent/pin").cookie(c), "{\"pin\":\"1357\"}")).andExpect(jsonPath("$.pinSet").value(true));
        return c;
    }

    /** 시간을 많이 움직인 뒤 부모 모드 다시 열기 (부모 모드는 20분 동안만 유지) */
    private void unlock(Cookie c) throws Exception {
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"1357\"}")).andExpect(status().isOk());
    }

    /** 아이 등록 + 반복 할 일. required 배열 길이만큼 할 일 (월~금) */
    private long child(Cookie c, String name, int level, boolean approval, boolean... required) throws Exception {
        StringBuilder routines = new StringBuilder();
        for (int i = 0; i < required.length; i++) {
            if (i > 0) routines.append(',');
            routines.append("""
                    {"icon":"📖","title":"할 일 %d","amount":"%d장","estimateMin":15,"required":%s,"daysMask":31}""".formatted(i + 1, i + 1, required[i]));
        }
        String res = body(json(post("/api/parent/children").cookie(c), """
                {"requestId":"%s","settings":{"name":"%s","age":8,"level":%d,"uiStyle":"quest","weekdayFreeMin":40,"weekendFreeMin":60,"approvalRequired":%s},
                 "routines":[%s],"addToday":true}""".formatted(UUID.randomUUID(), name, level, approval, routines)));
        return ((Number) JsonPath.read(res, "$.id")).longValue();
    }

    private String today(Cookie c, long child) throws Exception {
        return body(get("/api/children/" + child + "/today").cookie(c));
    }

    private List<Integer> taskIds(Cookie c, long child) throws Exception {
        return JsonPath.read(today(c, child), "$.tasks[*].id");
    }

    private String act(Cookie c, long child, long task, String action) throws Exception {
        return body(post("/api/children/" + child + "/tasks/" + task + "/" + action).cookie(c));
    }

    private String adjust(Cookie c, long child, long task, String jsonBody) throws Exception {
        return body(json(post("/api/parent/children/" + child + "/tasks/" + task + "/adjust").cookie(c), jsonBody));
    }

    // ---------------------------------------------------------------- 권한 · 격리

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mvc.perform(get("/api/family")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 부모_권한은_서버에서_검증한다_PIN_잠금과_복구() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true);
        // 아이 모드로 전환하면 부모 API 는 화면 버튼과 상관없이 서버가 막는다
        mvc.perform(post("/api/auth/pin/lock").cookie(c)).andExpect(jsonPath("$.parentMode").value(false));
        mvc.perform(get("/api/parent/overview").cookie(c)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("PARENT_LOCKED"));
        mvc.perform(post("/api/parent/children/" + kid + "/today/approve").cookie(c)).andExpect(status().isForbidden());
        // 아이 화면 API 는 그대로 쓸 수 있다
        mvc.perform(get("/api/children/" + kid + "/today").cookie(c)).andExpect(status().isOk());

        // 틀린 PIN: 남은 횟수 안내 → 한도에 닿으면 맞는 PIN 도 잠시 거절
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"0000\"}")).andExpect(jsonPath("$.code").value("PIN_WRONG"));
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"0000\"}")).andExpect(jsonPath("$.code").value("PIN_WRONG"));
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"0000\"}")).andExpect(status().isTooManyRequests());
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"1357\"}")).andExpect(jsonPath("$.code").value("PIN_LOCKED"));
        clock.plus(11 * 60);
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"1357\"}")).andExpect(jsonPath("$.parentMode").value(true));
        mvc.perform(get("/api/parent/overview").cookie(c)).andExpect(status().isOk());

        // 오래 쓰지 않으면 부모 모드가 다시 잠긴다
        clock.plus(21 * 60);
        mvc.perform(get("/api/parent/overview").cookie(c)).andExpect(status().isForbidden());

        // PIN 복구는 계정 비밀번호로 본인 확인
        mvc.perform(json(post("/api/auth/pin/reset").cookie(c), "{\"password\":\"wrong-pass\",\"pin\":\"2468\"}")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/pin/reset").cookie(c), "{\"password\":\"parent1234\",\"pin\":\"2468\"}")).andExpect(jsonPath("$.parentMode").value(true));
        mvc.perform(post("/api/auth/pin/lock").cookie(c));
        mvc.perform(json(post("/api/auth/pin/unlock").cookie(c), "{\"pin\":\"2468\"}")).andExpect(status().isOk());
    }

    @Test
    void 다른_가족의_아이는_볼_수도_바꿀_수도_없다() throws Exception {
        Cookie a = family();
        Cookie b = family();
        long kidA = child(a, "시윤", 3, true, true);
        long task = taskIds(a, kidA).get(0);
        mvc.perform(get("/api/children/" + kidA + "/today").cookie(b)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHILD_NOT_FOUND"));
        mvc.perform(post("/api/children/" + kidA + "/tasks/" + task + "/complete").cookie(b)).andExpect(status().isNotFound());
        mvc.perform(get("/api/parent/children/" + kidA + "/routines").cookie(b)).andExpect(status().isNotFound());
        assertThat(body(get("/api/family").cookie(b))).doesNotContain("시윤");
    }

    @Test
    void 두_아이의_데이터가_섞이지_않는다() throws Exception {
        Cookie c = family();
        long young = child(c, "승윤", 2, false, true, true);
        long older = child(c, "시윤", 3, false, true, true, true);
        long t = taskIds(c, young).get(0);
        act(c, young, t, "complete");
        assertThat((Integer) JsonPath.read(today(c, young), "$.progress.done")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(today(c, older), "$.progress.done")).isZero();
        assertThat((Integer) JsonPath.read(today(c, older), "$.progress.total")).isEqualTo(3);
        // 승윤의 할 일 번호로 시윤의 할 일을 바꿀 수 없다
        mvc.perform(post("/api/children/" + older + "/tasks/" + t + "/start").cookie(c)).andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- 반복 · 계획

    @Test
    void 반복은_하루에_한번만_생성되고_요일을_따른다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true, false);
        assertThat(taskIds(c, kid)).hasSize(2);
        assertThat(taskIds(c, kid)).hasSize(2); // 다시 열어도 그대로
        clock.now = ZonedDateTime.of(2026, 10, 10, 9, 0, 0, 0, SEOUL).toInstant(); // 토요일 (월~금 반복)
        String sat = today(c, kid);
        assertThat((List<?>) JsonPath.read(sat, "$.tasks")).isEmpty();
        assertThat((String) JsonPath.read(sat, "$.free.state")).isEqualTo("rest");
    }

    @Test
    void 순서_변경은_저장되고_예상시간은_Lv3부터() throws Exception {
        Cookie c = family();
        long lv2 = child(c, "승윤", 2, true, true, true, true);
        List<Integer> ids = taskIds(c, lv2);
        mvc.perform(json(put("/api/children/" + lv2 + "/today/plan").cookie(c), "{\"order\":[%d,%d,%d]}".formatted(ids.get(2), ids.get(0), ids.get(1))))
                .andExpect(status().isOk());
        assertThat(taskIds(c, lv2)).containsExactly(ids.get(2), ids.get(0), ids.get(1));
        assertThat((Boolean) JsonPath.read(today(c, lv2), "$.planned")).isTrue();
        mvc.perform(json(put("/api/children/" + lv2 + "/today/plan").cookie(c),
                "{\"order\":[],\"estimates\":[{\"taskId\":%d,\"minutes\":30}]}".formatted(ids.get(0)))).andExpect(status().isForbidden());

        long lv3 = child(c, "시윤", 3, true, true);
        long t = taskIds(c, lv3).get(0);
        mvc.perform(json(put("/api/children/" + lv3 + "/today/plan").cookie(c),
                "{\"order\":[%d],\"estimates\":[{\"taskId\":%d,\"minutes\":40}]}".formatted(t, t))).andExpect(jsonPath("$.tasks[0].estimateMin").value(40));
    }

    @Test
    void 오늘만_조정해도_반복_원본은_그대로() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true, true);
        long t = taskIds(c, kid).get(0);
        adjust(c, kid, t, "{\"action\":\"amount\",\"amount\":\"반 장\",\"reason\":\"감기\"}");
        assertThat((String) JsonPath.read(today(c, kid), "$.tasks[0].amount")).isEqualTo("반 장");
        String routines = body(get("/api/parent/children/" + kid + "/routines").cookie(c));
        assertThat((List<String>) JsonPath.read(routines, "$[*].amount")).containsExactly("1장", "2장"); // 원본 분량 그대로
        // 원본을 고치면 다음 생성일부터: 오늘 할 일은 그대로
        long routineId = ((Number) JsonPath.read(routines, "$[1].id")).longValue();
        mvc.perform(json(put("/api/parent/children/" + kid + "/routines/" + routineId).cookie(c),
                "{\"icon\":\"🔢\",\"title\":\"수학\",\"amount\":\"5장\",\"estimateMin\":20,\"required\":true,\"daysMask\":31}")).andExpect(status().isOk());
        assertThat((String) JsonPath.read(today(c, kid), "$.tasks[1].amount")).isEqualTo("2장");
        clock.plus(24 * 3600);
        assertThat((String) JsonPath.read(today(c, kid), "$.tasks[1].amount")).isEqualTo("5장");
    }

    @Test
    void 반복_할_일_저장_재시도는_하나만_만든다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true);
        String req = """
                {"requestId":"same-1","routine":{"icon":"📖","title":"책 읽기","amount":"3권","estimateMin":15,"required":true,"daysMask":127},"addToday":true}""";
        mvc.perform(json(post("/api/parent/children/" + kid + "/routines").cookie(c), req)).andExpect(status().isOk());
        mvc.perform(json(post("/api/parent/children/" + kid + "/routines").cookie(c), req)).andExpect(status().isOk());
        assertThat((List<?>) JsonPath.read(body(get("/api/parent/children/" + kid + "/routines").cookie(c)), "$")).hasSize(1);
        assertThat(taskIds(c, kid)).hasSize(1); // 오늘에도 한 번만 추가
    }

    @Test
    void 반복_할_일_삭제는_다음날부터_시작_안_한_오늘_할_일은_골라서_뺀다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true, true);
        String routines = body(get("/api/parent/children/" + kid + "/routines").cookie(c));
        long r0 = ((Number) JsonPath.read(routines, "$[0].id")).longValue();
        long r1 = ((Number) JsonPath.read(routines, "$[1].id")).longValue();
        act(c, kid, taskIds(c, kid).get(1), "start"); // 두 번째는 이미 시작
        mvc.perform(delete("/api/parent/children/" + kid + "/routines/" + r0 + "?today=true").cookie(c)).andExpect(jsonPath("$.removedToday").value(true));
        mvc.perform(delete("/api/parent/children/" + kid + "/routines/" + r1 + "?today=true").cookie(c)).andExpect(jsonPath("$.removedToday").value(false));
        assertThat(taskIds(c, kid)).hasSize(1); // 시작한 할 일은 기록으로 남음
        assertThat((List<?>) JsonPath.read(body(get("/api/parent/children/" + kid + "/routines").cookie(c)), "$")).isEmpty();
        clock.plus(24 * 3600);
        unlock(c);
        assertThat(taskIds(c, kid)).isEmpty(); // 내일부터는 안 나옴
    }

    // ---------------------------------------------------------------- 타이머

    @Test
    void 타이머는_서버_시간으로_누적되고_재시도_새로고침에_중복_증가하지_않는다() throws Exception {
        Cookie c = family();
        long kid = child(c, "시윤", 3, true, true, true);
        List<Integer> ids = taskIds(c, kid);
        long t = ids.get(0);
        act(c, kid, t, "start");
        clock.plus(100);
        act(c, kid, t, "start"); // 재시도 · 다른 기기에서 다시 누름
        assertThat((Integer) JsonPath.read(today(c, kid), "$.tasks[0].elapsedSec")).isEqualTo(100);
        clock.plus(50);
        act(c, kid, t, "pause");
        clock.plus(1000);
        assertThat((Integer) JsonPath.read(today(c, kid), "$.tasks[0].elapsedSec")).isEqualTo(150);
        // 다시 시작하면 이어서 (초기화 없음)
        act(c, kid, t, "start");
        clock.plus(10);
        assertThat((Integer) JsonPath.read(today(c, kid), "$.tasks[0].elapsedSec")).isEqualTo(160);
        // 한 번에 한 과제: 다른 과제를 시작하면 앞의 과제는 쉬는 중
        act(c, kid, ids.get(1), "start");
        String v = today(c, kid);
        assertThat((String) JsonPath.read(v, "$.tasks[0].status")).isEqualTo("paused");
        assertThat((Boolean) JsonPath.read(v, "$.tasks[1].running")).isTrue();
    }

    @Test
    void 예상시간을_넘겨도_실패가_아니고_완료할_수_있다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, false, true);
        long t = taskIds(c, kid).get(0);
        act(c, kid, t, "start");
        clock.plus(15 * 60 * 3);
        String v = today(c, kid);
        assertThat((String) JsonPath.read(v, "$.tasks[0].status")).isEqualTo("active");
        assertThat((Integer) JsonPath.read(v, "$.tasks[0].elapsedSec")).isEqualTo(2700);
        assertThat((String) JsonPath.read(act(c, kid, t, "complete"), "$.tasks[0].status")).isEqualTo("done");
    }

    @Test
    void 하루_마감에_켜진_타이머는_자정까지만_센다() throws Exception {
        Cookie c = family();
        long kid = child(c, "시윤", 3, true, true);
        long t = taskIds(c, kid).get(0);
        clock.now = ZonedDateTime.of(2026, 10, 7, 23, 59, 0, 0, SEOUL).toInstant();
        act(c, kid, t, "start");
        clock.now = ZonedDateTime.of(2026, 10, 8, 8, 0, 0, 0, SEOUL).toInstant();
        String thursday = today(c, kid);
        assertThat((String) JsonPath.read(thursday, "$.day")).isEqualTo("2026-10-08");
        unlock(c);
        String report = body(get("/api/parent/children/" + kid + "/report?from=2026-10-05").cookie(c));
        assertThat((Boolean) JsonPath.read(report, "$.days[2].recorded")).isTrue();
        // 어제 할 일은 자정(60초)에서 멈춰 있다 (밤새 늘지 않음). 오늘은 새 할 일
        assertThat((Integer) JsonPath.read(report, "$.days[2].studySec")).isEqualTo(60);
        assertThat((Integer) JsonPath.read(thursday, "$.tasks[0].elapsedSec")).isZero();
        clock.plus(3600);
        unlock(c);
        report = body(get("/api/parent/children/" + kid + "/report?from=2026-10-05").cookie(c));
        assertThat((Integer) JsonPath.read(report, "$.days[2].studySec")).isEqualTo(60);
    }

    // ---------------------------------------------------------------- 자유시간

    @Test
    void 선택_할_일이_남아도_필수를_다하면_조건_충족() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, false, true, false);
        long required = taskIds(c, kid).get(0);
        String v = act(c, kid, required, "complete");
        assertThat((String) JsonPath.read(v, "$.free.state")).isEqualTo("available");
        assertThat((Integer) JsonPath.read(v, "$.progress.total")).isEqualTo(1);
    }

    @Test
    void 부모_확인_없이는_완료만으로_이용권이_열리지_않고_발급은_하루_하나() throws Exception {
        Cookie c = family();
        long kid = child(c, "시윤", 3, true, true);
        long t = taskIds(c, kid).get(0);
        assertThat((String) JsonPath.read(act(c, kid, t, "complete"), "$.free.state")).isEqualTo("waiting");
        mvc.perform(post("/api/children/" + kid + "/today/free-pass").cookie(c)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FREE_LOCKED"));
        mvc.perform(post("/api/parent/children/" + kid + "/today/approve").cookie(c)).andExpect(jsonPath("$.free.state").value("available"));
        for (int i = 0; i < 3; i++) { // 연속 클릭 · 재시도
            mvc.perform(post("/api/children/" + kid + "/today/free-pass").cookie(c)).andExpect(jsonPath("$.free.state").value("ready"))
                    .andExpect(jsonPath("$.free.minutes").value(40));
        }
        String report = body(get("/api/parent/children/" + kid + "/report?from=2026-10-05").cookie(c));
        assertThat((Integer) JsonPath.read(report, "$.days[2].freeMinutes")).isEqualTo(40);

        // 이용권 시간은 서버 시계로: 10분 쓰고 멈추면 30분 남음, 새로고침해도 그대로
        mvc.perform(json(post("/api/children/" + kid + "/today/free-pass/start").cookie(c), "{\"activity\":\"🎨 그림\"}"));
        clock.plus(600);
        mvc.perform(post("/api/children/" + kid + "/today/free-pass/pause").cookie(c)).andExpect(jsonPath("$.free.remainingSec").value(1800));
        clock.plus(600);
        assertThat((Integer) JsonPath.read(today(c, kid), "$.free.remainingSec")).isEqualTo(1800);

        // 시작한 뒤 설정을 바꿔도 오늘 이용권에는 소급하지 않는다
        unlock(c);
        mvc.perform(json(put("/api/parent/children/" + kid).cookie(c), """
                {"name":"시윤","age":9,"level":3,"uiStyle":"planner","weekdayFreeMin":90,"weekendFreeMin":60,"approvalRequired":true}"""))
                .andExpect(status().isOk());
        assertThat((Integer) JsonPath.read(today(c, kid), "$.free.minutes")).isEqualTo(40);

        // 완료를 되돌려도 이미 받은 이용권은 회수하지 않는다
        String undone = act(c, kid, t, "undo");
        assertThat((String) JsonPath.read(undone, "$.tasks[0].status")).isNotEqualTo("done");
        assertThat((String) JsonPath.read(undone, "$.free.state")).isEqualTo("paused");

        // 남은 시간을 다 쓰면 끝
        mvc.perform(json(post("/api/children/" + kid + "/today/free-pass/start").cookie(c), "{}"));
        clock.plus(5000);
        assertThat((String) JsonPath.read(today(c, kid), "$.free.state")).isEqualTo("used");
    }

    @Test
    void 아이_테마는_기본_용이고_부모가_바꾸며_테마를_빼고_보내면_그대로다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true);
        assertThat((String) JsonPath.read(today(c, kid), "$.child.theme")).isEqualTo("dragon");
        String settings = "{\"name\":\"승윤\",\"age\":7,\"level\":2,\"uiStyle\":\"quest\",\"weekdayFreeMin\":40,\"weekendFreeMin\":60,\"approvalRequired\":true%s}";
        mvc.perform(json(put("/api/parent/children/" + kid).cookie(c), settings.formatted(",\"theme\":\"capybara\"")))
                .andExpect(jsonPath("$.theme").value("capybara"));
        mvc.perform(json(put("/api/parent/children/" + kid).cookie(c), settings.formatted("")))
                .andExpect(jsonPath("$.theme").value("capybara"));
        mvc.perform(json(put("/api/parent/children/" + kid).cookie(c), settings.formatted(",\"theme\":\"pony\"")))
                .andExpect(status().isBadRequest());
        assertThat((String) JsonPath.read(body(get("/api/family").cookie(c)), "$.children[0].theme")).isEqualTo("capybara");
    }

    @Test
    void 이용권_발급_전_되돌리면_부모_확인을_다시_받는다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true);
        long t = taskIds(c, kid).get(0);
        act(c, kid, t, "complete");
        mvc.perform(post("/api/parent/children/" + kid + "/today/approve").cookie(c)).andExpect(jsonPath("$.free.approved").value(true));
        String v = act(c, kid, t, "undo");
        assertThat((Boolean) JsonPath.read(v, "$.free.approved")).isFalse();
        assertThat((String) JsonPath.read(v, "$.free.state")).isEqualTo("locked");
        mvc.perform(post("/api/parent/children/" + kid + "/today/approve").cookie(c)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_READY"));
    }

    @Test
    void 면제_이동은_완료로_세지_않고_필수가_0개면_자동으로_열지_않는다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, false, true, true);
        List<Integer> ids = taskIds(c, kid);
        adjust(c, kid, ids.get(0), "{\"action\":\"waive\",\"reason\":\"병원\"}");
        String v = adjust(c, kid, ids.get(1), "{\"action\":\"move\"}");
        assertThat((Integer) JsonPath.read(v, "$.progress.done")).isZero();
        assertThat((Integer) JsonPath.read(v, "$.progress.total")).isZero();
        assertThat((String) JsonPath.read(v, "$.tasks[1].movedTo")).isEqualTo("2026-10-08");
        // 부모 확인을 쓰지 않는 아이여도 필수 0개인 날은 자동 지급하지 않는다
        assertThat((String) JsonPath.read(v, "$.free.state")).isEqualTo("rest");
        mvc.perform(post("/api/children/" + kid + "/today/free-pass").cookie(c)).andExpect(status().isConflict());
        mvc.perform(post("/api/children/" + kid + "/today/free-request").cookie(c)).andExpect(jsonPath("$.free.requested").value(true));
        mvc.perform(post("/api/parent/children/" + kid + "/today/approve").cookie(c)).andExpect(jsonPath("$.free.state").value("available"));
        // 같은 이동을 다시 눌러도 내일에는 하나만
        adjust(c, kid, ids.get(1), "{\"action\":\"move\"}");
        String report = body(get("/api/parent/children/" + kid + "/report?from=2026-10-05").cookie(c));
        assertThat((Integer) JsonPath.read(report, "$.days[2].requiredDone")).isZero();
        assertThat((Integer) JsonPath.read(report, "$.days[2].excused")).isEqualTo(2);
        clock.plus(24 * 3600);
        unlock(c);
        List<Boolean> movedIn = JsonPath.read(today(c, kid), "$.tasks[*].movedIn");
        assertThat(movedIn.stream().filter(b -> b).count()).isEqualTo(1);
    }

    // ---------------------------------------------------------------- 도움 · 회고 · 리포트

    @Test
    void 도움_요청은_타이머를_멈추고_같은_할_일에_하나만() throws Exception {
        Cookie c = family();
        long kid = child(c, "시윤", 3, true, true);
        long t = taskIds(c, kid).get(0);
        act(c, kid, t, "start");
        clock.plus(30);
        mvc.perform(json(post("/api/children/" + kid + "/tasks/" + t + "/help").cookie(c), "{\"reason\":\"문제가 이해되지 않아요\"}"));
        String v = body(json(post("/api/children/" + kid + "/tasks/" + t + "/help").cookie(c), "{\"reason\":\"문제가 이해되지 않아요\"}"));
        assertThat((List<?>) JsonPath.read(v, "$.help")).hasSize(1);
        assertThat((Boolean) JsonPath.read(v, "$.tasks[0].running")).isFalse();
        String overview = body(get("/api/parent/overview").cookie(c));
        int helpId = JsonPath.read(overview, "$.children[0].help[0].id");
        mvc.perform(post("/api/parent/children/" + kid + "/help/" + helpId + "/resolve").cookie(c)).andExpect(jsonPath("$.help").isEmpty());
    }

    @Test
    void 아이가_도움_요청을_스스로_거둘_수_있다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true);
        long t = taskIds(c, kid).get(0);
        mvc.perform(json(post("/api/children/" + kid + "/tasks/" + t + "/help").cookie(c), "{\"reason\":\"집중이 안 돼요\"}"))
                .andExpect(jsonPath("$.tasks[0].helpOpen").value(true));
        mvc.perform(post("/api/children/" + kid + "/tasks/" + t + "/help/cancel").cookie(c)).andExpect(jsonPath("$.help").isEmpty())
                .andExpect(jsonPath("$.tasks[0].helpOpen").value(false));
        mvc.perform(post("/api/children/" + kid + "/tasks/" + t + "/help/cancel").cookie(c)).andExpect(status().isOk()); // 다시 눌러도 그대로
        assertThat((List<?>) JsonPath.read(body(get("/api/parent/overview").cookie(c)), "$.children[0].help")).isEmpty();
    }

    @Test
    void 리포트는_실제_기록만_보여준다() throws Exception {
        Cookie c = family();
        long kid = child(c, "승윤", 2, true, true);
        long t = taskIds(c, kid).get(0);
        act(c, kid, t, "complete");
        mvc.perform(json(put("/api/children/" + kid + "/today/review").cookie(c), "{\"mood\":\"good\",\"note\":\"내일은 수학 먼저\"}"));
        String report = body(get("/api/parent/children/" + kid + "/report?from=2026-10-05").cookie(c));
        assertThat((Boolean) JsonPath.read(report, "$.days[0].recorded")).isFalse(); // 월요일: 아직 쓰지 않음
        assertThat((Boolean) JsonPath.read(report, "$.days[2].recorded")).isTrue();
        assertThat((Integer) JsonPath.read(report, "$.days[2].requiredDone")).isEqualTo(1);
        assertThat((String) JsonPath.read(report, "$.days[2].note")).isEqualTo("내일은 수학 먼저");
        assertThat((Boolean) JsonPath.read(report, "$.days[3].recorded")).isFalse(); // 내일
        // 아이 화면 성장 기록에는 메모를 싣지 않는다
        String growth = body(get("/api/children/" + kid + "/growth").cookie(c));
        assertThat((String) JsonPath.read(growth, "$.days[6].mood")).isEqualTo("good");
        assertThat(growth).doesNotContain("내일은 수학 먼저");
    }

    @Test
    void 아이_등록_재시도는_한_명만() throws Exception {
        Cookie c = family();
        String req = """
                {"requestId":"kid-1","settings":{"name":"승윤","age":7,"level":2,"uiStyle":"quest","weekdayFreeMin":40,"weekendFreeMin":60,"approvalRequired":true},"routines":[],"addToday":true}""";
        mvc.perform(json(post("/api/parent/children").cookie(c), req)).andExpect(status().isOk());
        mvc.perform(json(post("/api/parent/children").cookie(c), req)).andExpect(status().isOk());
        assertThat((List<?>) JsonPath.read(body(get("/api/family").cookie(c)), "$.children")).hasSize(1);
    }
}
