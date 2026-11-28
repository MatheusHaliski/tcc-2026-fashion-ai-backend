package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PhysicalStore;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

import br.com.fashionai.domain.model.WardrobeItem;

public interface PhysicalStoreRepository extends JpaRepository<PhysicalStore, UUID> {
    @Query("""
            select s from PhysicalStore s join fetch s.brand b left join fetch s.map m left join fetch b.brandProfile bp
            where (:name = '' or locate(lower(:name), lower(s.name)) > 0)
              and (:brand = '' or locate(lower(:brand), lower(b.name)) > 0)
              and (:region = '' or locate(lower(:region), lower(concat(s.city, ' ', s.region, ' ', s.country))) > 0)
              and (:map = '' or m.slug = :map)
              and (:profile is null or (bp.id = :profile
                   and bp.approvalStatus = br.com.fashionai.domain.model.enums.ApprovalStatus.APROVADO))
            order by s.name, s.id
            """)
    Slice<PhysicalStore> search(@Param("name") String name, @Param("brand") String brand,
                                @Param("region") String region, @Param("map") String map,
                                @Param("profile") UUID profile, Pageable page);
    @Query("""
            select s from PhysicalStore s join fetch s.brand b left join fetch s.map left join fetch b.brandProfile
            where s.id = :store
            """)
    Optional<PhysicalStore> detail(@Param("store") UUID store);

    @Query("""
            select distinct w from WardrobeItem w
            where w.forSale = true and w.user.status = br.com.fashionai.domain.model.enums.AccountStatus.ACTIVE
              and w.availabilityStatus <> br.com.fashionai.domain.model.enums.AvailabilityStatus.ARCHIVED
              and w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC
              and w.moderationStatus = br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED
              and (:status = '' or w.auraMetamorphoseStatus = :status)
              and (:name = '' or locate(lower(:name), lower(w.name)) > 0)
              and (w.expiresAt is null or w.expiresAt > :now or (w.user.profileType <> br.com.fashionai.domain.model.enums.ProfileType.MARCA and w.archiveOnExpiry = false))
              and (:expiry = '' or (:expiry = 'ACTIVE' and (w.expiresAt is null or w.expiresAt > :now))
                   or (:expiry = 'EXPIRED' and w.expiresAt <= :now))
              and (exists (
                  select 1 from PhysicalStore s join s.brand b join b.brandProfile bp left join s.map m
                  where (:store is null or s.id = :store)
                    and (:profile is null or bp.id = :profile)
                    and (:brand = '' or locate(lower(:brand), lower(b.name)) > 0)
                    and (:map = '' or m.slug = :map)
                    and (:region = '' or locate(lower(:region), lower(concat(s.city, ' ', s.region, ' ', s.country))) > 0)
                    and bp.approvalStatus = br.com.fashionai.domain.model.enums.ApprovalStatus.APROVADO
                    and ((w.user.id = bp.owner.id and w.physicalStoreItemId = s.id)
                      or exists (select 1 from MarketplaceNegotiation n where n.storeId = s.id
                           and n.pieceId = w.id and n.status = 'ACCEPTED' and n.expiresAt = w.expiresAt and n.expiresAt > :now))
              ) or (:store is null and :profile is not null and :region = '' and :brand = '' and :map = '' and exists (
                  select 1 from CatalogProduct p join Brand b on b.id = p.brandId
                  where p.managedPiece.id = w.id and b.brandProfile.id = :profile
                    and w.user.id = b.brandProfile.owner.id
              )))
            order by w.name, w.id
            """)
    Slice<WardrobeItem> pieces(@Param("store") UUID store, @Param("profile") UUID profile,
                                @Param("region") String region, @Param("status") String status,
                                @Param("name") String name, @Param("brand") String brand, @Param("map") String map,
                                @Param("expiry") String expiry, @Param("now") java.time.Instant now, Pageable page);

    @Query("""
            select s.id, w from PhysicalStore s join WardrobeItem w on w.physicalStoreItemId = s.id
                join s.brand.brandProfile bp
            where s.map.slug = :map and s.id in :stores and bp.owner.id = w.user.id and w.price > 0
              and bp.approvalStatus = br.com.fashionai.domain.model.enums.ApprovalStatus.APROVADO
              and w.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC
              and w.moderationStatus = br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED
              and w.availabilityStatus <> br.com.fashionai.domain.model.enums.AvailabilityStatus.ARCHIVED
              and w.auraMetamorphoseStatus = 'SPECIAL' and w.forSale = true
              and (w.expiresAt is null or w.expiresAt > :now)
            order by w.price desc, w.id
            """)
    List<Object[]> highlights(@Param("map") String map, @Param("stores") Collection<UUID> stores,
                              @Param("now") java.time.Instant now, Pageable page);
}
