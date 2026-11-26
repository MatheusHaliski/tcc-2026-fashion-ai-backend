package br.com.fashionai.application.scheme;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeFormWriter {
    private final WardrobeItemRepository pieces;
    private final SchemeItemRepository schemeItems;

    public SchemeFormWriter(WardrobeItemRepository pieces, SchemeItemRepository schemeItems) {
        this.pieces = pieces;
        this.schemeItems = schemeItems;
    }

    void applyForm(Scheme s, SchemeForm f, ClassificationService classification, SchemeThermalWriter thermal) {
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
        if (classification != null) {
            classification.apply(s, f.colecaoId(), f.intensidadeTermicaId());
        }
        if (thermal != null) {
            thermal.apply(s, f.nivelTermicoId(), Boolean.TRUE.equals(f.clearNivelTermico()));
        }
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
            SchemeLayout.place(si, f, order);
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
}
