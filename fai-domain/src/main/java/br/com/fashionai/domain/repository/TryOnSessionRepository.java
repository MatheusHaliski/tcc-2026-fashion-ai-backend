package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.TryOnSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;
import java.util.UUID;

public interface TryOnSessionRepository extends JpaRepository<TryOnSession, UUID> {
    Optional<TryOnSession> findByUserId(UUID userId);

    /** Leitura com trava da linha: a comparação de revisão e a gravação acontecem sem outra plataforma no meio. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TryOnSession> findForUpdateByUserId(UUID userId);
}
