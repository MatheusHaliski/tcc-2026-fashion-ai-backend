package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageFilters;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SchemeService.ItemForm;
import br.com.fashionai.application.service.SchemeService.SchemeForm;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Gravação do look a partir do formulário (RF5.CA03/CA05/CA06, RF9): campos validados, peças do acervo real com
 * posição/escala/filtros por item e a publicação com o snapshot das peças (RF7.CA03).
 */
final class SchemeFormWriter {
    private final WardrobeItemRepository pieces;
    private final SchemeItemRepository schemeItems;
    private final ProjectionService projections;

    SchemeFormWriter(WardrobeItemRepository pieces, SchemeItemRepository schemeItems, ProjectionService projections) {
        this.pieces = pieces;
        this.schemeItems = schemeItems;
        this.projections = projections;
    }

    void applyForm(Scheme s, SchemeForm f) {
        s.setTitle(InputSanitizer.required("title", InputSanitizer.moderated("title", f.title(), 120), 2, 120));
        s.setDescription(InputSanitizer.moderated("description", f.description(), 1000));
        Map<String, Object> errors = new LinkedHashMap<>();
        Taxonomy.requireTags("occasion", f.occasion(), Taxonomy.OCCASIONS, 3, errors);
        Taxonomy.requireTags("style", f.style(), Taxonomy.STYLES, 3, errors);
        if (f.seals() != null && f.seals().size() > 4) {
            errors.put("seals", Msg.t("scheme.maximo_de_4_selos_sugeridos"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        s.setOccasion(Json.csv(f.occasion()));
        s.setStyle(Json.csv(f.style()));
        s.setSeason(f.season());
        s.setMood(f.mood());
        if (f.displayMode() != null) {
            s.setDisplayMode(f.displayMode());
        }
        if (f.cardSkin() != null) {
            s.setCardSkin(f.cardSkin());
        }
        if (f.layoutAnatomy() != null) {
            s.setLayoutAnatomy(f.layoutAnatomy());
        }
        s.setTags(Json.csv(f.tags() == null ? List.of() : f.tags().stream().map(t -> t.replaceFirst("^#", "")).toList()));
        if (f.lookDoDia() != null) {
            s.setLookDoDia(f.lookDoDia());
        }
    }

    List<SchemeItem> replaceItems(CurrentUser user, Scheme s, List<ItemForm> forms) {
        Map<UUID, WardrobeItem> own = new LinkedHashMap<>();
        for (ItemForm f : forms) {
            if (f.wardrobeItemId() == null) {
                throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), Map.of("items", Msg.t("scheme.cada_item_precisa_de_wardrobeitemid")));
            }
            WardrobeItem w = pieces.findById(f.wardrobeItemId()).orElseThrow(() -> ApiException.notFound(Msg.t("scheme.peca", f.wardrobeItemId())));
            if (!w.getUser().getId().equals(user.id())) {
                // RF5.CA07b / RF30.CA02 — só peças do acervo real do usuário.
                throw ApiException.badRequest("PECA_DE_OUTRO_USUARIO", Msg.t("scheme.use_apenas_pecas_do_seu"));
            }
            if (!w.isDisponivel()) {
                throw ApiException.badRequest("PECA_INDISPONIVEL", Msg.t("scheme.a_peca_esta_marcada_como", w.getName()));
            }
            own.put(w.getId(), w);
        }
        List<SchemeItem> existing = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        Map<UUID, SchemeItem> byPiece = existing.stream().collect(Collectors.toMap(si -> si.getWardrobeItem().getId(), si -> si, (a, b) -> a));
        List<SchemeItem> result = new ArrayList<>();
        int order = 0;
        Set<UUID> kept = new HashSet<>();
        for (ItemForm f : forms) {
            WardrobeItem w = own.get(f.wardrobeItemId());
            if (!kept.add(w.getId())) {
                continue;
            }
            SchemeItem si = byPiece.getOrDefault(w.getId(), new SchemeItem());
            boolean created = si.getId() == null;
            si.setScheme(s);
            si.setWardrobeItem(w);
            si.setSlot(f.slot() != null ? f.slot() : LocalSchemeComposer.slotOf(w));
            si.setTryOnLayer(MannequinGeometry.layerOf(si.getSlot()));
            si.setSortOrder(f.sortOrder() == null ? order : f.sortOrder());
            si.setZIndex(f.zIndex() == null ? order : f.zIndex());
            si.setPositionX(f.positionX());
            si.setPositionY(f.positionY());
            si.setScale(f.scale() == null ? BigDecimal.ONE : f.scale());
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : f.rotation());
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : f.opacity());
            ImageFilters.Filters filters = ImageFilters.Filters.of(f.filters());
            si.setFiltersJson(filters.neutral() ? null : Json.write(Map.of("blur", filters.blur(), "saturation", filters.saturation(),
                    "brightness", filters.brightness(), "contrast", filters.contrast(), "hue_shift", filters.hueShift())));
            schemeItems.save(si);
            if (created) {
                w.setSchemeUsageCount(w.getSchemeUsageCount() + 1);
            }
            result.add(si);
            order++;
        }
        for (SchemeItem old : existing) {
            if (!kept.contains(old.getWardrobeItem().getId())) {
                // RF9.CA02 — remover do esquema não remove do Closet.
                schemeItems.delete(old);
            }
        }
        s.setTotalPrice(result.stream().map(si -> si.getWardrobeItem().getPrice()).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        if (s.getCoverImageUrl() == null && !result.isEmpty()) {
            s.setCoverImageUrl(result.get(0).getWardrobeItem().getImageUrl());
        }
        // selos nunca são rótulos automáticos por preço/material: só vínculos com marca ou celebridade (RF20/RF21)
        return result;
    }

    void publishInternal(Scheme s, List<SchemeItem> items) {
        s.setStatus(SchemeStatus.PUBLISHED);
        if (s.getPublishedAt() == null) {
            s.setPublishedAt(Instant.now());
        }
        s.setCommunityIndexed(s.getVisibility() == Visibility.PUBLIC);
        for (SchemeItem si : items) {
            // RF7.CA03 — snapshot da peça no momento da publicação.
            si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
        }
        projections.published(s);
    }
}
