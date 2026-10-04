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

/** Repositório Spring Data de CelebrityProfile (MySQL — fonte da verdade). */
public interface CelebrityProfileRepository extends JpaRepository<CelebrityProfile, UUID> {
    Optional<CelebrityProfile> findByOwnerId(UUID ownerId);

    Optional<CelebrityProfile> findBySlug(String slug);

    boolean existsByAvatarUrlEndingWithOrIdentityProofUrlEndingWith(String avatarSuffix, String proofSuffix);

    List<CelebrityProfile> findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus status);

    List<CelebrityProfile> findTop100ByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus status);

    /** Política de verificação: já existe outro perfil oficial (aprovado) com este nome artístico? */
    boolean existsByStageNameIgnoreCaseAndVerificationStatusAndOwner_IdNot(String stageName, ApprovalStatus status, UUID ownerId);
}
