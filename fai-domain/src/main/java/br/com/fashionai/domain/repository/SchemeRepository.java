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

/** Repositório Spring Data de Scheme (MySQL — fonte da verdade). */
public interface SchemeRepository extends JpaRepository<Scheme, UUID> {
    List<Scheme> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Page<Scheme> findByUserId(UUID userId, Pageable pageable);

    long countByUserId(UUID userId);

    List<Scheme> findByUserIdAndStatusNotOrderByCreatedAtDesc(UUID userId, SchemeStatus status);

    List<Scheme> findByIdIn(Collection<UUID> ids);

    @Query("select s from Scheme s where s.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and s.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED and (lower(s.title) like lower(concat('%', :term, '%')) or lower(s.description) like lower(concat('%', :term, '%')) or lower(s.tags) like lower(concat('%', :term, '%')))") List<Scheme> searchPublic(@Param("term") String term, Pageable pageable);

    @Query("select s from Scheme s where s.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and s.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED order by s.publishedAt desc") List<Scheme> findPublicFeed(Pageable pageable);

    @Query("select s from Scheme s where s.user.id in :userIds and s.visibility <> br.com.fashionai.domain.model.enums.Visibility.PRIVATE and s.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED order by s.publishedAt desc") List<Scheme> findFeedForFollowing(@Param("userIds") Collection<UUID> userIds, Pageable pageable);

    List<Scheme> findByDisponivelTrueAndStatusNot(SchemeStatus status);

    List<Scheme> findByUpdatedAtAfter(Instant since);

    @Query("select s from Scheme s where s.user.country = :country and s.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and s.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED") List<Scheme> findPublicByCountry(@Param("country") String country);

    @Query("select s from Scheme s where s.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and s.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED") List<Scheme> findAllPublic(Pageable pageable);

    List<Scheme> findByOriginalSchemeId(UUID originalSchemeId);

    List<Scheme> findByUserIdAndFavoriteTrue(UUID userId);

    long countByUserIdAndStatus(UUID userId, br.com.fashionai.domain.model.enums.SchemeStatus status);
}
