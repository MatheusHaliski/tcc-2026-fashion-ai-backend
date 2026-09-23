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

/** Repositório Spring Data de AiInferenceLog (MySQL — fonte da verdade). */
public interface AiInferenceLogRepository extends JpaRepository<AiInferenceLog, UUID> {
    List<AiInferenceLog> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndCapabilityAndCreatedAtAfter(UUID userId, String capability, Instant since);

    List<AiInferenceLog> findTop300ByOrderByCreatedAtDesc();

    List<AiInferenceLog> findByCreatedAtBetween(Instant from, Instant to);
}
