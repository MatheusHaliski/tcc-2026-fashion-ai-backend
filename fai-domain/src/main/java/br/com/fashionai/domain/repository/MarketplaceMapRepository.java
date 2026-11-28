package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MarketplaceMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MarketplaceMapRepository extends JpaRepository<MarketplaceMap, UUID> {
    List<MarketplaceMap> findAllByOrderByNameAsc();
}
