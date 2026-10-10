package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.UserGuide;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserGuideRepository extends JpaRepository<UserGuide, UUID> {
    List<UserGuide> findByUserId(UUID userId);

    Optional<UserGuide> findByUserIdAndGuideKey(UUID userId, String guideKey);
}
