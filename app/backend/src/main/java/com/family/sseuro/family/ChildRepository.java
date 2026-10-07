package com.family.sseuro.family;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildRepository extends JpaRepository<Child, Long> {
    List<Child> findByFamilyIdOrderBySortOrderAscIdAsc(long familyId);

    /** 가족 격리: 아이는 항상 가족 번호와 함께 찾는다 */
    Optional<Child> findByIdAndFamilyId(long id, long familyId);

    Optional<Child> findByFamilyIdAndRequestId(long familyId, String requestId);

    long countByFamilyId(long familyId);
}
