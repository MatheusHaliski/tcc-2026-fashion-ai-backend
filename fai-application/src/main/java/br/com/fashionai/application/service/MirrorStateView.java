package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.accessories;
import static br.com.fashionai.application.service.MirrorSlots.single;
import static br.com.fashionai.application.service.MirrorSlots.rack;
import static br.com.fashionai.application.service.MirrorSlots.putRack;
import static br.com.fashionai.application.service.MirrorSlots.allIds;
import static br.com.fashionai.application.service.MirrorSlots.available;
import static br.com.fashionai.application.service.MirrorSlots.complete;
import static br.com.fashionai.application.service.MirrorSlots.missing;

/**
 * Resposta do estado do espelho: limpa peças apagadas ou de terceiros, monta slots, lista, avisos, ações,
 * silhueta, luz, restrição e os seis números do look (RF53 · P3-07).
 */
final class MirrorStateView {
    private final MirrorStore store;
    private final MirrorStateRepository mirrors;
    private final RoomService room;
    private final StyleDnaRepository dnas;
    private final LookScorer scorer;

    MirrorStateView(MirrorStore store, MirrorStateRepository mirrors, RoomService room, StyleDnaRepository dnas,
                    LookScorer scorer) {
        this.store = store;
        this.mirrors = mirrors;
        this.room = room;
        this.dnas = dnas;
        this.scorer = scorer;
    }

    /** DET-M06 — leitura de silhueta (A, H, V, X) e regra 1/3–2/3, por heurística de subcategorias. */
    static Map<String, Object> silhouette(List<WardrobeItem> look) {
        Set<String> subs = look.stream().map(WardrobeItem::getSubcategory).filter(Objects::nonNull).collect(Collectors.toSet());
        boolean wideLower = subs.stream().anyMatch(Set.of("culottes", "skirt", "cargo_pants", "casual_pants", "sweatpants", "jogger_pants")::contains);
        boolean fittedLower = subs.stream().anyMatch(Set.of("leggings", "jeans", "tailored_pants", "chino_pants", "skort")::contains);
        boolean volUpper = subs.stream().anyMatch(Set.of("hoodie", "coat", "parka", "sweatshirt", "kimono", "jacket", "blazer")::contains);
        boolean fittedUpper = subs.stream().anyMatch(Set.of("tank_top", "crop_top", "top", "bodysuit", "polo_shirt", "t_shirt")::contains);
        boolean dress = subs.stream().anyMatch(Set.of("dress", "jumpsuit", "romper")::contains);
        boolean belt = subs.contains("belt");
        String letter = dress || belt ? "X" : wideLower && fittedUpper ? "A" : volUpper && fittedLower ? "V" : volUpper && wideLower ? "H" : "H";
        String thirds = letter.equals("A") ? Msg.t("mirror.n1_3_em_cima_2") : letter.equals("V")
                ? Msg.t("mirror.n2_3_em_cima_1") : letter.equals("X") ? Msg.t("mirror.cintura_marcada_divide_o_look")
                : Msg.t("mirror.proporcoes_iguais_1_2_1");
        return Map.of("letter", letter, "rule", thirds, "toggle", true);
    }

    Map<String, Object> pieceView(WardrobeItem w, Map<UUID, RoomService.Location> where) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("studioImageUrl", w.getStudioImageUrl());
        // modelagem e dimensões da taxonomia: o espelho veste com o mesmo caimento do provador (classe, comprimentos)
        m.put("variation", w.getVariationCode());
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (w.getAttributes() != null) {
            w.getAttributes().forEach(a -> attrs.computeIfAbsent(a.getDimensionCode(), k -> new ArrayList<>()).add(a.getValueCode()));
        }
        m.put("attributes", attrs);
        m.put("available", available(w));
        m.put("slot", slotOf(w));
        RoomService.Location loc = where.get(w.getId());
        m.put("address", loc == null ? null : loc.address().toString());
        m.put("addressLabel", loc == null ? null : loc.label());
        m.put("moduleId", loc == null ? null : loc.moduleId());
        // estado dos assets da peça (RF16 e foto): o espelho mostra "Modelo 3D", "Foto em processamento" etc. de verdade
        m.put("model3dUrl", w.getModel3dUrl());
        m.put("model3dStatus", w.getModel3dStatus() == null ? null : w.getModel3dStatus().name());
        m.put("photoProcessingStatus", w.getPhotoProcessingStatus() == null ? null : w.getPhotoProcessingStatus().name());
        return m;
    }

    Map<String, Object> state(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        return render(user, s, slots, Map.of());
    }

    Map<String, Object> render(CurrentUser user, MirrorState s, Map<String, Object> slots, Map<String, Object> extra) {
        List<UUID> wantRack = rack(slots);
        List<UUID> toLoad = new ArrayList<>(allIds(slots));
        wantRack.stream().filter(id -> !toLoad.contains(id)).forEach(toLoad::add);
        Map<UUID, WardrobeItem> loaded = store.load(user.id(), toLoad);
        // peças apagadas ou de terceiros somem do espelho
        boolean dirty = false;
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            UUID id = single(slots, slot);
            if (id != null && !loaded.containsKey(id)) {
                slots.remove(slot);
                dirty = true;
            }
        }
        List<UUID> acc = accessories(slots).stream().filter(loaded::containsKey).toList();
        if (acc.size() != accessories(slots).size()) {
            slots.put("accessory", acc.stream().map(UUID::toString).toList());
            dirty = true;
        }
        List<UUID> rackIds = wantRack.stream().filter(loaded::containsKey).toList();
        if (rackIds.size() != wantRack.size()) {
            putRack(slots, rackIds);
            dirty = true;
        }
        if (dirty) {
            s.setSlotsJson(Json.write(slots));
            mirrors.save(s);
        }
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> slotViews = new LinkedHashMap<>();
        for (String slot : List.of("outer_layer", "upper", "dress", "lower", "shoes")) {
            UUID id = single(slots, slot);
            slotViews.put(slot, id == null ? null : pieceView(loaded.get(id), where));
        }
        slotViews.put("accessory", acc.stream().map(id -> pieceView(loaded.get(id), where)).toList());
        out.put("slots", slotViews);
        Set<UUID> worn = new HashSet<>(allIds(slots));
        out.put("rack", rackIds.stream().map(id -> {
            Map<String, Object> v = pieceView(loaded.get(id), where);
            v.put("worn", worn.contains(id));
            return v;
        }).toList());
        out.put("tipoLook", Views.tipoLook(s.getTipoLook()));
        List<WardrobeItem> look = allIds(slots).stream().map(loaded::get).filter(Objects::nonNull).toList();
        boolean complete = complete(slots);
        out.put("complete", complete);
        out.put("missing", missing(slots));
        List<String> warnings = new ArrayList<>();
        for (WardrobeItem w : look) {
            if (!available(w)) {
                warnings.add(Msg.t("mirror.esta_no_cesto_nao_pode", w.getName()));
            }
        }
        out.put("warnings", warnings);
        out.put("origin", slots.getOrDefault("origin", "manual"));
        out.put("prompt", slots.get("prompt"));
        out.put("interpretation", slots.get("interpretation"));
        boolean canTakeOneOff = complete && (!acc.isEmpty() || single(slots, "outer_layer") != null);
        List<String> actions = new ArrayList<>();
        if (complete) {
            actions.addAll(List.of("SALVAR_LOOK", "REMIXAR", "LOOK_DO_DIA", "COMPARTILHAR", "CRIAR_LOOK_COM_ESTAS_PECAS"));
            if (canTakeOneOff) {
                actions.add("TIRA_UMA_COISA");
            }
        } else {
            missing(slots).forEach(m -> actions.add("SUGERIR_" + String.valueOf(m.get("slot")).toUpperCase(Locale.ROOT)));
            if (!look.isEmpty()) {
                actions.add("CRIAR_LOOK_COM_ESTAS_PECAS");
            }
        }
        actions.add("VISTA_ME");
        out.put("actions", actions);
        out.put("silhouette", complete ? silhouette(look) : null);
        out.put("postIt", !complete && !look.isEmpty() ? Msg.t("mirror.faltou_o_look_continua_pendurado", missing(slots).stream().map(m -> switch (String.valueOf(m.get("slot"))) {
            case "shoes" -> "o sapato";
            case "upper" -> Msg.t("mirror.a_peca_de_cima");
            default -> Msg.t("mirror.a_peca_de_baixo");
        }).collect(Collectors.joining(" e "))) : null);
        String colorSeason = dnas.findByUserId(user.id()).map(d -> d.getColorSeason()).orElse(null);
        out.put("light", Map.of("kelvin", colorSeason == null ? 4000 : switch (colorSeason.toUpperCase(Locale.ROOT)) {
            case "PRIMAVERA", "SPRING" -> 3400;
            case "VERAO", "VERÃO", "SUMMER" -> 5600;
            case "OUTONO", "AUTUMN" -> 2900;
            case "INVERNO", "WINTER" -> 6000;
            default -> 4000;
        }, "colorSeason", String.valueOf(colorSeason)));
        out.put("restriction", store.restriction(user.id()).map(r -> Map.of("challenge", r.challengeName(), "allowed", r.allowedPieceIds().size())).orElse(null));
        out.put("shownCount", Json.strings(s.getShownCombinationsJson()).size());
        out.put("scores", lookScores(user.id(), look));
        out.putAll(extra);
        // as ações próprias de uma resposta (Vista-me: OUTRA_SUGESTAO…) somam às do estado do espelho — antes a lista fixa
        // do Vista-me substituía a calculada e "Tira uma coisa" sumia de um look completo com acessório
        if (extra.get("actions") instanceof List<?> own) {
            Set<String> all = new LinkedHashSet<>(actions);
            own.forEach(a -> all.add(String.valueOf(a)));
            out.put("actions", new ArrayList<>(all));
        }
        return out;
    }

    /**
     * RF53 · P3-07 — os seis números do look no espelho ({@link LookScorer}, a mesma régua do Copilot e do Autopiloto):
     * compatibilidade com o DNA, Hype, novidade, reutilização, uso comprovado e sustentabilidade. Só entram as peças do
     * próprio dono (o {@link #load} já descarta as de terceiros), então o Hype é o pessoal dele — a média do v2 das peças,
     * lida do estado gravado: nada é recalculado nem vira sinal de Hype. Sem modo escolhido, nada é reordenado (o Hype não
     * pesa nada aqui; nos modos do Copilot nunca passa de 20%). Dimensão sem base fica nula ("—" na tela, nunca 0);
     * espelho vazio não tem números.
     */
    Map<String, Object> lookScores(UUID userId, List<WardrobeItem> look) {
        if (look.isEmpty()) {
            return null;
        }
        List<RecommendationScoring.Scores> scored = scorer.scoreLooks(userId, List.of(look));
        return scored.isEmpty() ? null : scored.get(0).toMap();
    }
}
