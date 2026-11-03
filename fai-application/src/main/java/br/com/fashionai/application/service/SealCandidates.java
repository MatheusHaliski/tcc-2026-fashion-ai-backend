package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.SealService.Candidate;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.SealBondBasis;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * RF20.CA01 / RF21.CA17 / RF25 — candidatos a selo de um look ou peça: primeiro os selos com política padronizada
 * (a regra do emissor decide), depois a heurística de marca cadastrada e de assinatura de estilo da celebridade;
 * ordenados por confiança e reordenados por Hype (RF53). Colaborador do {@link SealService} (R80).
 */
final class SealCandidates {
    private final SealRepository seals;
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final SealIssuers issuers;

    SealCandidates(SealRepository seals, BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles, SealIssuers issuers) {
        this.seals = seals;
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.issuers = issuers;
    }

    static Map<String, Object> referenceBackground(Scheme scheme) {
        Map<String, Object> background = SealReferenceModels.backgroundOf(Json.map(scheme.getStudioConfigJson()));
        background.putIfAbsent("color", scheme.getBackgroundColor());
        background.putIfAbsent("artUrl", scheme.getBackgroundArtUrl());
        background.putIfAbsent("cardSkin", scheme.getCardSkin());
        background.putIfAbsent("layoutAnatomy", scheme.getLayoutAnatomy());
        return background;
    }

    /**
     * RF53 — com o Hype atual: políticas com critério de Hype avaliadas contra ele e sugestões ordenadas por Hype desc
     * (a seleção das {@value SealService#MAX_SUGGESTIONS} continua pela confiança; o Hype só reordena, com desempate pela ordem atual).
     */
    List<Candidate> candidates(Scheme scheme, List<SchemeItem> items, List<String> unregistered, boolean pieceOnly,
                               SealPolicies.HypeLookup hype) {
        List<Candidate> out = new ArrayList<>();
        int n = Math.max(1, items.size());
        Set<UUID> governed = policyCandidates(scheme, items, pieceOnly, out, hype);
        // Marcas: peças com marca cadastrada e perfil aprovado (RF20.CA06).
        Map<UUID, List<WardrobeItem>> byBrandProfile = new LinkedHashMap<>();
        List<BrandProfile> approved = brandProfiles.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO);
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            BrandProfile bp = w.getBrandProfile() != null ? w.getBrandProfile()
                    : w.getBrand() != null ? w.getBrand().getBrandProfile() : null;
            if (bp == null && w.getBrandName() != null) {
                String norm = LocalAdvisors.normalize(w.getBrandName());
                bp = approved.stream().filter(p -> LocalAdvisors.jaroWinkler(norm, LocalAdvisors.normalize(p.getBrandName())) >= 0.92)
                        .findFirst().orElse(null);
            }
            if (bp != null && bp.getApprovalStatus() == ApprovalStatus.APROVADO) {
                byBrandProfile.computeIfAbsent(bp.getId(), k -> new ArrayList<>()).add(w);
            } else if (w.getBrandName() != null && !unregistered.contains(w.getBrandName())) {
                unregistered.add(w.getBrandName());
            }
        }
        for (Map.Entry<UUID, List<WardrobeItem>> e : byBrandProfile.entrySet()) {
            BrandProfile bp = brandProfiles.findById(e.getKey()).orElseThrow();
            if (governed.contains(bp.getOwner().getId())) {
                continue;
            }
            int k = e.getValue().size();
            double conf = Math.min(0.99, 0.45 + 0.5 * k / n + (e.getValue().stream().anyMatch(w -> w.getBrand() != null) ? 0.05 : 0));
            if (conf < bp.getSealConfidenceThreshold().doubleValue()) {
                continue;
            }
            out.add(new Candidate(bp.getOwner().getId(), "BRAND", bp.getBrandName(), bp.getLogoUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP),
                    Msg.t("seal.de_pecas_identificadas_como", (k), n, bp.getBrandName()), k == 1 ? SealTier.PECA : SealTier.LOOK,
                    e.getValue().stream().map(WardrobeItem::getId).toList(), SealBondBasis.BRAND_MATCH, null));
        }
        // Celebridades verificadas: assinatura de estilo (RF21.CA17/CA18).
        Similarity.Signature sig = Similarity.of(scheme, items);
        for (CelebrityProfile cp : celebrityProfiles.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (!cp.isSealConsentGranted() || governed.contains(cp.getOwner().getId())) {
                continue;
            }
            Map<String, Object> signature = Json.map(cp.getStyleSignatureJson());
            Set<String> styles = strings(signature.get("styles"));
            Set<String> colors = strings(signature.get("colors"));
            Set<String> types = strings(signature.get("pieceTypes"));
            Set<String> occasions = strings(signature.get("occasions"));
            Similarity.Signature celeb = new Similarity.Signature(styles, Set.of(), colors, occasions, types);
            double sim = Similarity.weighted(sig, celeb);
            double conf = Math.min(0.97, 0.3 + sim);
            if (conf < cp.getSealConfidenceThreshold().doubleValue()) {
                continue;
            }
            String era = signature.get("era") == null ? null : String.valueOf(signature.get("era"));
            Set<String> matchedStyles = new HashSet<>(sig.styles());
            matchedStyles.retainAll(styles);
            Set<String> matchedColors = new HashSet<>(sig.colors());
            matchedColors.retainAll(colors);
            String why = Msg.t("seal.compativeis", ((matchedStyles.isEmpty() ? "" : "estilo " + String.join("/", matchedStyles)) + (matchedColors.isEmpty() ? "" : (matchedStyles.isEmpty() ? "" : " e ") + "paleta " + String.join("/", matchedColors))), (era == null ? "" : Msg.t("seal.com_a_era", era)));
            out.add(new Candidate(cp.getOwner().getId(), "CELEBRITY", cp.getStageName(), cp.getAvatarUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP), why.trim(), items.size() == 1 ? SealTier.PECA : SealTier.LOOK,
                    items.stream().map(si -> si.getWardrobeItem().getId()).toList(), SealBondBasis.STYLE_SIGNATURE, era));
        }
        out.sort((a, b) -> b.confidence().compareTo(a.confidence()));
        return SealHypeLookups.byHype(out.size() > SealService.MAX_SUGGESTIONS ? out.subList(0, SealService.MAX_SUGGESTIONS) : out, hype);
    }

    /** Avalia os selos ativos com política; devolve os emissores "governados" por regras (com ou sem acerto). */
    private Set<UUID> policyCandidates(Scheme scheme, List<SchemeItem> items, boolean pieceOnly, List<Candidate> out,
                                       SealPolicies.HypeLookup hype) {
        Set<UUID> governed = new HashSet<>();
        List<WardrobeItem> pieces = items.stream().map(SchemeItem::getWardrobeItem).filter(java.util.Objects::nonNull).toList();
        if (pieces.isEmpty()) {
            return governed;
        }
        List<String> occ = Json.csv(scheme.getOccasion());
        List<String> sty = Json.csv(scheme.getStyle());
        Instant now = Instant.now();
        Map<UUID, Candidate> best = new LinkedHashMap<>();
        for (Seal seal : seals.findByStatus(SealStatus.ACTIVE)) {
            SealPolicies.Policy pol = SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
            if (seal.getTier() == SealTier.PERFIL || pol == null || !SealViews.available(seal, now)) {
                continue;
            }
            User owner = seal.getOwner();
            SealIssuers.Issuer issuer = issuers.issuer(owner);
            if (issuer == null) {
                continue;
            }
            governed.add(owner.getId());
            SealPolicies.Verdict v;
            if (seal.getTier() == SealTier.PECA) {
                List<SealPolicies.Verdict> hits = new ArrayList<>();
                List<WardrobeItem> ok = new ArrayList<>();
                for (WardrobeItem w : pieces) {
                    SealPolicies.Verdict pv = SealPolicies.evaluate(pol, SealTier.PECA, List.of(w),
                            pol.referenceModel() == null ? occ : Json.csv(w.getOccasionTags()),
                            pol.referenceModel() == null ? sty : Json.csv(w.getStyleTags()), hype, referenceBackground(scheme));
                    if (pv.matched()) {
                        ok.add(w);
                        hits.add(pv);
                    }
                }
                // o "porquê" da peça com mais Hype (a primeira vinculada), que traz o trecho de Hype quando houver critério
                int top = 0;
                for (int i = 1; i < ok.size(); i++) {
                    if (hypeScore(hype, ok.get(i)) > hypeScore(hype, ok.get(top))) {
                        top = i;
                    }
                }
                if (!ok.isEmpty() && top > 0) {
                    ok.add(0, ok.remove(top));
                    hits.add(0, hits.remove(top));
                }
                v = ok.isEmpty() ? new SealPolicies.Verdict(false, List.of(), null)
                        : new SealPolicies.Verdict(true, ok.stream().map(WardrobeItem::getId).toList(),
                        pol.usesHype() ? hits.get(0).why() : SealPolicies.describe(pol, SealTier.PECA));
            } else if (pieceOnly) {
                continue;
            } else {
                v = SealPolicies.evaluate(pol, SealTier.LOOK, pieces, occ, sty, hype, referenceBackground(scheme));
            }
            if (!v.matched() || best.containsKey(owner.getId())) {
                continue;                                      // um selo por emissor: o mais recente que atende
            }
            best.put(owner.getId(), new Candidate(owner.getId(), issuer.kind(), issuer.name(), issuer.logoUrl(),
                    BigDecimal.valueOf(0.97).setScale(3, RoundingMode.HALF_UP), Msg.t("sealPolicy.atende", seal.getName(), v.why()),
                    seal.getTier(), v.pieceIds(), issuer.celebrity() ? SealBondBasis.STYLE_SIGNATURE : SealBondBasis.BRAND_MATCH, null, seal.getId()));
        }
        out.addAll(best.values());
        return governed;
    }

    private static double hypeScore(SealPolicies.HypeLookup hype, WardrobeItem w) {
        SealPolicies.HypeFact f = hype == null ? null : hype.piece(w.getId());
        return f == null || !f.available() || f.score() == null ? -1 : f.score();
    }

    private static Set<String> strings(Object o) {
        Set<String> s = new HashSet<>();
        if (o instanceof Collection<?> c) {
            c.forEach(x -> s.add(String.valueOf(x)));
        }
        return s;
    }
}
