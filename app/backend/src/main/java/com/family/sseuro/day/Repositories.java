package com.family.sseuro.day;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByChildIdAndDayOrderBySortOrderAscIdAsc(long childId, LocalDate day);

    List<Task> findByChildIdAndDayBetween(long childId, LocalDate from, LocalDate to);

    Optional<Task> findByIdAndChildId(long id, long childId);

    Optional<Task> findByOriginTaskId(long originTaskId);

    Optional<Task> findByChildIdAndRequestId(long childId, String requestId);

    boolean existsByChildIdAndDayAndRoutineId(long childId, LocalDate day, long routineId);

    Optional<Task> findByChildIdAndDayAndRoutineId(long childId, LocalDate day, long routineId);

    /** 지난 날에 진행 중으로 남은 타이머 (하루 마감 처리용) */
    List<Task> findByChildIdAndDayBeforeAndRunningSinceIsNotNull(long childId, LocalDate day);

    @Query("select coalesce(max(t.sortOrder), 0) from Task t where t.childId = :childId and t.day = :day")
    int maxOrder(long childId, LocalDate day);
}

interface DayRecordRepository extends JpaRepository<DayRecord, Long> {
    Optional<DayRecord> findByChildIdAndDay(long childId, LocalDate day);

    boolean existsByChildIdAndDay(long childId, LocalDate day);

    /** MySQL · H2(MySQL 모드) 공통. 이미 있으면 아무것도 하지 않는다 */
    @Modifying
    @Query(value = "insert ignore into ss_day_record (child_id, activity_day, routines_generated, planned) values (:childId, :day, false, false)", nativeQuery = true)
    void insertIgnore(long childId, LocalDate day);

    /** 그날의 변경을 한 줄로 세우는 행 잠금 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DayRecord d where d.childId = :childId and d.day = :day")
    Optional<DayRecord> lock(long childId, LocalDate day);

    List<DayRecord> findByChildIdAndDayBetween(long childId, LocalDate from, LocalDate to);
}

interface FreePassRepository extends JpaRepository<FreePass, Long> {
    Optional<FreePass> findByChildIdAndDay(long childId, LocalDate day);

    List<FreePass> findByChildIdAndDayBeforeAndStatusNot(long childId, LocalDate day, String status);

    List<FreePass> findByChildIdAndDayBetween(long childId, LocalDate from, LocalDate to);
}

interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {
    List<HelpRequest> findByChildIdAndStatusOrderByIdAsc(long childId, String status);

    Optional<HelpRequest> findFirstByTaskIdAndStatus(long taskId, String status);

    List<HelpRequest> findByChildIdInAndStatusOrderByIdAsc(Collection<Long> childIds, String status);
}

interface ReviewRepository extends JpaRepository<Review, Review.Key> {
    List<Review> findByKeyChildIdAndKeyDayBetween(long childId, LocalDate from, LocalDate to);
}
