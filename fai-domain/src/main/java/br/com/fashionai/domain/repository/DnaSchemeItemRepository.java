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

/** Repositório Spring Data de DnaSchemeItem (MySQL — fonte da verdade). */
public interface DnaSchemeItemRepository extends JpaRepository<DnaSchemeItem, UUID> {
    List<DnaSchemeItem> findByDnaSchemeIdOrderByCell(UUID dnaSchemeId);

    void deleteByDnaSchemeId(UUID dnaSchemeId);

    long countBySchemeId(UUID schemeId);
}
