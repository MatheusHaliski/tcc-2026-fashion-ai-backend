package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de DailyLook (MySQL — fonte da verdade). */
public interface DailyLookRepository extends JpaRepository<DailyLook, UUID> {
    Optional<DailyLook> findByUserIdAndLookDate(UUID userId, LocalDate date);

    Optional<DailyLook> findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(UUID userId, LocalDate date);

    List<DailyLook> findTop30ByUserIdOrderByLookDateDesc(UUID userId);

    List<DailyLook> findByLookDate(LocalDate date);

    long countByUserIdAndFeedback(UUID userId, br.com.fashionai.domain.model.enums.DailyLookFeedback feedback);

    List<DailyLook> findTop60ByUserIdOrderByLookDateDesc(UUID userId);
}
