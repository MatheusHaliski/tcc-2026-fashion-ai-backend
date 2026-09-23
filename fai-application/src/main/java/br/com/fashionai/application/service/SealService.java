package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.RedemptionStatus;
import br.com.fashionai.domain.model.enums.SealBondBasis;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF20 / RF21 (docs/rf20-rf21-vinculo-marca-celebridade.md, CA01–CA23), RF25 (selos de marca/celebridade com
 * arte de background) e RNF12 (promoções só para selos ativos e disponíveis). Mecanismo: a IA sugere até 3
 * vínculos na criação do look → o usuário aceita, edita ou recusa → pendente → auto-aprovado se o perfil não
 * exigir revisão (celebridade SEMPRE exige — CA19) → selo emitido (tier PEÇA ou LOOK) → promoções.
 */
@Service
public class SealService {
    public static final int MAX_SUGGESTIONS = 3;
    public static final Duration DEFAULT_SEAL_VALIDITY = Duration.ofDays(365);
    private static final Set<SealBondStatus> OPEN = Set.of(SealBondStatus.SUGGESTED, SealBondStatus.ACCEPTED,
            SealBondStatus.EDITED, SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED);

    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository redemptions;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final UserRepository users;
    private final NotificationService notifications;
    private final AiEngine ai;
    private final Guard guard;
    private final Audit audit;

    public SealService(SealRepository seals, SealBondRepository bonds, PromotionRepository promotions,
                       PromotionRedemptionRepository redemptions, SchemeRepository schemes, SchemeItemRepository schemeItems,
                       BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles,
                       UserRepository users, NotificationService notifications, AiEngine ai, Guard guard, Audit audit) {
        this.seals = seals;
        this.bonds = bonds;
        this.promotions = promotions;
        this.redemptions = redemptions;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.users = users;
        this.notifications = notifications;
        this.ai = ai;
        this.guard = guard;
        this.audit = audit;
    }

    // ================================================================== RF25 — selos do perfil emissor
    public record SealForm(String name, SealTier tier, String policyText, String iconUrl, Map<String, Object> background,
                           Instant availableFrom, Instant availableUntil, Integer usageLimit, SealStatus status) {
    }

    @Transactional
    public Map<String, Object> createSeal(CurrentUser user, SealForm form) {
        requireIssuer(user);
        User owner = users.findById(user.id()).orElseThrow();
        Seal s = new Seal();
        s.setOwner(owner);
        applySeal(s, form, owner);
        seals.save(s);
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "create"));
        return sealView(s);
    }

    @Transactional
    public Map<String, Object> updateSeal(CurrentUser user, UUID sealId, SealForm form) {
        requireIssuer(user);
        Seal s = seals.findById(sealId).orElseThrow(() -> ApiException.notFound("Selo"));
        guard.requireOwner(user, s.getOwner().getId(), "seal:" + sealId);
        applySeal(s, form, s.getOwner());
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "update"));
        return sealView(s);
    }

    private void applySeal(Seal s, SealForm f, User owner) {
        s.setName(InputSanitizer.required("name", f.name(), 2, 160));
        s.setTier(f.tier() == null ? SealTier.LOOK : f.tier());
        s.setPolicyText(InputSanitizer.clean(f.policyText(), 2048));
        s.setIconUrl(f.iconUrl());
        s.setBackgroundConfigJson(f.background() == null ? null : Json.write(f.background()));
        if (f.availableFrom() != null && f.availableUntil() != null && f.availableUntil().isBefore(f.availableFrom())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", "A disponibilidade termina antes de começar.");
        }
        s.setAvailableFrom(f.availableFrom());
        s.setAvailableUntil(f.availableUntil());
        if (f.usageLimit() != null && f.usageLimit() < 1) {
            throw ApiException.badRequest("LIMITE_INVALIDO", "O limite de emissão precisa ser positivo.");
        }
        s.setUsageLimit(f.usageLimit());
        s.setStatus(f.status() == null ? SealStatus.ACTIVE : f.status());
        // RF21.CA20 — selo de celebridade é Premium (vítreo/holográfico); de marca é têxtil/dourado.
        s.setPremium(owner.getProfileType() == ProfileType.CELEBRIDADE);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> sealsOf(UUID ownerId) {
        return seals.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream().map(this::sealView).toList();
    }

    /** RNF12 — um selo está disponível quando ativo, dentro da janela e abaixo do teto de emissão. */
    public static boolean available(Seal s, Instant now) {
        return s.getStatus() == SealStatus.ACTIVE
                && (s.getAvailableFrom() == null || !s.getAvailableFrom().isAfter(now))
                && (s.getAvailableUntil() == null || s.getAvailableUntil().isAfter(now))
                && (s.getUsageLimit() == null || s.getUsageCount() < s.getUsageLimit());
    }

    public static String unavailableReason(Seal s, Instant now) {
        if (s.getStatus() != SealStatus.ACTIVE) {
            return "O selo está inativo.";
        }
        if (s.getAvailableFrom() != null && s.getAvailableFrom().isAfter(now)) {
            return "O selo só fica disponível a partir de " + s.getAvailableFrom() + ".";
        }
        if (s.getAvailableUntil() != null && !s.getAvailableUntil().isAfter(now)) {
            return "O período de emissão do selo terminou.";
        }
        if (s.getUsageLimit() != null && s.getUsageCount() >= s.getUsageLimit()) {
            return "A campanha atingiu o limite de selos emitidos.";
        }
        return null;
    }

    Map<String, Object> sealView(Seal s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("ownerId", s.getOwner().getId());
        m.put("owner", Views.user(s.getOwner()));
        m.put("name", s.getName());
        m.put("tier", s.getTier());
        m.put("kind", s.isPremium() ? "PREMIUM_SEAL" : "BRAND_SEAL");
        m.put("visualFamily", s.isPremium() ? "vitreo-holografico" : "textil-dourado");
        m.put("policyText", s.getPolicyText());
        m.put("iconUrl", s.getIconUrl());
        m.put("background", Json.map(s.getBackgroundConfigJson()));
        m.put("status", s.getStatus());
        m.put("availableFrom", s.getAvailableFrom());
        m.put("availableUntil", s.getAvailableUntil());
        m.put("usageLimit", s.getUsageLimit());
        m.put("usageCount", s.getUsageCount());
        m.put("available", available(s, Instant.now()));
        m.put("unavailableReason", unavailableReason(s, Instant.now()));
        return m;
    }

    /** Selos padrão criados na aprovação do perfil (um por tier), para que o vínculo sempre tenha selo a emitir. */
    @Transactional
    public void ensureDefaultSeals(User owner) {
        if (!seals.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).isEmpty()) {
            return;
        }
        boolean premium = owner.getProfileType() == ProfileType.CELEBRIDADE;
        for (SealTier tier : SealTier.values()) {
            Seal s = new Seal();
            s.setOwner(owner);
            s.setName((premium ? "Selo Premium " : "Selo ") + owner.getDisplayName() + (tier == SealTier.PECA ? " · Peça" : " · Look"));
            s.setTier(tier);
            s.setPremium(premium);
            s.setAutoIssued(true);
            s.setPolicyText(tier == SealTier.PECA ? "Concedido a looks com 1 peça vinculada." : "Concedido a looks com várias peças vinculadas ou o look inteiro.");
            seals.save(s);
        }
    }

    // ================================================================== RF20.CA01 / RF21.CA17 — sugestões
    public record Candidate(UUID targetOwnerId, String kind, String name, String logoUrl, BigDecimal confidence,
                            String justification, SealTier tier, List<UUID> linkedPieceIds, SealBondBasis basis,
                            String eraLabel) {
    }

    /** Executa a análise das peças e grava até 3 sugestões (status SUGGESTED). Não bloqueia o salvamento. */
    @Transactional
    public Map<String, Object> suggest(CurrentUser user, UUID schemeId) {
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        List<String> unregistered = new ArrayList<>();
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of("marcas das peças", "estilo/ocasião do esquema", "assinatura de estilo das celebridades verificadas"),
                () -> candidates(scheme, items, unregistered));
        // descarta sugestões anteriores ainda não respondidas
        bonds.findBySchemeId(schemeId).stream().filter(b -> b.getStatus() == SealBondStatus.SUGGESTED).forEach(bonds::delete);
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (Candidate c : outcome.value()) {
            boolean exists = !bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(schemeId, c.targetOwnerId(),
                    List.of(SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED)).isEmpty();
            if (exists) {
                continue;
            }
            SealBond b = new SealBond();
            b.setScheme(scheme);
            b.setTargetOwner(users.findById(c.targetOwnerId()).orElseThrow());
            b.setRequestedBy(scheme.getUser());
            b.setTier(c.tier());
            b.setLinkedPieceIdsJson(Json.write(c.linkedPieceIds()));
            b.setConfidence(c.confidence());
            b.setJustification(c.justification());
            b.setBasis(c.basis());
            b.setStatus(SealBondStatus.SUGGESTED);
            b.setOrigin(SealBondOrigin.AI_SUGGESTION);
            b.setAiInferenceId(outcome.inferenceId());
            b.setEraLabel(c.eraLabel());
            bonds.save(b);
            suggestions.add(bondView(b));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("suggestions", suggestions);
        out.put("unregisteredBrands", unregistered);
        out.put("message", suggestions.isEmpty()
                ? "Nenhuma marca ou celebridade atingiu a confiança mínima. Você pode vincular manualmente."
                : null);
        if (!unregistered.isEmpty()) {
            out.put("unregisteredMessage", "Somente marcas com perfil cadastrado podem conceder selos: " + String.join(", ", unregistered) + ".");
        }
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        return out;
    }

    List<Candidate> candidates(Scheme scheme, List<SchemeItem> items, List<String> unregistered) {
        List<Candidate> out = new ArrayList<>();
        int n = Math.max(1, items.size());
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
            int k = e.getValue().size();
            double conf = Math.min(0.99, 0.45 + 0.5 * k / n + (e.getValue().stream().anyMatch(w -> w.getBrand() != null) ? 0.05 : 0));
            if (conf < bp.getSealConfidenceThreshold().doubleValue()) {
                continue;
            }
            out.add(new Candidate(bp.getOwner().getId(), "BRAND", bp.getBrandName(), bp.getLogoUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP),
                    k + " de " + n + " peças identificadas como " + bp.getBrandName(), k == 1 ? SealTier.PECA : SealTier.LOOK,
                    e.getValue().stream().map(WardrobeItem::getId).toList(), SealBondBasis.BRAND_MATCH, null));
        }
        // Celebridades verificadas: assinatura de estilo (RF21.CA17/CA18).
        Similarity.Signature sig = Similarity.of(scheme, items);
        for (CelebrityProfile cp : celebrityProfiles.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (!cp.isSealConsentGranted()) {
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
            String why = (matchedStyles.isEmpty() ? "" : "estilo " + String.join("/", matchedStyles))
                    + (matchedColors.isEmpty() ? "" : (matchedStyles.isEmpty() ? "" : " e ") + "paleta " + String.join("/", matchedColors))
                    + " compatíveis" + (era == null ? "" : " com a era " + era);
            out.add(new Candidate(cp.getOwner().getId(), "CELEBRITY", cp.getStageName(), cp.getAvatarUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP), why.trim(), items.size() == 1 ? SealTier.PECA : SealTier.LOOK,
                    items.stream().map(si -> si.getWardrobeItem().getId()).toList(), SealBondBasis.STYLE_SIGNATURE, era));
        }
        out.sort((a, b) -> b.confidence().compareTo(a.confidence()));
        return out.size() > MAX_SUGGESTIONS ? out.subList(0, MAX_SUGGESTIONS) : out;
    }

    private static Set<String> strings(Object o) {
        Set<String> s = new HashSet<>();
        if (o instanceof Collection<?> c) {
            c.forEach(x -> s.add(String.valueOf(x)));
        }
        return s;
    }

    // ================================================================== CA02 aceite · CA03 edição · CA04 recusa
    @Transactional
    public Map<String, Object> accept(CurrentUser user, UUID bondId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED && b.getStatus() != SealBondStatus.REFUSED) {
            throw ApiException.conflict("ESTADO_INVALIDO", "Este vínculo já foi respondido.");
        }
        b.setStatus(SealBondStatus.ACCEPTED);
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        return route(user, b);
    }

    /** CA03 — escolher outra marca/celebridade da lista (origem MANUAL). */
    @Transactional
    public Map<String, Object> linkManually(CurrentUser user, UUID schemeId, UUID targetOwnerId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        User target = users.findById(targetOwnerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (target.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.badRequest("PERFIL_INVALIDO", "Só marcas e celebridades cadastradas concedem selos.");
        }
        if (target.getProfileType() == ProfileType.MARCA && brandProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getApprovalStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("MARCA_NAO_VALIDADA", "Somente marcas com perfil validado podem conceder selos (RF20.CA06).");
        }
        if (target.getProfileType() == ProfileType.CELEBRIDADE && celebrityProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getVerificationStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("CELEBRIDADE_NAO_VERIFICADA", "Somente celebridades verificadas concedem Selo Premium (RF21.CA18).");
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        bonds.findBySchemeId(schemeId).stream()
                .filter(x -> x.getTargetOwner().getId().equals(targetOwnerId) && x.getStatus() == SealBondStatus.SUGGESTED)
                .forEach(bonds::delete);
        SealBond b = new SealBond();
        b.setScheme(scheme);
        b.setTargetOwner(target);
        b.setRequestedBy(scheme.getUser());
        b.setTier(items.size() <= 1 ? SealTier.PECA : SealTier.LOOK);
        b.setLinkedPieceIdsJson(Json.write(items.stream().map(si -> si.getWardrobeItem().getId()).toList()));
        b.setBasis(target.getProfileType() == ProfileType.CELEBRIDADE ? SealBondBasis.STYLE_SIGNATURE : SealBondBasis.BRAND_MATCH);
        b.setOrigin(SealBondOrigin.MANUAL);
        b.setStatus(SealBondStatus.EDITED);
        b.setJustification("Vínculo escolhido manualmente pelo usuário.");
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        requireUnique(b);
        bonds.save(b);
        return route(user, b);
    }

    @Transactional
    public Map<String, Object> refuse(CurrentUser user, UUID bondId) {
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED) {
            throw ApiException.conflict("ESTADO_INVALIDO", "Só sugestões podem ser recusadas.");
        }
        b.setStatus(SealBondStatus.REFUSED);
        b.setRespondedAt(Instant.now());
        logBond(user, b, "RECUSADO");
        return bondView(b);
    }

    /** Recusa de todas as sugestões do esquema (CA04) — guardadas em "Meus Selos" para aplicação manual depois. */
    @Transactional
    public int refuseAll(CurrentUser user, UUID schemeId) {
        int n = 0;
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.SUGGESTED && b.getRequestedBy().getId().equals(user.id())) {
                b.setStatus(SealBondStatus.REFUSED);
                b.setRespondedAt(Instant.now());
                logBond(user, b, "RECUSADO");
                n++;
            }
        }
        return n;
    }

    private void requireUnique(SealBond b) {
        boolean dup = !bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(b.getScheme().getId(), b.getTargetOwner().getId(),
                List.of(SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED)).isEmpty();
        if (dup) {
            // RF20.CA09 — selo único por par esquema/emissor.
            throw ApiException.conflict("VINCULO_EXISTENTE", "Este esquema já tem vínculo com este perfil.");
        }
    }

    /** Pendente → auto-aprovação (marca sem revisão) ou fila de revisão; celebridade sempre revisa (CA19). */
    private Map<String, Object> route(CurrentUser user, SealBond b) {
        requireUnique(b);
        User target = b.getTargetOwner();
        boolean celebrity = target.getProfileType() == ProfileType.CELEBRIDADE;
        if (celebrity && !Boolean.TRUE.equals(b.getImageRightsConsent())) {
            throw ApiException.badRequest("CONSENTIMENTO_IMAGEM",
                    "Confirme que entende que o look será associado publicamente à imagem da celebridade (RF21.CA19).");
        }
        Seal seal = sealFor(target, b.getTier());
        String reason = seal == null ? "O perfil não tem selo ativo para este tier." : unavailableReason(seal, Instant.now());
        if (reason != null) {
            // RF21.CA23 — teto atingido: recusa com mensagem explicativa, sem emissão.
            b.setStatus(SealBondStatus.REJECTED);
            b.setReviewNote(reason);
            logBond(user, b, "RECUSADO_LIMITE");
            throw ApiException.conflict("SELO_INDISPONIVEL", reason);
        }
        boolean requiresReview = celebrity || brandProfiles.findByOwnerId(target.getId()).map(BrandProfile::isRequiresSealReview).orElse(false);
        b.setRequiresReview(requiresReview);
        b.setSeal(seal);
        if (requiresReview) {
            b.setStatus(SealBondStatus.PENDING_REVIEW);
            notifications.notify(target.getId(), b.getRequestedBy().getId(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND",
                    b.getId(), "Novo vínculo para revisar", "@" + b.getRequestedBy().getUsername() + " vinculou o look \""
                            + b.getScheme().getTitle() + "\" ao seu perfil.", null);
            logBond(user, b, "PENDENTE");
        } else {
            issue(b, null);
        }
        return bondView(b);
    }

    private Seal sealFor(User target, SealTier tier) {
        List<Seal> active = seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(target.getId(), SealStatus.ACTIVE);
        return active.stream().filter(s -> s.getTier() == tier).findFirst().orElse(active.isEmpty() ? null : active.get(0));
    }

    /** CA08 — emissão do selo único e rastreável. */
    private void issue(SealBond b, UUID decidedBy) {
        Seal seal = b.getSeal();
        b.setStatus(SealBondStatus.APPROVED);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(decidedBy);
        b.setIssuedAt(Instant.now());
        b.setExpiresAt(seal.getAvailableUntil() != null ? seal.getAvailableUntil() : Instant.now().plus(DEFAULT_SEAL_VALIDITY));
        String prefix = b.getTargetOwner().getProfileType() == ProfileType.CELEBRIDADE ? "PRM" : "BRD";
        String code;
        do {
            code = Hashing.promoCode(prefix);
        } while (bonds.findBySealCode(code).isPresent());
        b.setSealCode(code);
        seal.setUsageCount(seal.getUsageCount() + 1);
        Scheme scheme = b.getScheme();
        List<String> ids = new ArrayList<>(Json.strings(scheme.getSealIdsJson()));
        if (!ids.contains(b.getId().toString())) {
            ids.add(b.getId().toString());
        }
        scheme.setSealIdsJson(Json.write(ids));
        notifications.notify(b.getRequestedBy().getId(), b.getTargetOwner().getId(), NotificationType.SEAL_GRANTED, "SEAL_BOND",
                b.getId(), (seal.isPremium() ? "Selo Premium" : "Selo de Marca") + " emitido!",
                "Seu look \"" + scheme.getTitle() + "\" recebeu o selo " + seal.getName() + ". Veja as promoções em Meus Selos.", null);
        logBond(null, b, "EMITIDO");
    }

    // ================================================================== CA07 revisão · CA14 revogação
    @Transactional(readOnly = true)
    public List<Map<String, Object>> reviewQueue(CurrentUser user) {
        requireIssuer(user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(user.id(), SealBondStatus.PENDING_REVIEW)) {
            Map<String, Object> v = bondView(b);
            v.put("scheme", schemeSummary(b.getScheme()));
            out.add(v);
        }
        // revalidação pendente (RF9.CA05): vínculos aprovados cujo esquema mudou a lista de peças.
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)) {
            if (b.getScheme().isRevalidationPending()) {
                Map<String, Object> v = bondView(b);
                v.put("revalidation", true);
                v.put("scheme", schemeSummary(b.getScheme()));
                out.add(v);
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> review(CurrentUser user, UUID bondId, boolean approve, String reason) {
        requireIssuer(user);
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound("Vínculo"));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        boolean revalidation = b.getStatus() == SealBondStatus.APPROVED && b.getScheme().isRevalidationPending();
        if (b.getStatus() != SealBondStatus.PENDING_REVIEW && !revalidation) {
            throw ApiException.conflict("ESTADO_INVALIDO", "Este vínculo não está aguardando revisão.");
        }
        if (approve) {
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
                b.setReviewNote("revalidado");
                logBond(user, b, "REVALIDADO");
            } else {
                issue(b, user.id());
            }
        } else {
            if (reason == null || reason.isBlank()) {
                throw ApiException.badRequest("MOTIVO_OBRIGATORIO", "Informe o motivo da rejeição.");
            }
            b.setStatus(revalidation ? SealBondStatus.REVOKED : SealBondStatus.REJECTED);
            b.setReviewNote(InputSanitizer.clean(reason, 1000));
            b.setReviewedAt(Instant.now());
            b.setReviewedBy(user.id());
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
            }
            notifications.notify(b.getRequestedBy().getId(), user.id(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                    "Vínculo " + (revalidation ? "revogado" : "não aprovado"), "Motivo: " + b.getReviewNote(), null);
            logBond(user, b, revalidation ? "REVOGADO" : "REJEITADO");
        }
        return bondView(b);
    }

    @Transactional
    public Map<String, Object> revoke(CurrentUser user, UUID bondId, String reason) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound("Vínculo"));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        revokeInternal(b, reason == null ? "uso indevido" : reason, user.id());
        return bondView(b);
    }

    /** CA14 — esquema excluído ou tornado privado revoga os selos (cupons resgatados continuam válidos). */
    @Transactional
    public void revokeForScheme(UUID schemeId, String reason) {
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                revokeInternal(b, reason, null);
            } else if (b.getStatus() == SealBondStatus.SUGGESTED || b.getStatus() == SealBondStatus.PENDING_REVIEW) {
                b.setStatus(SealBondStatus.REVOKED);
                b.setReviewNote(reason);
            }
        }
    }

    private void revokeInternal(SealBond b, String reason, UUID by) {
        b.setStatus(SealBondStatus.REVOKED);
        b.setReviewNote(reason);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(by);
        notifications.notify(b.getRequestedBy().getId(), by, NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                "Selo revogado", "O selo do look \"" + b.getScheme().getTitle() + "\" foi revogado: " + reason, null);
        logBond(null, b, "REVOGADO");
    }

    /** RF9.CA05 — edição da lista de peças de esquema com vínculo aprovado: revalidação pendente + aviso ao emissor. */
    @Transactional
    public void flagRevalidation(Scheme scheme) {
        boolean any = false;
        for (SealBond b : bonds.findBySchemeId(scheme.getId())) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                any = true;
                notifications.notify(b.getTargetOwner().getId(), scheme.getUser().getId(), NotificationType.SEAL_BOND_REVIEW,
                        "SEAL_BOND", b.getId(), "Revalidação pendente",
                        "O look \"" + scheme.getTitle() + "\" vinculado ao seu perfil teve a lista de peças alterada.", null);
            }
        }
        scheme.setRevalidationPending(any);
    }

    // ================================================================== Meus Selos
    @Transactional(readOnly = true)
    public Map<String, Object> mySeals(CurrentUser user) {
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        groups.put("ativos", new ArrayList<>());
        groups.put("pendentes", new ArrayList<>());
        groups.put("recusados", new ArrayList<>());
        groups.put("sugeridos", new ArrayList<>());
        groups.put("inativos", new ArrayList<>());
        Instant now = Instant.now();
        for (SealBond b : bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id())) {
            Map<String, Object> v = bondView(b);
            v.put("scheme", schemeSummary(b.getScheme()));
            switch (b.getStatus()) {
                case APPROVED -> {
                    if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now)) {
                        v.put("state", "EXPIRADO");
                        groups.get("inativos").add(v);
                    } else {
                        v.put("promotions", promotionsFor(user, b));
                        groups.get("ativos").add(v);
                    }
                }
                case PENDING_REVIEW, ACCEPTED, EDITED -> groups.get("pendentes").add(v);
                case REFUSED -> groups.get("recusados").add(v);
                case SUGGESTED -> groups.get("sugeridos").add(v);
                default -> groups.get("inativos").add(v);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>(groups);
        out.put("redemptions", redemptions.findByUserIdOrderByRedeemedAtDesc(user.id()).stream().map(this::redemptionView).toList());
        return out;
    }

    // ================================================================== promoções (CA11–CA13, CA21–CA23, RNF12)
    public record PromotionForm(PromotionType type, String title, String description, String rules, Integer discountPercent,
                                UUID sealId, String requiredSealKind, Instant startsAt, Instant expiresAt,
                                Integer totalQuota, Integer perUserLimit, UUID partnerBrandUserId, Visibility visibility) {
    }

    @Transactional
    public Map<String, Object> createPromotion(CurrentUser user, PromotionForm f) {
        requireIssuer(user);
        Promotion p = new Promotion();
        p.setOwnerUserId(user.id());
        applyPromotion(user, p, f);
        promotions.save(p);
        return promotionView(p, null);
    }

    @Transactional
    public Map<String, Object> updatePromotion(CurrentUser user, UUID id, PromotionForm f) {
        requireIssuer(user);
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound("Promoção"));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        applyPromotion(user, p, f);
        return promotionView(p, null);
    }

    @Transactional
    public Map<String, Object> setPromotionStatus(CurrentUser user, UUID id, PromotionStatus status) {
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound("Promoção"));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        p.setStatus(status);
        return promotionView(p, null);
    }

    private void applyPromotion(CurrentUser user, Promotion p, PromotionForm f) {
        if (f.type() == null) {
            throw ApiException.badRequest("TIPO_OBRIGATORIO", "Escolha o tipo da promoção.");
        }
        User owner = users.findById(user.id()).orElseThrow();
        boolean celebrity = owner.getProfileType() == ProfileType.CELEBRIDADE;
        Set<PromotionType> brandTypes = Set.of(PromotionType.DESCONTO_ECOMMERCE, PromotionType.CUPOM_LOJA,
                PromotionType.FRETE_GRATIS, PromotionType.BRINDE, PromotionType.ACESSO_ANTECIPADO, PromotionType.EVENTO);
        if (!celebrity && !brandTypes.contains(f.type())) {
            throw ApiException.badRequest("TIPO_INVALIDO", "Tipo exclusivo de promoções de celebridade.");
        }
        p.setType(f.type());
        p.setTitle(InputSanitizer.required("title", f.title(), 3, 160));
        p.setDescription(InputSanitizer.clean(f.description(), 512));
        p.setRules(InputSanitizer.clean(f.rules(), 2048));
        if (f.discountPercent() != null && (f.discountPercent() < 1 || f.discountPercent() > 90)) {
            throw ApiException.badRequest("DESCONTO_INVALIDO", "Desconto entre 1% e 90%.");
        }
        p.setDiscountPercent(f.discountPercent());
        if (f.sealId() != null) {
            Seal seal = seals.findById(f.sealId()).orElseThrow(() -> ApiException.notFound("Selo"));
            guard.requireOwner(user, seal.getOwner().getId(), "seal:" + f.sealId());
            if (seal.getStatus() != SealStatus.ACTIVE) {
                // RNF12 — promoções só se aplicam a selos ativos.
                throw ApiException.badRequest("SELO_INATIVO", "Promoções só podem ser aplicadas a selos ativos.");
            }
            p.setSeal(seal);
        }
        p.setRequiredSealKind(celebrity ? "PREMIUM_SEAL" : "BRAND_SEAL");
        p.setStartsAt(f.startsAt());
        p.setExpiresAt(f.expiresAt());
        if (f.startsAt() != null && f.expiresAt() != null && f.expiresAt().isBefore(f.startsAt())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", "A promoção termina antes de começar.");
        }
        p.setTotalQuota(f.totalQuota());
        p.setPerUserLimit(f.perUserLimit() == null ? 1 : Math.max(1, f.perUserLimit()));
        if (f.partnerBrandUserId() != null) {
            if (!celebrity) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", "Marca parceira só se aplica a promoções de celebridade (RF21.CA22).");
            }
            User partner = users.findById(f.partnerBrandUserId()).orElseThrow(() -> ApiException.notFound("Marca parceira"));
            if (partner.getProfileType() != ProfileType.MARCA) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", "A parceira precisa ser uma marca cadastrada.");
            }
            p.setPartnerBrandUserId(partner.getId());
        }
        p.setVisibility(f.visibility() == null ? Visibility.PUBLIC : f.visibility());
    }

    /** Promoções do perfil, filtradas pelos selos do solicitante (CA11/CA21). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> promotionsOf(CurrentUser viewer, UUID ownerId) {
        List<SealBond> myBonds = viewer == null ? List.of() : bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(viewer.id(),
                SealBondStatus.APPROVED).stream().filter(b -> b.getTargetOwner().getId().equals(ownerId)).toList();
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(p -> owner || p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, myBonds))).toList();
    }

    private List<Map<String, Object>> promotionsFor(CurrentUser user, SealBond b) {
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(b.getTargetOwner().getId()).stream()
                .filter(p -> p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, List.of(b)))).toList();
    }

    private SealBond eligibleBond(Promotion p, List<SealBond> candidates) {
        Instant now = Instant.now();
        return candidates.stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                .filter(b -> b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))
                .filter(b -> p.getSeal() == null || (b.getSeal() != null && b.getSeal().getId().equals(p.getSeal().getId())))
                .findFirst().orElse(null);
    }

    Map<String, Object> promotionView(Promotion p, SealBond eligible) {
        Map<String, Object> m = new LinkedHashMap<>();
        Instant now = Instant.now();
        m.put("id", p.getId());
        m.put("ownerUserId", p.getOwnerUserId());
        m.put("type", p.getType());
        m.put("title", p.getTitle());
        m.put("description", p.getDescription());
        m.put("rules", p.getRules());
        m.put("discountPercent", p.getDiscountPercent());
        m.put("sealId", p.getSeal() == null ? null : p.getSeal().getId());
        m.put("requiredSealKind", p.getRequiredSealKind());
        m.put("startsAt", p.getStartsAt());
        m.put("expiresAt", p.getExpiresAt());
        m.put("totalQuota", p.getTotalQuota());
        m.put("remaining", p.getTotalQuota() == null ? null : Math.max(0, p.getTotalQuota() - p.getRedeemedCount()));
        m.put("perUserLimit", p.getPerUserLimit());
        m.put("partnerBrandUserId", p.getPartnerBrandUserId());
        m.put("status", p.getStatus());
        m.put("eligible", eligible != null && unavailable(p, now) == null);
        m.put("unavailableReason", eligible == null ? "É preciso ter um selo válido deste perfil para resgatar." : unavailable(p, now));
        m.put("eligibleBondId", eligible == null ? null : eligible.getId());
        return m;
    }

    static String unavailable(Promotion p, Instant now) {
        if (p.getStatus() != PromotionStatus.AVAILABLE) {
            return "Promoção " + (p.getStatus() == PromotionStatus.EXPIRED ? "expirada" : "indisponível") + ".";
        }
        if (p.getStartsAt() != null && p.getStartsAt().isAfter(now)) {
            return "A promoção começa em " + p.getStartsAt() + ".";
        }
        if (p.getExpiresAt() != null && !p.getExpiresAt().isAfter(now)) {
            return "Promoção expirada.";
        }
        if (p.getTotalQuota() != null && p.getRedeemedCount() >= p.getTotalQuota()) {
            return "Promoção esgotada.";
        }
        if (p.getSeal() != null && p.getSeal().getStatus() != SealStatus.ACTIVE) {
            return "O selo desta promoção está inativo.";
        }
        return null;
    }

    /** CA12/CA13/CA22 — resgate com código único, estoque e limite por usuário. */
    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID promotionId) {
        guard.requireCanCreate(user);
        Promotion p = promotions.findById(promotionId).orElseThrow(() -> ApiException.notFound("Promoção"));
        Instant now = Instant.now();
        String reason = unavailable(p, now);
        if (reason != null) {
            throw ApiException.conflict("PROMOCAO_INDISPONIVEL", reason);
        }
        List<SealBond> myBonds = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)
                .stream().filter(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId())).toList();
        SealBond bond = eligibleBond(p, myBonds);
        if (bond == null) {
            boolean revoked = bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id()).stream()
                    .anyMatch(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId()) && b.getStatus() == SealBondStatus.REVOKED);
            throw ApiException.conflict("SELO_INVALIDO", revoked ? "Seu selo deste perfil foi revogado."
                    : "É preciso ter um selo válido deste perfil para resgatar.");
        }
        long mine = redemptions.countByPromotionIdAndUserId(p.getId(), user.id());
        if (mine >= p.getPerUserLimit()) {
            throw ApiException.conflict("LIMITE_POR_USUARIO", "Você já resgatou esta promoção o máximo de vezes permitido.");
        }
        User owner = users.findById(p.getOwnerUserId()).orElseThrow();
        String prefix = owner.getUsername().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        prefix = prefix.substring(0, Math.min(5, prefix.length()));
        if (p.getPartnerBrandUserId() != null) {
            String partner = users.findById(p.getPartnerBrandUserId()).map(User::getUsername).orElse("PARC")
                    .replaceAll("[^A-Za-z0-9]", "").toUpperCase();
            prefix = prefix + "X" + partner.substring(0, Math.min(4, partner.length()));
        }
        String code;
        do {
            code = Hashing.promoCode(prefix);
        } while (promotions.findByCode(code).isPresent());
        PromotionRedemption r = new PromotionRedemption();
        r.setPromotion(p);
        r.setSealBond(bond);
        r.setUser(users.findById(user.id()).orElseThrow());
        r.setCode(code);
        r.setIssuerUserId(p.getOwnerUserId());
        r.setPartnerBrandUserId(p.getPartnerBrandUserId());
        r.setRedeemedAt(now);
        r.setExpiresAt(p.getExpiresAt());
        redemptions.save(r);
        p.setRedeemedCount(p.getRedeemedCount() + 1);
        if (p.getTotalQuota() != null && p.getRedeemedCount() >= p.getTotalQuota()) {
            p.setStatus(PromotionStatus.REDEEMED);
        }
        audit.log(user, AuditActions.PROMOCAO_RESGATADA, "promotion:" + p.getId(), Map.of("code", code,
                "issuer", p.getOwnerUserId().toString(), "partner", String.valueOf(p.getPartnerBrandUserId())));
        return redemptionView(r);
    }

    Map<String, Object> redemptionView(PromotionRedemption r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("promotionId", r.getPromotion().getId());
        m.put("promotionTitle", r.getPromotion().getTitle());
        m.put("issuerUserId", r.getIssuerUserId());
        m.put("partnerBrandUserId", r.getPartnerBrandUserId());
        m.put("status", r.getExpiresAt() != null && r.getExpiresAt().isBefore(Instant.now()) ? RedemptionStatus.EXPIRED : r.getStatus());
        m.put("redeemedAt", r.getRedeemedAt());
        m.put("expiresAt", r.getExpiresAt());
        return m;
    }

    /** Regra 7 — métricas por perfil emissor. */
    @Transactional(readOnly = true)
    public Map<String, Object> issuerMetrics(CurrentUser user) {
        requireIssuer(user);
        long suggested = bonds.countByTargetOwnerId(user.id());
        long approved = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.APPROVED);
        long pending = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.PENDING_REVIEW);
        long refused = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.REFUSED);
        long redeemed = redemptions.countByIssuerUserId(user.id()) + redemptions.countByPartnerBrandUserId(user.id());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("suggested", suggested);
        m.put("accepted", suggested - refused);
        m.put("approved", approved);
        m.put("pendingReview", pending);
        m.put("activeSeals", approved);
        m.put("redemptions", redeemed);
        m.put("conversionSealToRedemption", approved == 0 ? 0 : Math.round(redeemed * 1000.0 / approved) / 10.0);
        return m;
    }

    // ------------------------------------------------------------------ util
    private void requireIssuer(CurrentUser user) {
        guard.requireCanCreate(user);
        if (user.profileType() == ProfileType.PESSOAL) {
            throw guard.deny(user, "seals", "Selos e promoções são geridos por perfis de marca ou celebridade.");
        }
        guard.requireApprovedProfile(user, user.profileType());
    }

    private SealBond mine(CurrentUser user, UUID bondId) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound("Vínculo"));
        guard.requireOwner(user, b.getRequestedBy().getId(), "seal-bond:" + bondId);
        return b;
    }

    private void logBond(CurrentUser user, SealBond b, String result) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("origin", b.getOrigin().name());
        meta.put("confidence", b.getConfidence());
        meta.put("scheme", b.getScheme().getId().toString());
        meta.put("target", b.getTargetOwner().getId().toString());
        meta.put("status", b.getStatus().name());
        meta.put("decidedBy", b.getReviewedBy() == null ? (user == null ? "sistema(auto-aprovação)" : user.id().toString())
                : b.getReviewedBy().toString());
        audit.log(user == null ? "system" : user.id().toString(), AuditActions.MUDANCA_ESTADO_VINCULO_SELO,
                "seal-bond:" + b.getId(), result, null, null, meta);
    }

    Map<String, Object> bondView(SealBond b) {
        Map<String, Object> m = new LinkedHashMap<>();
        User t = b.getTargetOwner();
        m.put("id", b.getId());
        m.put("schemeId", b.getScheme().getId());
        m.put("target", Views.user(t));
        m.put("kind", t.getProfileType() == ProfileType.CELEBRIDADE ? "CELEBRITY" : "BRAND");
        m.put("sealKind", t.getProfileType() == ProfileType.CELEBRIDADE ? "PREMIUM_SEAL" : "BRAND_SEAL");
        m.put("visualFamily", t.getProfileType() == ProfileType.CELEBRIDADE ? "vitreo-holografico" : "textil-dourado");
        m.put("tier", b.getTier());
        m.put("status", b.getStatus());
        m.put("origin", b.getOrigin());
        m.put("confidence", b.getConfidence());
        m.put("justification", b.getJustification());
        m.put("basis", b.getBasis());
        m.put("linkedPieceIds", Json.strings(b.getLinkedPieceIdsJson()));
        m.put("requiresReview", b.isRequiresReview());
        m.put("sealCode", b.getSealCode());
        m.put("seal", b.getSeal() == null ? null : Map.of("id", b.getSeal().getId(), "name", b.getSeal().getName(),
                "iconUrl", String.valueOf(b.getSeal().getIconUrl()), "premium", b.getSeal().isPremium()));
        m.put("eraLabel", b.getEraLabel());
        m.put("issuedAt", b.getIssuedAt());
        m.put("expiresAt", b.getExpiresAt());
        m.put("reviewNote", b.getReviewNote());
        m.put("aiInferenceId", b.getAiInferenceId());
        brandProfiles.findByOwnerId(t.getId()).ifPresent(bp -> m.put("logoUrl", bp.getLogoUrl()));
        return m;
    }

    private Map<String, Object> schemeSummary(Scheme s) {
        return Map.of("id", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl()),
                "visibility", s.getVisibility(), "owner", Views.user(s.getUser()));
    }

    static List<UUID> uuids(List<String> ids) {
        return ids.stream().map(UUID::fromString).collect(Collectors.toList());
    }
}
