package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.BrandLogo;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Cache de logos de marca encontrados na internet (V12). */
public interface BrandLogoRepository extends JpaRepository<BrandLogo, UUID> {
    Optional<BrandLogo> findByNameKey(String nameKey);

    List<BrandLogo> findByNameKeyIn(Collection<String> nameKeys);

    List<BrandLogo> findByStatusAndCheckedAtBeforeOrderByCheckedAt(String status, Instant before, Pageable page);

    List<BrandLogo> findAllByOrderByDisplayName();
}
