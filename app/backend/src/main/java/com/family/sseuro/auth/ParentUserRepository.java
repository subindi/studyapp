package com.family.sseuro.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParentUserRepository extends JpaRepository<ParentUser, Long> {
    Optional<ParentUser> findByEmail(String email);

    boolean existsByEmail(String email);
}
