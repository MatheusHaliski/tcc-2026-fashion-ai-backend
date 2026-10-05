package br.com.fashionai.application.insights;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static br.com.fashionai.application.insights.Insight.HYPE_V2;
import static br.com.fashionai.application.insights.Insight.PUBLIC_AGGREGATES;
import static br.com.fashionai.application.insights.Insight.PUBLIC_RANKING;
import static br.com.fashionai.application.insights.Insight.Tone.NEUTRAL;
import static br.com.fashionai.application.insights.Insight.Tone.POSITIVE;
import static br.com.fashionai.application.insights.InsightMath.action;
import static br.com.fashionai.application.insights.InsightMath.args;
import static br.com.fashionai.application.insights.InsightMath.fmt0;
import static br.com.fashionai.application.insights.InsightMath.insight;
import static br.com.fashionai.application.insights.InsightMath.metric;
import static br.com.fashionai.application.insights.InsightMath.round;

/**
 * Insights de perfil (Lote A5 · P3-15): BRAND_PROFILE (marca ou celebridade, chave = slug) e CREATOR_PROFILE (pessoa,
 * chave = @ ou id). São PÚBLICOS: leem só a população {@code public_eligible} com score disponível — item privado, só para
 * seguidores, em moderação ou de perfil privado nunca entra — e não dependem de quem vê (vão para o HypeCache por geração;
 * o bloqueio entre quem vê e o perfil é aplicado antes, no {@link InsightService}).
 * <p>
 * O Hype aparece sempre com contexto de estilo (o estilo mais presente nos itens públicos) e nunca como nota: "sem dados"
 * vira o texto de insuficiente (nunca 0); crescimento é a dimensão TREND (não volume); o selo de um perfil nunca alimenta
 * o Hype dos looks vinculados.
 */
final class ProfileInsights {
    /** Recorte (categoria, ocasião) com menos itens que isso não vira destaque. */
    static final int MIN_SLICE = 2;
    /** Trend a partir do qual um item público "está crescendo". */
    static final double RISING_TREND = 60;

    /** Perfil-alvo: marca (agregado pelo nome da marca), celebridade ou pessoa (agregado pelo dono). */
    enum Kind { BRAND, CELEBRITY, CREATOR }

    /** @param publicProfile perfil aberto (o agregado público só existe para perfil público) */
    record Target(Kind kind, UUID ownerId, String name, String brandKey, boolean publicProfile) {
        String cacheKey() {
            return kind + ":" + ownerId + ":" + (brandKey == null ? "" : brandKey) + ":" + (publicProfile ? "pub" : "closed");
        }
    }

    private final HypeScoreConfig config;
    private final HypeScoreCurrentRepository current;
    private final HypeQueryService hype;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final SealBondRepository bonds;

    ProfileInsights(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeQueryService hype, WardrobeItemRepository pieces, SchemeRepository schemes,
                    UserRepository users, BrandProfileRepository brands, CelebrityProfileRepository celebrities, SealBondRepository bonds) {
        this.config = config;
        this.current = current;
        this.hype = hype;
        this.pieces = pieces;
        this.schemes = schemes;
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.bonds = bonds;
    }

    // ================================================================== resolução do perfil
    /** Perfil da chave; desconhecido, não aprovado, excluído ou do tipo errado = nulo (a faixa fica vazia, sem erro). */
    Target resolve(InsightContext ctx, String rawKey) {
        if (rawKey == null || rawKey.isBlank() || users == null) {
            return null;
        }
        String key = rawKey.trim().startsWith("@") ? rawKey.trim().substring(1) : rawKey.trim();
        if (ctx == InsightContext.BRAND_PROFILE) {
            Optional<BrandProfile> b = brands == null ? Optional.empty() : brands.findBySlug(key);
            Optional<CelebrityProfile> c = b.isPresent() || celebrities == null ? Optional.empty() : celebrities.findBySlug(key);
            if (b.isEmpty() && c.isEmpty()) {
                // a página da marca também abre pelo @ do dono (redirecionamento do perfil pessoal)
                Optional<User> owner = userOf(key);
                b = owner.flatMap(u -> brands == null ? Optional.empty() : brands.findByOwnerId(u.getId()));
                c = b.isPresent() ? Optional.empty() : owner.flatMap(u -> celebrities == null ? Optional.empty() : celebrities.findByOwnerId(u.getId()));
            }
            if (b.isPresent() && b.get().getApprovalStatus() == ApprovalStatus.APROVADO && active(b.get().getOwner())) {
                return new Target(Kind.BRAND, b.get().getOwner().getId(), b.get().getBrandName(), HypeQueryService.brandKey(b.get().getBrandName()), true);
            }
            if (c.isPresent() && c.get().getVerificationStatus() == ApprovalStatus.APROVADO && active(c.get().getOwner())) {
                return new Target(Kind.CELEBRITY, c.get().getOwner().getId(), c.get().getStageName(), null, true);
            }
            return null;
        }
        return userOf(key).filter(u -> u.getProfileType() == ProfileType.PESSOAL && active(u))
                .map(u -> new Target(Kind.CREATOR, u.getId(), u.getDisplayName() == null || u.getDisplayName().isBlank() ? "@" + u.getUsername() : u.getDisplayName(),
                        null, u.getProfileVisibility() == Visibility.PUBLIC))
                .orElse(null);
    }

    private Optional<User> userOf(String key) {
        try {
            return users.findById(UUID.fromString(key));
        } catch (IllegalArgumentException e) {
            return users.findByUsernameIgnoreCase(key);
        }
    }

    private static boolean active(User u) {
        return u != null && u.getStatus() != AccountStatus.DELETED && u.getStatus() != AccountStatus.DELETION_SCHEDULED && u.getStatus() != AccountStatus.SUSPENDED;
    }

    // ================================================================== insights
    List<Insight> build(Target t) {
        List<Insight> out = new ArrayList<>();
        if (t == null || !t.publicProfile()) {
            return out;   // perfil fechado não tem agregado público
        }
        List<HypeScoreCurrent> rows = t.kind() == Kind.BRAND ? brandRows(t.brandKey()) : ownerRows(t.ownerId());
        HypeQueryService.RankGroup group = t.kind() == Kind.BRAND ? HypeQueryService.RankGroup.BRAND : HypeQueryService.RankGroup.CREATOR;
        String groupKey = t.kind() == Kind.BRAND ? t.brandKey() : t.ownerId().toString();
        String k = t.kind() == Kind.BRAND ? "brand" : "creator";
        Optional<Map.Entry<String, Long>> style = InsightMath.countBy(rows, c -> Json.csv(c.getStyles())).stream().findFirst();
        Map<?, ?> g = groupOf(group, groupKey);
        if (g != null && Boolean.TRUE.equals(g.get("sufficient")) && g.get("value") instanceof Number v && g.get("level") != null) {
            String level = Msg.t("schemeHype.level." + g.get("level"));
            long items = g.get("items") instanceof Number n ? n.longValue() : rows.size();
            Insight.Action act = action(t.kind() == Kind.BRAND ? "insights.action.ver_marcas" : "insights.action.ver_criadores",
                    "/explorer?tab=trending&type=" + group.name());
            out.add(style.isPresent()
                    ? insight("PROFILE_HYPE", NEUTRAL, 0.95, "insights.profile_hype.text_" + k, args(t.name(), fmt0(v.doubleValue()), level, items, Taxonomy.label(style.get().getKey())),
                    metric("insights.metric.hype_medio", round(v.doubleValue()), "pts"), act, HYPE_V2, PUBLIC_RANKING)
                    : insight("PROFILE_HYPE", NEUTRAL, 0.95, "insights.profile_hype.text_" + k + "_no_style", args(t.name(), fmt0(v.doubleValue()), level, items),
                    metric("insights.metric.hype_medio", round(v.doubleValue()), "pts"), act, HYPE_V2, PUBLIC_RANKING));
        } else {
            // abaixo do mínimo de itens públicos: o Hype do perfil não existe (nunca 0)
            out.add(insight("PROFILE_HYPE_INSUFFICIENT", NEUTRAL, 0.6, "insights.profile_hype_insufficient.text_" + k, args(t.name(), rows.size(), minItems()),
                    metric("insights.metric.itens_publicos", rows.size(), null), null, HYPE_V2));
        }
        if (rows.size() >= minItems()) {
            double trend = rows.stream().mapToDouble(InsightMath::trend).average().orElse(50);
            long rising = rows.stream().filter(c -> c.getMomentum() == HypeMomentum.RISING || c.getMomentum() == HypeMomentum.EMERGING).count();
            out.add(insight("PROFILE_GROWTH", trend >= RISING_TREND ? POSITIVE : NEUTRAL, 0.85, "insights.profile_growth.text_" + k,
                    args(t.name(), fmt0(trend), rising, rows.size()), metric("insights.metric.trend_medio", round(trend), "pts"), null, HYPE_V2, PUBLIC_RANKING));
        }
        InsightMath.averageBy(rows, InsightMath::categoriesOf, InsightMath::score, MIN_SLICE).stream()
                .max(Comparator.comparingInt(InsightMath.Avg::items).thenComparing(InsightMath.Avg::value).thenComparing(InsightMath.Avg::key, Comparator.reverseOrder()))
                .ifPresent(a -> out.add(insight("PROFILE_TOP_CATEGORY", NEUTRAL, 0.7, "insights.profile_top_category.text",
                        args(Taxonomy.label(a.key()), a.items(), rows.size(), fmt0(a.value())),
                        metric("insights.metric.hype_medio", round(a.value()), "pts"), null, HYPE_V2, PUBLIC_RANKING)));
        if (t.kind() != Kind.BRAND) {
            risingItem(rows).ifPresent(out::add);
            InsightMath.countBy(rows, c -> Json.csv(c.getOccasions())).stream().findFirst().filter(e -> e.getValue() >= MIN_SLICE)
                    .ifPresent(e -> out.add(insight("PROFILE_TOP_OCCASION", NEUTRAL, 0.6, "insights.profile_top_occasion.text",
                            args(Taxonomy.label(e.getKey()), e.getValue(), rows.size()), metric("insights.metric.itens_publicos", e.getValue(), null), null, PUBLIC_AGGREGATES)));
        }
        long emerging = rows.stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING).count();
        if (emerging > 0) {
            out.add(insight("PROFILE_EMERGING", POSITIVE, 0.65, "insights.profile_emerging.text", args(emerging, rows.size()),
                    metric("insights.metric.emergentes", emerging, null), null, HYPE_V2, PUBLIC_RANKING));
        }
        if (t.kind() != Kind.CREATOR) {
            bondedLooks(t).ifPresent(out::add);
        }
        return out;
    }

    private int minItems() {
        return 3;   // o mesmo mínimo do Em alta (HypeQueryService.MIN_GROUP_ITEMS)
    }

    /** O agregado do perfil pela régua do Em alta ({@link HypeQueryService#groups}); falha = sem agregado. */
    private Map<?, ?> groupOf(HypeQueryService.RankGroup group, String key) {
        Map<String, Object> out = hype == null ? null : hype.groups(null, group, List.of(key), 7);
        return out != null && out.get("items") instanceof Map<?, ?> items && items.get(key) instanceof Map<?, ?> g ? g : null;
    }

    /** População pública com score disponível do tipo (defesa em profundidade: confere a elegibilidade de cada linha). */
    private List<HypeScoreCurrent> pool(HypeEntityType type) {
        List<HypeScoreCurrent> rows = current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE);
        return (rows == null ? List.<HypeScoreCurrent>of() : rows).stream().filter(Objects::nonNull)
                .filter(c -> c.isPublicEligible() && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null).toList();
    }

    /** Itens públicos de uma pessoa (peças + looks). */
    List<HypeScoreCurrent> ownerRows(UUID ownerId) {
        return Stream.concat(pool(HypeEntityType.PIECE).stream(), pool(HypeEntityType.SCHEME).stream())
                .filter(c -> ownerId.equals(c.getOwnerId())).toList();
    }

    /** Peças públicas com a marca (nome normalizado, a mesma chave do agregado de marca). */
    List<HypeScoreCurrent> brandRows(String brandKey) {
        List<HypeScoreCurrent> all = pool(HypeEntityType.PIECE);
        if (all.isEmpty() || brandKey == null || brandKey.isBlank()) {
            return List.of();
        }
        Set<UUID> ofBrand = new LinkedHashSet<>();
        for (WardrobeItem w : pieces.findByIdIn(all.stream().map(HypeScoreCurrent::getEntityId).toList())) {
            String name = w.getBrand() != null ? w.getBrand().getName() : w.getBrandName();
            if (name != null && brandKey.equals(HypeQueryService.brandKey(name))) {
                ofBrand.add(w.getId());
            }
        }
        return all.stream().filter(c -> ofBrand.contains(c.getEntityId())).toList();
    }

    /** O item público da pessoa que mais cresce (trend ≥ 60), com o nome e o link — crescimento recente, não curtidas. */
    private Optional<Insight> risingItem(List<HypeScoreCurrent> rows) {
        return rows.stream().filter(c -> InsightMath.trend(c) >= RISING_TREND)
                .max(Comparator.comparingDouble(InsightMath::trend).thenComparing(c -> c.getEntityId().toString(), Comparator.reverseOrder()))
                .flatMap(c -> {
                    boolean look = c.getEntityType() == HypeEntityType.SCHEME;
                    String name = look ? schemes.findById(c.getEntityId()).map(Scheme::getTitle).orElse(null)
                            : pieces.findById(c.getEntityId()).map(WardrobeItem::getName).orElse(null);
                    if (name == null || name.isBlank()) {
                        return Optional.empty();
                    }
                    return Optional.of(insight("PROFILE_RISING_ITEM", POSITIVE, 0.8, "insights.profile_rising_item.text", args(name, fmt0(InsightMath.trend(c))),
                            metric("insights.metric.trend", round(InsightMath.trend(c)), "pts"),
                            action("insights.action.ver_item", (look ? "/schemes/" : "/pieces/") + c.getEntityId()), HYPE_V2, PUBLIC_RANKING));
                });
    }

    /**
     * Looks com selo deste perfil (vínculo APROVADO e vigente): o Hype público deles, à parte do Hype do perfil. O selo
     * não aumenta o Hype — o texto diz isso. Só público elegível com Hype disponível entra.
     */
    private Optional<Insight> bondedLooks(Target t) {
        if (bonds == null) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        Set<UUID> looks = new LinkedHashSet<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(t.ownerId(), SealBondStatus.APPROVED)) {
            if (b.getScheme() != null && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))) {
                looks.add(b.getScheme().getId());
            }
        }
        if (looks.isEmpty() || hype == null) {
            return Optional.empty();
        }
        List<HypeScoreCurrent> shown = hype.currentOf(HypeEntityType.SCHEME, looks).values().stream()
                .filter(c -> c.isPublicEligible() && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null).toList();
        if (shown.isEmpty()) {
            return Optional.empty();
        }
        double avg = shown.stream().mapToDouble(InsightMath::score).average().orElse(0);
        String level = Msg.t("schemeHype.level." + config.level(Math.round(avg * 10) / 10.0).name());
        return Optional.of(insight("PROFILE_BONDED_LOOKS", NEUTRAL, 0.75, "insights.profile_bonded_looks.text", args(shown.size(), t.name(), fmt0(avg), level),
                metric("insights.metric.hype_medio", round(avg), "pts"), null, HYPE_V2, PUBLIC_AGGREGATES));
    }
}
