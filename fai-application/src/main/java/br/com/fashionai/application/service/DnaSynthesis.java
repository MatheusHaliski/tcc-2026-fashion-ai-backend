package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.local.LocalDnaSynthesizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.StyleDnaVersion;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.StyleDnaVersionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Cálculo do DNA de Estilo (Camada 1): pré-requisitos, síntese (arquétipo, paleta, silhueta, ousadia em
 * percentil, peça ícone), geração na primeira visita e versões (snapshots).
 */
final class DnaSynthesis {
    static final Set<String> BASIC_ACCESSORIES = Set.of("socks", "belt", "hair_accessory", "gloves", "beanie");

    private final StyleDnaRepository dnas;
    private final StyleDnaVersionRepository versions;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final UserRepository users;
    private final AiEngine ai;
    private final DnaIdentityPhrase identityPhrase;

    DnaSynthesis(StyleDnaRepository dnas, StyleDnaVersionRepository versions, WardrobeItemRepository pieces, SchemeRepository schemes,
                 SchemeItemRepository schemeItems, DailyLookRepository dailyLooks, UserRepository users, AiEngine ai, DnaIdentityPhrase identityPhrase) {
        this.dnas = dnas;
        this.versions = versions;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.users = users;
        this.ai = ai;
        this.identityPhrase = identityPhrase;
    }

    // ================================================================== pré-requisitos (CA01/CA02)
    long positiveFeedbacks(UUID userId) {
        return dailyLooks.countByUserIdAndFeedback(userId, DailyLookFeedback.ADOREI);
    }

    long activePieces(UUID userId) {
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).count();
    }

    int interactions(UUID userId) {
        return (int) (schemes.countByUserId(userId) + dailyLooks.findTop60ByUserIdOrderByLookDateDesc(userId).stream().filter(d -> d.getFeedback() != null).count()
                + activePieces(userId));
    }

    /** DNA sintetizado do usuário; na primeira vez é gerado na hora (só Camada 1), sem pré-requisitos. */
    StyleDna ensureDna(CurrentUser user) {
        Optional<StyleDna> found = dnas.findByUserId(user.id());
        if (found.isPresent() && found.get().getSynthesizedAt() != null) {
            return found.get();
        }
        StyleDna d = found.orElseGet(() -> new StyleDna(users.findById(user.id()).orElseThrow()));
        dnas.save(d);
        synthesize(user, d, true, "GERACAO");
        return d;
    }

    void synthesize(CurrentUser user, StyleDna d, boolean regeneratePhrase, String reason) {
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        Map<UUID, List<SchemeItem>> itemsBy = own.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(own.stream().map(Scheme::getId).toList()).stream()
                .collect(Collectors.groupingBy(si -> si.getScheme().getId()));
        // looks aprovados (feedback "adorei") pesam em dobro na síntese (HU20 — principal fonte de sinal)
        Set<UUID> loved = dailyLooks.findTop60ByUserIdOrderByLookDateDesc(user.id()).stream().filter(dl -> dl.getFeedback() == DailyLookFeedback.ADOREI)
                .map(dl -> dl.getScheme().getId()).collect(Collectors.toSet());
        List<Scheme> weighted = new ArrayList<>(own);
        own.stream().filter(s -> loved.contains(s.getId())).forEach(weighted::add);
        List<WardrobeItem> wardrobe = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        LocalDnaSynthesizer.Synthesis syn = ai.local(user.id(), AiCapability.DNA_SYNTHESIZER, List.of(Msg.t("dna.esquemas_e_pecas_do_acervo"), Msg.t("dna.looks_avaliados_como_adorei")),
                () -> LocalDnaSynthesizer.synthesize(weighted, itemsBy, wardrobe)).value();
        d.setArchetype(syn.archetype());
        d.setBoldnessIndex(boldnessPercentile(user.id(), wardrobe));
        d.setColorPalette(Json.csv(syn.palette()));
        d.setStyleKeywords(Json.csv(syn.styleKeywords()));
        d.setOccasionKeywords(Json.csv(syn.occasionKeywords()));
        d.setIconPieceName(iconPiece(weighted, itemsBy, wardrobe));
        d.setSilhouette(silhouette(wardrobe));
        d.setSynthesizedAt(Instant.now());
        d.setInteractionsAtSynthesis(interactions(user.id()));
        if (regeneratePhrase) {
            identityPhrase.phrase(user, d);
        }
        d.setCardImageUrl(null);
        dnas.save(d);
        snapshot(d, reason);
    }

    /** RN04 — a peça ícone nunca é acessório básico; é a mais frequente em looks aprovados. */
    static String iconPiece(List<Scheme> weighted, Map<UUID, List<SchemeItem>> itemsBy, List<WardrobeItem> wardrobe) {
        Map<UUID, Integer> use = new HashMap<>();
        Map<UUID, WardrobeItem> byId = new HashMap<>();
        for (Scheme s : weighted) {
            for (SchemeItem si : itemsBy.getOrDefault(s.getId(), List.of())) {
                WardrobeItem w = si.getWardrobeItem();
                if ("accessory_piece".equals(w.getCategory()) && BASIC_ACCESSORIES.contains(w.getSubcategory())) {
                    continue;
                }
                use.merge(w.getId(), 1, Integer::sum);
                byId.put(w.getId(), w);
            }
        }
        return use.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> byId.get(e.getKey()).getName())
                .orElse(wardrobe.stream().filter(w -> !"accessory_piece".equals(w.getCategory())).map(WardrobeItem::getName).findFirst().orElse(null));
    }

    static String silhouette(List<WardrobeItem> wardrobe) {
        Set<String> oversized = Set.of("hoodie", "sweatshirt", "parka", "coat", "cargo_pants", "sweatpants", "jogger_pants", "kimono");
        Set<String> fitted = Set.of("bodysuit", "crop_top", "top", "leggings", "tank_top", "tailored_pants", "skirt");
        Set<String> layering = Set.of("blazer", "cardigan", "jacket", "vest", "windbreaker", "coat");
        long o = wardrobe.stream().filter(w -> oversized.contains(w.getSubcategory())).count();
        long f = wardrobe.stream().filter(w -> fitted.contains(w.getSubcategory())).count();
        long l = wardrobe.stream().filter(w -> layering.contains(w.getSubcategory())).count();
        long max = Math.max(o, Math.max(f, l));
        if (max == 0) {
            return "equilibrada";
        }
        return max == l ? "layering" : max == o ? "oversized" : "fitted";
    }

    /** RN03 — índice de ousadia em percentil da diversidade cromática e de estilo frente aos demais usuários ativos. */
    int boldnessPercentile(UUID userId, List<WardrobeItem> wardrobe) {
        double mine = diversity(wardrobe);
        List<Double> others = new ArrayList<>();
        Map<UUID, List<WardrobeItem>> byUser = pieces.findAllPublic(Pageable.ofSize(2000)).stream().collect(Collectors.groupingBy(w -> w.getUser().getId()));
        byUser.forEach((u, list) -> {
            if (!u.equals(userId) && list.size() >= 5) {
                others.add(diversity(list));
            }
        });
        if (others.isEmpty()) {
            return (int) Math.round(mine * 100);
        }
        long below = others.stream().filter(v -> v <= mine).count();
        return (int) Math.round(100.0 * below / others.size());
    }

    static double diversity(List<WardrobeItem> list) {
        List<String> fam = list.stream().map(w -> Taxonomy.COLOR_FAMILY.get(w.getColor())).filter(Objects::nonNull).toList();
        List<String> sty = list.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList();
        return 0.5 * InventoryScoreService.entropy(fam, new HashSet<>(Taxonomy.COLOR_FAMILY.values()).size())
                + 0.5 * InventoryScoreService.entropy(sty, Taxonomy.STYLES.size());
    }

    void snapshot(StyleDna d, String reason) {
        StyleDnaVersion v = new StyleDnaVersion();
        v.setId(UUID.randomUUID());
        v.setUserId(d.getUser().getId());
        v.setSnapshotJson(Json.write(Map.of("reason", reason, "archetype", d.getArchetype().name(), "palette", Json.csv(d.getColorPalette()),
                "silhouette", String.valueOf(d.getSilhouette()), "boldness", d.getBoldnessIndex(), "icon", String.valueOf(d.getIconPieceName()),
                "phrase", String.valueOf(d.getIdentityPhrase()), "phraseSource", String.valueOf(d.getPhraseSource()))));
        v.setCreatedAt(Instant.now());
        versions.save(v);
    }
}
