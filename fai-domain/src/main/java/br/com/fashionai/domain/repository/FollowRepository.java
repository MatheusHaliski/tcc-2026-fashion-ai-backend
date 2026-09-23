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

/** Repositório Spring Data de Follow (MySQL — fonte da verdade). */
public interface FollowRepository extends JpaRepository<Follow, UUID> {
    Optional<Follow> findByFollowerIdAndFollowingId(UUID followerId, UUID followingId);

    List<Follow> findByFollowingIdAndStatus(UUID followingId, FollowStatus status);

    List<Follow> findByFollowerIdAndStatus(UUID followerId, FollowStatus status);

    long countByFollowingIdAndStatus(UUID followingId, FollowStatus status);

    long countByFollowerIdAndStatus(UUID followerId, FollowStatus status);
}
