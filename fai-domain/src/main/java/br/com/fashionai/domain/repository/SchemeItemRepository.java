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

/** Repositório Spring Data de SchemeItem (MySQL — fonte da verdade). */
public interface SchemeItemRepository extends JpaRepository<SchemeItem, UUID> {
    List<SchemeItem> findBySchemeIdOrderBySortOrder(UUID schemeId);

    List<SchemeItem> findByWardrobeItemId(UUID wardrobeItemId);

    void deleteBySchemeId(UUID schemeId);

    List<SchemeItem> findBySchemeIdIn(Collection<UUID> schemeIds);

    long countByWardrobeItemId(UUID wardrobeItemId);

    /** RF53 — looks em que várias peças aparecem (selos de marca/celebridade das peças, em lote). */
    List<SchemeItem> findByWardrobeItemIdIn(Collection<UUID> wardrobeItemIds);
}
