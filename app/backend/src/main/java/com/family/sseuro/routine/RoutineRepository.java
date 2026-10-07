package com.family.sseuro.routine;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutineRepository extends JpaRepository<Routine, Long> {
    List<Routine> findByChildIdAndActiveTrueOrderBySortOrderAscIdAsc(long childId);

    Optional<Routine> findByIdAndChildId(long id, long childId);

    Optional<Routine> findByChildIdAndRequestId(long childId, String requestId);

    long countByChildId(long childId);
}
