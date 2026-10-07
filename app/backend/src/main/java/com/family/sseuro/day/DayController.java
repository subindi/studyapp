package com.family.sseuro.day;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.day.DayDtos.AdjustRequest;
import com.family.sseuro.day.DayDtos.DayView;
import com.family.sseuro.day.DayDtos.FreeStartRequest;
import com.family.sseuro.day.DayDtos.HelpRequestBody;
import com.family.sseuro.day.DayDtos.Overview;
import com.family.sseuro.day.DayDtos.PlanRequest;
import com.family.sseuro.day.DayDtos.Report;
import com.family.sseuro.day.DayDtos.ReviewRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 아이 화면 API (/api/children/**): 로그인한 가족 기기면 아이 모드에서도 쓸 수 있다.
 * 부모 화면 API (/api/parent/**): 부모 모드(PIN 확인)가 열린 세션만.
 */
@RestController
public class DayController {
    private final DayActions actions;
    private final ReportService reports;

    public DayController(DayActions actions, ReportService reports) {
        this.actions = actions;
        this.reports = reports;
    }

    @GetMapping("/api/children/{childId}/today")
    public DayView today(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return actions.today(me, childId);
    }

    @PutMapping(path = "/api/children/{childId}/today/plan", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DayView plan(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @Valid @RequestBody PlanRequest body) {
        return actions.plan(me, childId, body);
    }

    @PostMapping("/api/children/{childId}/tasks/{taskId}/start")
    public DayView start(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId) {
        return actions.start(me, childId, taskId);
    }

    @PostMapping("/api/children/{childId}/tasks/{taskId}/pause")
    public DayView pause(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId) {
        return actions.pause(me, childId, taskId);
    }

    @PostMapping("/api/children/{childId}/tasks/{taskId}/complete")
    public DayView complete(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId) {
        return actions.complete(me, childId, taskId);
    }

    @PostMapping("/api/children/{childId}/tasks/{taskId}/undo")
    public DayView undo(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId) {
        return actions.undo(me, childId, taskId);
    }

    @PostMapping(path = "/api/children/{childId}/tasks/{taskId}/help", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DayView help(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId,
                        @Valid @RequestBody HelpRequestBody body) {
        return actions.help(me, childId, taskId, body.reason());
    }

    @PostMapping("/api/children/{childId}/today/free-pass")
    public DayView issuePass(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return actions.issuePass(me, childId);
    }

    @PostMapping(path = "/api/children/{childId}/today/free-pass/start", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DayView startPass(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @Valid @RequestBody FreeStartRequest body) {
        return actions.startPass(me, childId, body.activity());
    }

    @PostMapping("/api/children/{childId}/today/free-pass/pause")
    public DayView pausePass(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return actions.pausePass(me, childId);
    }

    @PostMapping("/api/children/{childId}/today/free-request")
    public DayView requestFree(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return actions.requestFree(me, childId);
    }

    @PutMapping(path = "/api/children/{childId}/today/review", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DayView review(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @Valid @RequestBody ReviewRequest body) {
        return actions.review(me, childId, body.mood(), body.note());
    }

    /** 아이의 '나의 성장': 최근 7일 실제 기록 (메모는 빼고) */
    @GetMapping("/api/children/{childId}/growth")
    public Report growth(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return reports.week(me, childId, null, false);
    }

    // ---------------------------------------------------------------- 부모

    @GetMapping("/api/parent/overview")
    public Overview overview(@AuthenticationPrincipal AuthUser me) {
        return actions.overview(me);
    }

    @PostMapping(path = "/api/parent/children/{childId}/tasks/{taskId}/adjust", consumes = MediaType.APPLICATION_JSON_VALUE)
    public DayView adjust(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long taskId,
                          @Valid @RequestBody AdjustRequest body) {
        return actions.adjust(me, childId, taskId, body);
    }

    @PostMapping("/api/parent/children/{childId}/today/approve")
    public DayView approve(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return actions.approve(me, childId);
    }

    @PostMapping("/api/parent/children/{childId}/help/{helpId}/resolve")
    public DayView resolveHelp(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long helpId) {
        return actions.resolveHelp(me, childId, helpId);
    }

    /** 부모 리포트: from(yyyy-MM-dd) 부터 7일, 없으면 이번 주 월요일부터 */
    @GetMapping("/api/parent/children/{childId}/report")
    public Report report(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @RequestParam(required = false) String from) {
        return reports.week(me, childId, from, true);
    }
}
