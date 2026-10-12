package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.RoomStorageEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomStorageEntryRepository extends JpaRepository<RoomStorageEntry, UUID> {
    List<RoomStorageEntry> findByUserId(UUID userId);

    Optional<RoomStorageEntry> findByWardrobeItemId(UUID wardrobeItemId);

    /** Used only after the atomic insert, never to lock an empty index range before inserting. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<RoomStorageEntry> findFirstByWardrobeItemId(UUID wardrobeItemId);

    /** Atomic first assignment; a concurrent request keeps the winning address instead of breaking its transaction. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO room_storage_map
                (id, user_id, wardrobe_item_id, address, assigned_by, created_at, updated_at)
            VALUES (:id, :userId, :pieceId, :address, 'AUTO', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE wardrobe_item_id = room_storage_map.wardrobe_item_id
            """, nativeQuery = true)
    int insertAutomaticIfAbsent(@Param("id") String id, @Param("userId") String userId,
                                @Param("pieceId") String pieceId, @Param("address") String address);

    void deleteByWardrobeItemId(UUID wardrobeItemId);
}
