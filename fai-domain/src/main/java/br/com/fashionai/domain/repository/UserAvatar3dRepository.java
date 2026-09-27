package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.UserAvatar3d;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de UserAvatar3d (RF40, MySQL). */
public interface UserAvatar3dRepository extends JpaRepository<UserAvatar3d, UUID> {
    Optional<UserAvatar3d> findByUserId(UUID userId);
}
