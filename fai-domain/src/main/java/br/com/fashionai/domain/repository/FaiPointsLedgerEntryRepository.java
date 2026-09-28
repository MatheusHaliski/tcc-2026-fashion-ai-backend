package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FaiPointsLedgerEntryRepository extends JpaRepository<FaiPointsLedgerEntry, UUID> {
    boolean existsByIdempotencyKey(String key);

    List<FaiPointsLedgerEntry> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndActionCodeAndCreatedAtAfter(UUID userId, String actionCode, Instant since);

    @Query("select coalesce(sum(e.delta), 0) from FaiPointsLedgerEntry e where e.userId = :u") long balance(@Param("u") UUID userId);

    @Query("select coalesce(sum(e.delta), 0) from FaiPointsLedgerEntry e where e.userId = :u and e.countsLifetime = true and e.delta > 0") long lifetime(@Param("u") UUID userId);

    /**
     * Trava a linha do dono do saldo (SELECT … FOR UPDATE em users) até o fim da transação: o saldo é uma soma do
     * ledger, então sem essa trava duas compras simultâneas leriam o mesmo saldo e as duas debitariam.
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :u")
    Optional<br.com.fashionai.domain.model.User> lockOwner(@Param("u") UUID userId);
}
