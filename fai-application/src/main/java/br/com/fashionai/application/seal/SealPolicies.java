package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.enums.PromotionType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * RF20.CA24–CA30 / docs/novo-projeto/artefatos/06-copilot-definir-selo-prompts.md §4–§5 — o objeto {@code SealPolicy}.
 *
 * <p>O editor "Cadastrar novo selo" não tem campo de texto: a regra do selo é este objeto (JSON em snake_case, como no
 * doc 06 §4), devolvido pelo Copilot "Definir selo" e gravado em {@code seals.policy_json}. Esta classe é pura (sem
 * Spring nem banco): {@link #normalize} limpa o que vem do cliente, {@link #enforce} aplica as REGRAS DURAS do §5 e
 * calcula o {@code status}; o frontend espelha as mesmas regras em {@code lib/seal-policy.ts}.</p>
 *
 * <h3>Os três tiers (PEÇA &lt; LOOK &lt; PERFIL)</h3>
 * <ul>
 *   <li><b>PECA</b> — o selo de UMA peça do emissor ({@code min_pieces_from_issuer = 1});</li>
 *   <li><b>LOOK</b> — vários itens ou o look inteiro (mínimo 2 peças do emissor);</li>
 *   <li><b>PERFIL</b> — concedido a um perfil inteiro (embaixador da marca, colecionador verificado…): não olha peças,
 *       é o tier mais restrito — revisão sempre manual e teto de emissão obrigatório, para qualquer emissor.</li>
 * </ul>
 *
 * <h3>Regras duras (§5.3)</h3>
 * celebridade nunca tem revisão automática (RF21.CA19); Selo Premium só aceita vidro ou holográfico (RF21.CA20); teto
 * obrigatório para celebridade (RF21.CA23); promoção obrigatória para todo selo (RF20.CA11); PERFIL: revisão manual e
 * teto obrigatórios. A regra que bloqueou é sempre citada, com o CA, na mensagem do aviso/conflito.
 */
public final class SealPolicies {
    public static final String TAG = "#createsealpolicy";
    public static final List<String> TIERS = List.of("PECA", "LOOK", "PERFIL");
    public static final List<String> REVIEW_MODES = List.of("auto", "hybrid", "manual");
    public static final List<String> PERIODS = List.of("day", "week", "month");
    public static final List<String> ON_EXCEED = List.of("queue", "reject");
    /** Opções dos selects do editor (doc 06 §4); o valor atual da política aparece mesmo fora destas listas. */
    public static final List<Integer> VALIDITY_MONTHS = List.of(3, 6, 12, 24);
    public static final List<Integer> QUOTA_STEPS = List.of(100, 300, 500, 1000, 2000, 5000);
    public static final List<Double> CONFIDENCE_STEPS = List.of(0.60, 0.72, 0.80, 0.90);
    /** Mínimo de peças do emissor num selo de LOOK (um look tem mais de um item). */
    public static final int LOOK_MIN_PIECES = 2;
    public static final int DEFAULT_SLA_HOURS = 48;
    /** Promoções que um perfil de marca pode criar (SealService.applyPromotion); celebridade pode todas. */
    public static final Set<String> BRAND_PROMOTION_TYPES = Set.of("DESCONTO_ECOMMERCE", "CUPOM_LOJA", "FRETE_GRATIS",
            "BRINDE", "ACESSO_ANTECIPADO", "EVENTO");
    public static final Set<String> ALL_PROMOTION_TYPES = EnumSet.allOf(PromotionType.class).stream().map(Enum::name)
            .collect(Collectors.toCollection(LinkedHashSet::new));

    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_.:\\-]{1,64}$");
    private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    private SealPolicies() {
    }

    /** Um aviso (política segue válida) ou um item bloqueante: {@code kind} = "conflict" | "missing"; sem kind = aviso. */
    public record Issue(String code, String field, String ca, String kind, String message) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code);
            m.put("field", field);
            m.put("ca", ca);
            if (kind != null) {
                m.put("kind", kind);
            }
            m.put("message", message);
            return m;
        }
    }

    public record PromotionInfo(String id, String title, Integer totalQuota, Instant startsAt, Instant expiresAt) {
    }

    public record Evaluation(String status, List<Issue> blocking, List<Issue> warnings) {
        public boolean valid() {
            return "valid".equals(status);
        }
    }

    // ================================================================== esqueleto

    public static String newId() {
        return "pol_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    /** Política em branco do emissor: nada inventado — só os padrões seguros (revisão manual, 1 por usuário, 12 meses). */
    public static Map<String, Object> blank(String issuerType, String issuerId) {
        boolean celebrity = "celebrity".equals(issuerType);
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("policy_id", newId());
        p.put("version", 1);
        p.put("derived_from", null);
        p.put("issuer_type", celebrity ? "celebrity" : "brand");
        p.put("issuer_id", issuerId);
        p.put("tier", "LOOK");
        Map<String, Object> el = new LinkedHashMap<>();
        el.put("min_pieces_from_issuer", LOOK_MIN_PIECES);
        el.put("collections", new ArrayList<String>());
        el.put("categories", new ArrayList<String>());
        el.put("wearstyles", new ArrayList<String>());
        el.put("body_parts", new ArrayList<String>());
        el.put("min_confidence", 0.72);
        el.put("exclude_issuers", new ArrayList<String>());
        p.put("eligibility", el);
        Map<String, Object> rv = new LinkedHashMap<>();
        rv.put("mode", "manual");
        rv.put("auto_threshold", null);
        rv.put("manual_below", null);
        rv.put("sla_hours", DEFAULT_SLA_HOURS);
        p.put("review", rv);
        Map<String, Object> va = new LinkedHashMap<>();
        va.put("months", 12);
        va.put("expires_with_campaign", false);
        p.put("validity", va);
        Map<String, Object> qu = new LinkedHashMap<>();
        qu.put("total", null);
        qu.put("per_user", 1);
        qu.put("per_period", null);
        qu.put("on_exceed", "queue");
        p.put("quota", qu);
        Map<String, Object> rk = new LinkedHashMap<>();
        rk.put("on_piece_removed", true);
        rk.put("notify_user", true);
        p.put("revocation", rk);
        Map<String, Object> pr = new LinkedHashMap<>();
        pr.put("promotion_id", null);
        pr.put("create", null);
        pr.put("partner_brand_id", null);
        p.put("promotion", pr);
        Map<String, Object> ae = new LinkedHashMap<>();
        ae.put("format", "CIRCULAR");
        ae.put("material", celebrity ? "vidro" : "tecido");
        ae.put("frame_pattern", "malha");
        ae.put("center", "logo_url");
        ae.put("denomination", "year");
        p.put("aesthetics", ae);
        p.put("celebrity", null);
        p.put("name_proposals", new ArrayList<String>());
        p.put("status", "incomplete");
        p.put("warnings", new ArrayList<Map<String, Object>>());
        p.put("conflicts", new ArrayList<Map<String, Object>>());
        p.put("sources", new ArrayList<Map<String, Object>>());
        p.put("rationale", "");
        return p;
    }

    // ================================================================== normalização do que vem do cliente

    /** Reconstrói a política só com campos conhecidos e tipos válidos (nada do cliente é gravado como veio). */
    public static Map<String, Object> normalize(Map<String, Object> raw, String issuerType) {
        Map<String, Object> out = blank(issuerType, null);
        if (raw == null) {
            return out;
        }
        String pid = id(raw.get("policy_id"));
        out.put("policy_id", pid == null ? newId() : pid);
        out.put("version", (int) Math.max(1, Math.min(9999, num(raw.get("version"), 1))));
        out.put("derived_from", id(raw.get("derived_from")));
        out.put("issuer_id", id(raw.get("issuer_id")));
        String tier = raw.get("tier") == null ? "LOOK" : String.valueOf(raw.get("tier")).trim().toUpperCase(Locale.ROOT);
        out.put("tier", TIERS.contains(tier) ? tier : "LOOK");

        Map<String, Object> el = map(out, "eligibility");
        Map<String, Object> re = sub(raw, "eligibility");
        el.put("min_pieces_from_issuer", (int) Math.max(0, Math.min(20, num(re.get("min_pieces_from_issuer"), LOOK_MIN_PIECES))));
        el.put("collections", ids(re.get("collections")));
        Set<String> categories = new LinkedHashSet<>(Taxonomy.SUBCATEGORIES.keySet());
        Taxonomy.SUBCATEGORIES.values().forEach(categories::addAll);
        el.put("categories", ids(re.get("categories")).stream().filter(categories::contains).toList());
        el.put("wearstyles", ids(re.get("wearstyles")).stream().filter(Taxonomy.WEARSTYLE_GROUPS::containsKey).toList());
        el.put("body_parts", ids(re.get("body_parts")).stream().filter(Taxonomy.SUBCATEGORIES::containsKey).toList());
        el.put("min_confidence", unit(re.get("min_confidence"), 0.72));
        el.put("exclude_issuers", ids(re.get("exclude_issuers")));

        Map<String, Object> rv = map(out, "review");
        Map<String, Object> rr = sub(raw, "review");
        String mode = rr.get("mode") == null ? "manual" : String.valueOf(rr.get("mode")).trim().toLowerCase(Locale.ROOT);
        rv.put("mode", REVIEW_MODES.contains(mode) ? mode : "manual");
        rv.put("auto_threshold", unitOrNull(rr.get("auto_threshold")));
        rv.put("manual_below", unitOrNull(rr.get("manual_below")));
        rv.put("sla_hours", (int) Math.max(1, Math.min(720, num(rr.get("sla_hours"), DEFAULT_SLA_HOURS))));

        Map<String, Object> va = map(out, "validity");
        Map<String, Object> rva = sub(raw, "validity");
        va.put("months", rva.get("months") == null ? null : (Object) (int) Math.max(1, Math.min(120, num(rva.get("months"), 12))));
        va.put("expires_with_campaign", Boolean.TRUE.equals(bool(rva.get("expires_with_campaign"))));
        String campaign = id(rva.get("campaign_id"));
        if (campaign != null) {
            va.put("campaign_id", campaign);
        }
        String endsAt = rva.get("ends_at") == null ? null : String.valueOf(rva.get("ends_at")).trim();
        if (endsAt != null && ISO_DATE.matcher(endsAt).matches()) {
            va.put("ends_at", endsAt);
        }

        Map<String, Object> qu = map(out, "quota");
        Map<String, Object> rq = sub(raw, "quota");
        qu.put("total", rq.get("total") == null ? null : (Object) (int) Math.max(0, Math.min(10_000_000, num(rq.get("total"), 0))));
        qu.put("per_user", (int) Math.max(1, Math.min(1000, num(rq.get("per_user"), 1))));
        Map<String, Object> rpp = sub(rq, "per_period");
        String period = rpp.get("period") == null ? "" : String.valueOf(rpp.get("period")).trim().toLowerCase(Locale.ROOT);
        if (PERIODS.contains(period) && num(rpp.get("count"), 0) >= 1) {
            Map<String, Object> pp = new LinkedHashMap<>();
            pp.put("count", (int) Math.min(1_000_000, num(rpp.get("count"), 1)));
            pp.put("period", period);
            qu.put("per_period", pp);
        }
        String exceed = rq.get("on_exceed") == null ? "queue" : String.valueOf(rq.get("on_exceed")).trim().toLowerCase(Locale.ROOT);
        qu.put("on_exceed", ON_EXCEED.contains(exceed) ? exceed : "queue");

        Map<String, Object> rk = map(out, "revocation");
        Map<String, Object> rrk = sub(raw, "revocation");
        rk.put("on_piece_removed", rrk.get("on_piece_removed") == null || Boolean.TRUE.equals(bool(rrk.get("on_piece_removed"))));
        rk.put("notify_user", rrk.get("notify_user") == null || Boolean.TRUE.equals(bool(rrk.get("notify_user"))));

        Map<String, Object> pr = map(out, "promotion");
        Map<String, Object> rpr = sub(raw, "promotion");
        pr.put("promotion_id", id(rpr.get("promotion_id")));
        pr.put("partner_brand_id", id(rpr.get("partner_brand_id")));
        pr.put("create", normalizeCreate(sub(rpr, "create")));

        Map<String, Object> ae = map(out, "aesthetics");
        Map<String, Object> ra = sub(raw, "aesthetics");
        ae.put("format", pick(ra.get("format"), SealDesigns.FORMATS, true, "CIRCULAR"));
        ae.put("material", pick(ra.get("material"), SealDesigns.STYLE_MATERIALS, false, "celebrity".equals(issuerType) ? "vidro" : "tecido"));
        ae.put("frame_pattern", pick(ra.get("frame_pattern"), SealDesigns.STYLE_FRAMES, false, "malha"));
        ae.put("center", pick(ra.get("center"), SealDesigns.STYLE_CENTERS, false, "logo_url"));
        ae.put("denomination", pick(ra.get("denomination"), SealDesigns.STYLE_DENOMINATIONS, false, "year"));

        Map<String, Object> rc = sub(raw, "celebrity");
        out.put("celebrity", rc.isEmpty() || id(rc.get("era_id")) == null ? null : new LinkedHashMap<>(Map.of("era_id", id(rc.get("era_id")))));

        List<String> names = new ArrayList<>();
        if (raw.get("name_proposals") instanceof List<?> l) {
            for (Object o : l) {
                String n = o == null ? "" : String.valueOf(o).trim();
                if (n.length() >= 2 && names.size() < 3) {
                    names.add(n.length() > 80 ? n.substring(0, 80) : n);
                }
            }
        }
        out.put("name_proposals", names);
        String rationale = raw.get("rationale") == null ? "" : String.valueOf(raw.get("rationale")).trim();
        out.put("rationale", rationale.length() > 500 ? rationale.substring(0, 500) : rationale);
        List<Map<String, Object>> sources = new ArrayList<>();
        if (raw.get("sources") instanceof List<?> l) {
            for (Object o : l) {
                if (o instanceof Map<?, ?> m && sources.size() < 12) {
                    Map<String, Object> s = new LinkedHashMap<>();
                    s.put("table", clip(m.get("table"), 40));
                    s.put("id", clip(m.get("id"), 64));
                    s.put("detail", clip(m.get("detail"), 120));
                    sources.add(s);
                }
            }
        }
        out.put("sources", sources);
        return out;
    }

    private static Map<String, Object> normalizeCreate(Map<String, Object> c) {
        if (c.isEmpty() || c.get("type") == null) {
            return null;
        }
        String type = String.valueOf(c.get("type")).trim().toUpperCase(Locale.ROOT);
        if (!ALL_PROMOTION_TYPES.contains(type)) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type);
        out.put("title", clip(c.get("title"), 160));
        out.put("discount_percent", c.get("discount_percent") == null ? null : (Object) (int) Math.max(1, Math.min(90, num(c.get("discount_percent"), 1))));
        out.put("amount", c.get("amount") == null ? null : (Object) Math.max(0, Math.min(1_000_000, num(c.get("amount"), 0))));
        out.put("starts_at", isoDate(c.get("starts_at")));
        out.put("ends_at", isoDate(c.get("ends_at")));
        out.put("per_user", (int) Math.max(1, Math.min(1000, num(c.get("per_user"), 1))));
        return out;
    }

    // ================================================================== regras duras → status

    /**
     * Aplica as regras duras do §5.3 à política (mutando-a: o pedido do emissor perde para a regra), junta os avisos
     * já levantados por quem montou a política e define {@code status}, {@code warnings} e {@code conflicts}.
     *
     * @param promotions busca a promoção do próprio emissor (null = não consegue resolver); {@code null} aceito
     * @param unresolved há slot sem resposta (vira status "unresolved")
     */
    @SuppressWarnings("unchecked")
    public static Evaluation enforce(Map<String, Object> policy, String issuerType, Function<String, PromotionInfo> promotions,
                                     List<Issue> carriedWarnings, List<Issue> carriedBlocking, boolean unresolved) {
        boolean celebrity = "celebrity".equals(issuerType);
        List<Issue> warnings = new ArrayList<>(carriedWarnings == null ? List.of() : carriedWarnings);
        List<Issue> blocking = new ArrayList<>(carriedBlocking == null ? List.of() : carriedBlocking);
        String tier = String.valueOf(policy.get("tier"));
        Map<String, Object> el = map(policy, "eligibility");
        Map<String, Object> rv = map(policy, "review");
        Map<String, Object> qu = map(policy, "quota");
        Map<String, Object> pr = map(policy, "promotion");
        Map<String, Object> ae = map(policy, "aesthetics");
        boolean perfil = "PERFIL".equals(tier);

        // tier → unidade de vínculo
        int minPieces = (int) num(el.get("min_pieces_from_issuer"), LOOK_MIN_PIECES);
        if ("PECA".equals(tier) && minPieces != 1) {
            el.put("min_pieces_from_issuer", 1);
            if (minPieces > 1) {
                warnings.add(issue("peca_min_pieces_fixed", "eligibility.min_pieces_from_issuer", "RF20.CA24", null, minPieces));
            }
        } else if ("LOOK".equals(tier) && minPieces < LOOK_MIN_PIECES) {
            el.put("min_pieces_from_issuer", LOOK_MIN_PIECES);
            warnings.add(issue("look_min_pieces_raised", "eligibility.min_pieces_from_issuer", "RF20.CA24", null, minPieces, LOOK_MIN_PIECES));
        } else if (perfil && minPieces != 0) {
            el.put("min_pieces_from_issuer", 0);
            warnings.add(issue("perfil_no_piece_rule", "eligibility.min_pieces_from_issuer", "RF20.CA24", null));
        }

        // revisão: celebridade nunca automática (RF21.CA19); PERFIL sempre manual
        String mode = String.valueOf(rv.get("mode"));
        if (!"manual".equals(mode) && (celebrity || perfil)) {
            rv.put("mode", "manual");
            rv.put("auto_threshold", null);
            rv.put("manual_below", null);
            warnings.add(celebrity
                    ? issue("celebrity_review_forced_manual", "review.mode", "RF21.CA19", null)
                    : issue("perfil_review_forced_manual", "review.mode", "RF20.CA24", null));
        }
        Double auto = dbl(rv.get("auto_threshold"));
        Double manual = dbl(rv.get("manual_below"));
        if ("hybrid".equals(rv.get("mode")) && (auto == null || manual == null)) {
            rv.put("mode", auto == null ? "manual" : "auto");
        }
        if ("hybrid".equals(rv.get("mode")) && auto != null && manual != null && auto <= manual) {
            blocking.add(issue("threshold_order", "review.auto_threshold", "RF20.CA24", "conflict", fmt(auto), fmt(manual)));
        }
        if ("auto".equals(rv.get("mode")) && auto == null) {
            rv.put("mode", "manual");
        }

        // estética: Selo Premium só vítreo (RF21.CA20)
        String material = ae.get("material") == null ? null : String.valueOf(ae.get("material"));
        if (celebrity && material != null && !SealDesigns.PREMIUM_MATERIALS.contains(material)) {
            ae.put("material", null);
            blocking.add(issue("premium_material", "aesthetics.material", "RF21.CA20", "conflict", material));
        }
        if (celebrity && ae.get("material") == null && blocking.stream().noneMatch(i -> "premium_material".equals(i.code()))) {
            ae.put("material", "vidro");
        }

        // teto: celebridade (RF21.CA23) e PERFIL (qualquer emissor)
        Integer total = qu.get("total") == null ? null : (int) num(qu.get("total"), 0);
        if (total != null && total <= 0) {
            qu.put("total", null);
            total = null;
        }
        if (total == null && celebrity) {
            blocking.add(issue("celebrity_quota_required", "quota.total", "RF21.CA23", "missing"));
        } else if (total == null && perfil) {
            blocking.add(issue("perfil_quota_required", "quota.total", "RF20.CA24", "missing"));
        }
        int perUser = (int) num(qu.get("per_user"), 1);
        if (total != null && perUser > total) {
            blocking.add(issue("per_user_above_total", "quota.per_user", "RF20.CA12", "conflict", perUser, total));
        }

        // parceira só existe na promoção de celebridade (RF21.CA22)
        if (!celebrity && pr.get("partner_brand_id") != null) {
            pr.put("partner_brand_id", null);
            warnings.add(issue("partner_only_celebrity", "promotion.partner_brand_id", "RF21.CA22", null));
        }
        if (!celebrity && policy.get("celebrity") != null) {
            policy.put("celebrity", null);
        }

        // promoção obrigatória (RF20.CA11), tipo permitido e cota
        String promotionId = pr.get("promotion_id") == null ? null : String.valueOf(pr.get("promotion_id"));
        Map<String, Object> create = pr.get("create") instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        if (promotionId == null && create == null) {
            blocking.add(issue("promotion_required", "promotion.promotion_id", "RF20.CA11", "missing"));
        }
        if (create != null) {
            String type = String.valueOf(create.get("type"));
            if (!celebrity && !BRAND_PROMOTION_TYPES.contains(type)) {
                blocking.add(issue("promotion_type_not_allowed", "promotion.create.type", "RF21.CA21", "conflict", type));
            }
        }
        if (promotionId != null && promotions != null) {
            PromotionInfo info = promotions.apply(promotionId);
            if (info == null) {
                blocking.add(issue("promotion_not_found", "promotion.promotion_id", "RF20.CA11", "conflict"));
            } else if (total != null && info.totalQuota() != null && total > info.totalQuota()) {
                blocking.add(issue("quota_above_promotion", "quota.total", "RF20.CA11", "conflict", total, info.totalQuota()));
            }
        }

        String status = unresolved ? "unresolved"
                : blocking.stream().anyMatch(i -> "conflict".equals(i.kind())) ? "conflict"
                : blocking.stream().anyMatch(i -> "missing".equals(i.kind())) ? "incomplete" : "valid";
        policy.put("status", status);
        policy.put("warnings", warnings.stream().map(Issue::toMap).toList());
        policy.put("conflicts", blocking.stream().map(Issue::toMap).toList());
        return new Evaluation(status, blocking, warnings);
    }

    /** Fim da validade: o menor entre N meses a partir de agora e o fim da campanha (quando a política vale até lá). */
    public static Instant availableUntil(Map<String, Object> policy, Function<String, PromotionInfo> promotions, Instant now) {
        Map<String, Object> va = map(policy, "validity");
        Instant byMonths = va.get("months") == null ? null
                : ZonedDateTime.ofInstant(now, ZoneOffset.UTC).plusMonths((long) num(va.get("months"), 12)).toInstant();
        Instant byCampaign = null;
        if (Boolean.TRUE.equals(va.get("expires_with_campaign"))) {
            if (va.get("ends_at") != null) {
                byCampaign = LocalDate.parse(String.valueOf(va.get("ends_at"))).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            } else if (promotions != null && map(policy, "promotion").get("promotion_id") != null) {
                PromotionInfo info = promotions.apply(String.valueOf(map(policy, "promotion").get("promotion_id")));
                byCampaign = info == null ? null : info.expiresAt();
            }
        }
        if (byMonths == null) {
            return byCampaign;
        }
        return byCampaign != null && byCampaign.isBefore(byMonths) ? byCampaign : byMonths;
    }

    /** Texto curto da política para quem ainda lê {@code policy_text}: a justificativa do Copilot ou um resumo técnico. */
    public static String summary(Map<String, Object> policy) {
        Object why = policy.get("rationale");
        if (why != null && !String.valueOf(why).isBlank()) {
            return String.valueOf(why);
        }
        Map<String, Object> rv = map(policy, "review");
        Map<String, Object> qu = map(policy, "quota");
        return policy.get("tier") + " · " + rv.get("mode") + " · " + map(policy, "validity").get("months") + "m · "
                + (qu.get("total") == null ? "∞" : qu.get("total"));
    }

    // ================================================================== helpers

    static Issue issue(String code, String field, String ca, String kind, Object... args) {
        return new Issue(code.toUpperCase(Locale.ROOT), field, ca, kind, Msg.t("sealPolicy." + code, args));
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.2f", v);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Map<String, Object> parent, String key) {
        Object v = parent.get(key);
        if (v instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        Map<String, Object> created = new LinkedHashMap<>();
        parent.put(key, created);
        return created;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> sub(Map<String, Object> raw, String key) {
        return raw.get(key) instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static String id(Object v) {
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v).trim();
        return ID.matcher(s).matches() ? s : null;
    }

    private static List<String> ids(Object v) {
        List<String> out = new ArrayList<>();
        if (v instanceof List<?> l) {
            for (Object o : l) {
                String s = id(o);
                if (s != null && !out.contains(s) && out.size() < 20) {
                    out.add(s);
                }
            }
        }
        return out;
    }

    private static String pick(Object v, List<String> allowed, boolean upper, String dflt) {
        if (v == null) {
            return dflt;
        }
        String s = String.valueOf(v).trim();
        s = upper ? s.toUpperCase(Locale.ROOT) : s.toLowerCase(Locale.ROOT);
        return allowed.contains(s) ? s : dflt;
    }

    private static String clip(Object v, int max) {
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s.length() > max ? s.substring(0, max) : s;
    }

    private static String isoDate(Object v) {
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v).trim();
        return ISO_DATE.matcher(s).matches() ? s : null;
    }

    static double num(Object v, double dflt) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return v == null ? dflt : Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    private static Double dbl(Object v) {
        return v == null ? null : num(v, 0);
    }

    private static double unit(Object v, double dflt) {
        return Math.max(0, Math.min(1, Math.round(num(v, dflt) * 1000) / 1000.0));
    }

    private static Double unitOrNull(Object v) {
        return v == null ? null : unit(v, 0);
    }

    private static Boolean bool(Object v) {
        if (v instanceof Boolean b) {
            return b;
        }
        return v == null ? null : Boolean.parseBoolean(String.valueOf(v));
    }
}
