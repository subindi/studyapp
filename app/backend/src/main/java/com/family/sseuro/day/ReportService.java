package com.family.sseuro.day;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.common.ApiException;
import com.family.sseuro.common.TimeService;
import com.family.sseuro.day.DayDtos.DaySummary;
import com.family.sseuro.day.DayDtos.Report;
import com.family.sseuro.family.Child;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 성장 리포트: 실제로 저장된 기록만 보여 준다 (기록 없는 날은 recorded=false, 예시 숫자 없음).
 * 형제 비교 · 순위 · 연속 기록은 만들지 않는다.
 */
@Service
public class ReportService {
    private final DayService d;
    private final TimeService time;

    public ReportService(DayService d, TimeService time) {
        this.d = d;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public Report week(AuthUser me, long childId, String fromParam, boolean withNotes) {
        Child child = d.child(me, childId);
        LocalDate from;
        if (fromParam == null || fromParam.isBlank()) {
            from = withNotes ? time.today().with(DayOfWeek.MONDAY) : time.today().minusDays(6);
        } else {
            try {
                from = LocalDate.parse(fromParam);
            } catch (DateTimeParseException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "날짜 형식을 확인해 주세요");
            }
        }
        LocalDate to = from.plusDays(6);
        Map<LocalDate, List<Task>> tasksByDay = d.tasks.findByChildIdAndDayBetween(child.getId(), from, to).stream()
                .collect(Collectors.groupingBy(Task::getDay));
        Map<LocalDate, DayRecord> recs = d.days.findByChildIdAndDayBetween(child.getId(), from, to).stream()
                .collect(Collectors.toMap(DayRecord::getDay, Function.identity()));
        Map<LocalDate, FreePass> passes = d.passes.findByChildIdAndDayBetween(child.getId(), from, to).stream()
                .collect(Collectors.toMap(FreePass::getDay, Function.identity()));
        Map<LocalDate, Review> reviews = d.reviews.findByKeyChildIdAndKeyDayBetween(child.getId(), from, to).stream()
                .collect(Collectors.toMap(Review::getDay, Function.identity()));
        List<DaySummary> out = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DayRecord rec = recs.get(day);
            List<Task> list = tasksByDay.getOrDefault(day, List.of());
            Review review = reviews.get(day);
            FreePass pass = passes.get(day);
            boolean recorded = rec != null && rec.isGenerated() && !day.isAfter(time.today());
            DayService.Condition c = DayService.condition(list);
            int excused = (int) list.stream().filter(Task::isExcused).count();
            int studySec = list.stream().mapToInt(Task::getElapsedSec).sum(); // 멈춘 시점까지 쌓인 실제 시간
            out.add(new DaySummary(day.toString(), recorded, c.done(), c.total(), c.optionalDone(), excused, studySec,
                    rec != null && rec.isPlanned(), rec != null && rec.isApproved(),
                    pass == null ? 0 : pass.getMinutes(),
                    review == null ? null : review.getMood(),
                    withNotes && review != null ? review.getNote() : null));
        }
        return new Report(DayService.childDto(child), from.toString(), to.toString(), out);
    }
}
