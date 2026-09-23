package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.StyleDnaVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StyleDnaVersionRepository extends JpaRepository<StyleDnaVersion, UUID> {
    List<StyleDnaVersion> findTop20ByUserIdOrderByCreatedAtDesc(UUID userId);
}
