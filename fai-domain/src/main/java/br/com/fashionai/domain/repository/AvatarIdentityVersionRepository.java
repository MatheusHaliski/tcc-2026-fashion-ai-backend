package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.AvatarIdentityVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Versões da identidade do avatar (AVATAR-ID I1, MySQL). */
public interface AvatarIdentityVersionRepository extends JpaRepository<AvatarIdentityVersion, UUID> {
    List<AvatarIdentityVersion> findByUserIdOrderByVersionNoDesc(UUID userId);

    Optional<AvatarIdentityVersion> findByUserIdAndVersionNo(UUID userId, int versionNo);
}
