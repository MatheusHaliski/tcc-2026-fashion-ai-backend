package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeOrigin;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * RF19.CA13 — Prototype do remix: o look de origem é o protótipo copiado para um <em>rascunho</em> com nova identidade.
 * Copia só o que é do arranjo (texto, ocasião, estilo, estação, humor, layout por peça, fundo e pele do card) e marca a
 * origem ({@code remixedFromId}, {@code REMIX}); nunca copia id JPA, autoria, visibilidade, status, tags nem selos —
 * esses nascem no salvamento ({@link SchemeService#create}) com as regras de permissão de quem remixa.
 * <p>
 * Cada peça da origem é trocada pela peça mais parecida do acervo de quem remixa (limiar {@link #MATCH_THRESHOLD}),
 * sem repetir peça; quem remixa o próprio look reaproveita as mesmas peças. Puro: sem repositório, Spring ou relógio.
 */
final class SchemeRemixPrototype {
    /** Similaridade mínima para trocar a peça da origem por uma do acervo (subcategoria igual, ou categoria + cor). */
    static final double MATCH_THRESHOLD = 1.0;

    /** Peças da origem já trocadas pelas do acervo (formulário pronto) e as que ficaram sem par. */
    record PieceMapping(List<SchemeService.ItemForm> items, List<Map<String, Object>> missing) {
    }

    private SchemeRemixPrototype() {
    }

    /**
     * Troca cada peça da origem pela mais parecida entre {@code candidates} (na ordem dada; em empate fica a primeira),
     * copiando slot, ordem e layout. {@code ownLook} = quem remixa é o autor: a peça original é mantida.
     */
    static PieceMapping mapPieces(List<SchemeItem> sourceItems, List<WardrobeItem> candidates, boolean ownLook) {
        List<SchemeService.ItemForm> mapped = new ArrayList<>();
        List<Map<String, Object>> missing = new ArrayList<>();
        Set<UUID> used = new HashSet<>();
        for (SchemeItem si : sourceItems) {
            WardrobeItem target = si.getWardrobeItem();
            WardrobeItem match = ownLook ? target : candidates.stream()
                    .filter(w -> !used.contains(w.getId()))
                    .max(Comparator.comparingDouble(w -> similarity(w, target)))
                    .filter(w -> similarity(w, target) >= MATCH_THRESHOLD).orElse(null);
            if (match != null) {
                used.add(match.getId());
                mapped.add(new SchemeService.ItemForm(match.getId(), si.getSlot(), si.getSortOrder(), si.getZIndex(), si.getPositionX(),
                        si.getPositionY(), si.getScale(), si.getRotation(), si.getOpacity(), Json.map(si.getFiltersJson())));
            } else {
                missing.add(Map.of("sourcePiece", Views.row(si), "action", Msg.t("scheme.adicionar_ao_guarda_roupa_ou")));
            }
        }
        return new PieceMapping(mapped, missing);
    }

    /** Rascunho do remix, na ordem de chaves que o editor ({@code /create-look?remix=}) consome. */
    static Map<String, Object> prefill(Scheme source, List<SchemeService.ItemForm> items) {
        Map<String, Object> prefill = new LinkedHashMap<>();
        prefill.put("title", Msg.t("scheme.remix_de", source.getTitle()));
        prefill.put("description", source.getDescription());
        prefill.put("occasion", Json.csv(source.getOccasion()));
        prefill.put("style", Json.csv(source.getStyle()));
        prefill.put("season", source.getSeason());
        prefill.put("mood", source.getMood());
        prefill.put("items", items);
        prefill.put("background", Json.map(source.getStudioConfigJson()));
        prefill.put("cardSkin", source.getCardSkin());
        prefill.put("remixedFromId", source.getId());
        prefill.put("origin", SchemeOrigin.REMIX);
        return prefill;
    }

    /** Subcategoria igual = 1; senão categoria igual = 0,5. Cor igual soma 0,5; mesma família de cor soma 0,25. */
    static double similarity(WardrobeItem a, WardrobeItem b) {
        double s = 0;
        if (Objects.equals(a.getSubcategory(), b.getSubcategory())) {
            s += 1;
        } else if (Objects.equals(a.getCategory(), b.getCategory())) {
            s += 0.5;
        }
        if (Objects.equals(a.getColor(), b.getColor())) {
            s += 0.5;
        } else if (Objects.equals(Taxonomy.COLOR_FAMILY.get(a.getColor()), Taxonomy.COLOR_FAMILY.get(b.getColor()))) {
            s += 0.25;
        }
        return s;
    }
}
