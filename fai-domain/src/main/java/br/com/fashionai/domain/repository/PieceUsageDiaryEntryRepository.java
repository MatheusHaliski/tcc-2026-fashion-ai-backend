package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PieceUsageDiaryEntryRepository extends JpaRepository<PieceUsageDiaryEntry, UUID> {
    List<PieceUsageDiaryEntry> findByWardrobeItemIdOrderByUsedOnDesc(UUID id);

    List<PieceUsageDiaryEntry> findByUserIdAndUsedOnAfter(UUID userId, LocalDate since);

    boolean existsByWardrobeItemIdAndUsedOn(UUID id, LocalDate day);
}
