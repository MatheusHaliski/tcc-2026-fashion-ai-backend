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

/** Repositório Spring Data de WardrobeItem (MySQL — fonte da verdade). */
public interface WardrobeItemRepository extends JpaRepository<WardrobeItem, UUID> {
    List<WardrobeItem> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Page<WardrobeItem> findByUserId(UUID userId, Pageable pageable);

    long countByUserId(UUID userId);

    List<WardrobeItem> findByUserIdAndDisponivelOrderByCreatedAtDesc(UUID userId, boolean disponivel);

    List<WardrobeItem> findByIdIn(Collection<UUID> ids);

    @Query("select w from WardrobeItem w where w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and w.moderationStatus = br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED and (lower(w.name) like lower(concat('%', :term, '%')) or lower(w.tags) like lower(concat('%', :term, '%')) or lower(w.brandName) like lower(concat('%', :term, '%')))") List<WardrobeItem> searchPublic(@Param("term") String term, Pageable pageable);

    List<WardrobeItem> findByDisponivelTrueAndAvailabilityStatusNot(AvailabilityStatus status);

    List<WardrobeItem> findByPhotoProcessingStatus(PhotoProcessingStatus status);

    List<WardrobeItem> findByUserIdAndUpdatedAtAfter(UUID userId, Instant since);

    @Query("select w from WardrobeItem w where w.user.country = :country and w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC") List<WardrobeItem> findPublicByCountry(@Param("country") String country);

    /**
     * Peças públicas de verdade (vitrines, decks da Casa no FLAIR, busca sem termo): visibilidade pública da peça E do
     * perfil do dono, conta ativa, moderação aprovada e peça não arquivada. Bloqueios dependem de quem vê e são
     * filtrados por quem chama.
     */
    @Query("select w from WardrobeItem w where w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC"
            + " and w.user.profileVisibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC"
            + " and w.user.status = br.com.fashionai.domain.model.enums.AccountStatus.ACTIVE"
            + " and w.moderationStatus = br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED"
            + " and w.availabilityStatus <> br.com.fashionai.domain.model.enums.AvailabilityStatus.ARCHIVED")
    List<WardrobeItem> findAllPublic(Pageable pageable);

    /** RF8 — peças públicas e aprovadas de uma marca do catálogo (aba Marcas da busca). */
    @Query("select count(w) from WardrobeItem w where w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and w.moderationStatus = br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED and lower(w.brandName) = lower(:brand)")
    long countPublicByBrandName(@Param("brand") String brand);

    /** Contagem de visualizações sem passar pela entidade versionada: GETs simultâneos não colidem no @Version. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("update WardrobeItem w set w.viewCount = w.viewCount + :inc, w.lastViewedAt = :now where w.id = :id")
    int touchView(@Param("id") UUID id, @Param("inc") long inc, @Param("now") Instant now);

    List<WardrobeItem> findByBrandId(UUID brandId);

    /** Header do perfil (estilo Instagram): peças no guarda-roupa, sem as arquivadas. */
    long countByUserIdAndAvailabilityStatusNot(UUID userId, AvailabilityStatus status);

    /** RF4 · Estúdio da imagem padrão: reaproveita a foto de estúdio já gerada para o mesmo arquivo de /public/assets_pecas. */
    Optional<WardrobeItem> findFirstByImageUrlAndDefaultImageTrueAndStudioImageUrlIsNotNull(String imageUrl);

    List<WardrobeItem> findTop20ByDefaultImageTrueAndStudioImageUrlIsNull();
}
