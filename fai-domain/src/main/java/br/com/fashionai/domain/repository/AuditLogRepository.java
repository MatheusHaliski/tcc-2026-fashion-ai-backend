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

/** Repositório Spring Data de AuditLog (MySQL — fonte da verdade). */
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findTop200ByOrderByTimestampDesc();

    List<AuditLog> findTop100ByActorOrderByTimestampDesc(String actor);

    List<AuditLog> findByActorAndAcaoInOrderByTimestampDesc(String actor, Collection<String> acoes);
}
