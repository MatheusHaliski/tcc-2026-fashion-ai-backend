package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de BrandAlias (RF47 · catálogo global). */
public interface BrandAliasRepository extends JpaRepository<BrandAlias, UUID> {
    Optional<BrandAlias> findByAliasNorm(String aliasNorm);

    List<BrandAlias> findByBrandId(UUID brandId);

    List<BrandAlias> findTop20ByAliasNormStartingWith(String prefix);
}
