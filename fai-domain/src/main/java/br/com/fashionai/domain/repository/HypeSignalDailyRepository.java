package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.HypeSignalDaily;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** HypeScore v2 — agregado diário de sinais (EntityInteractionAggregate). */
public interface HypeSignalDailyRepository extends JpaRepository<HypeSignalDaily, UUID> {
    List<HypeSignalDaily> findByEntityTypeAndSignalDateGreaterThanEqual(HypeEntityType entityType, LocalDate since);

    List<HypeSignalDaily> findByEntityTypeAndEntityIdAndSignalDateGreaterThanEqual(HypeEntityType entityType, UUID entityId, LocalDate since);

    /** Soma 1 evento (e o peso) ao dia do sinal, criando a linha na primeira vez — atômico no MySQL (sem corrida). */
    @Modifying
    @Query(value = "INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at) "
            + "VALUES (:id, :entityType, :entityId, :signalType, :day, 1, :weight, :now) "
            + "ON DUPLICATE KEY UPDATE event_count = event_count + 1, weighted_count = weighted_count + :weight, updated_at = :now",
            nativeQuery = true)
    int increment(@Param("id") String id, @Param("entityType") String entityType, @Param("entityId") String entityId,
                  @Param("signalType") String signalType, @Param("day") LocalDate day, @Param("weight") BigDecimal weight,
                  @Param("now") Instant now);
}
