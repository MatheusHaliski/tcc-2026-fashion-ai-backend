package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondBasis;
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
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * RF20 / RF21 (docs/rf20-rf21-vinculo-marca-celebridade.md, CA01–CA23), RF25 (selos de marca/celebridade com
 * arte de background) e RNF12 (promoções só para selos ativos e disponíveis). Mecanismo: a IA sugere até 3
 * vínculos na criação do look → o usuário aceita, edita ou recusa → pendente → auto-aprovado se o perfil não
 * exigir revisão (celebridade SEMPRE exige — CA19) → selo emitido (tier PEÇA ou LOOK) → promoções.
 *
 * <p>Facade (R80): o bean continua dono das transações, do contrato público e das dependências injetadas; cada caso
 * de uso fica num colaborador do pacote (emissores, Hype, views, formulário, Copilot, candidatos, sugestões, vitrine,
 * medalhões, roteamento, respostas, revisão e promoções). Ver docs/refactoring/gof/reducao/R80-seal.md.
 */
@Service
public class SealService {
    private br.com.fashionai.domain.repository.AiInferenceLogRepository sealInferenceLogs;
    private br.com.fashionai.domain.repository.BrandRepository sealBrands;
    private BackgroundStudioService sealBackgrounds;

    @org.springframework.beans.factory.annotation.Autowired
    public void setSealPolicyContext(br.com.fashionai.domain.repository.AiInferenceLogRepository logs,
                                     br.com.fashionai.domain.repository.BrandRepository brands, BackgroundStudioService backgrounds) {
        this.sealInferenceLogs = logs; this.sealBrands = brands; this.sealBackgrounds = backgrounds;
    }
    public static final int MAX_SUGGESTIONS = 3;
    public static final Duration DEFAULT_SEAL_VALIDITY = Duration.ofDays(365);

    private final SealIssuers issuers;
    private final SealHypeLookups lookups;
    private final SealViews views;
    private final SealFormWriter forms;
    private final SealPolicyDraftFlow drafts;
    private final SealSuggestionFlows suggestions;
    private final SealProfileShowcase showcase;
    private final SealPieceBadges badges;
    private final SealBondResponses responses;
    private final SealBondReviews reviews;
    private final SealPromotionReads promotionReads;
    private final SealPromotionWriter promotionWriter;

    public SealService(SealRepository seals, SealBondRepository bonds, PromotionRepository promotions,
                       PromotionRedemptionRepository redemptions, SchemeRepository schemes, SchemeItemRepository schemeItems,
                       BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles,
                       UserRepository users, WardrobeItemRepository wardrobeItems, NotificationService notifications, AiEngine ai,
                       Guard guard, Audit audit, ApplicationEventPublisher events, OwnMedia ownMedia) {
        issuers = new SealIssuers(brandProfiles, celebrityProfiles, guard);
        lookups = new SealHypeLookups(bonds, schemeItems, wardrobeItems, issuers, this::hype);
        SealHypeAverages averages = new SealHypeAverages(bonds, this::hype, () -> hypeCache);
        views = new SealViews(seals, users, brandProfiles, averages);
        forms = new SealFormWriter(seals, users, guard, audit, ownMedia, issuers, views, () -> sealInferenceLogs);
        drafts = new SealPolicyDraftFlow(seals, users, brandProfiles, celebrityProfiles, wardrobeItems, ai, audit, issuers,
                () -> sealBrands, () -> sealBackgrounds);
        SealCandidates candidates = new SealCandidates(seals, brandProfiles, celebrityProfiles, issuers);
        suggestions = new SealSuggestionFlows(seals, bonds, schemes, schemeItems, users, wardrobeItems, ai, guard, candidates, lookups, views);
        showcase = new SealProfileShowcase(seals, schemes, schemeItems, wardrobeItems, issuers, lookups);
        badges = new SealPieceBadges(bonds, schemeItems, wardrobeItems, guard);
        SealBondRouting routing = new SealBondRouting(seals, bonds, schemeItems, brandProfiles, notifications, audit, events, issuers,
                lookups, views);
        responses = new SealBondResponses(bonds, schemes, schemeItems, users, brandProfiles, celebrityProfiles, guard, routing, lookups, views);
        reviews = new SealBondReviews(seals, bonds, notifications, guard, issuers, routing, lookups, views);
        promotionReads = new SealPromotionReads(promotions, redemptions, bonds, users, issuers, averages, views);
        promotionWriter = new SealPromotionWriter(promotions, redemptions, seals, bonds, users, guard, audit, issuers, promotionReads);
    }

    // ================================================================== RF53 — Hype (opcional)
    /**
     * HypeScore v2 atual para os critérios de Hype das políticas, a ordem das sugestões e o "Hype do selo". Injetado por
     * setter (o construtor de 16 argumentos continua valendo): sem ele, critério de Hype é "não atendido" e o selo não
     * tem média. {@link ObjectProvider} porque o HypeQueryService depende do SchemeService, que depende deste serviço.
     */
    private ObjectProvider<HypeQueryService> hypeQuery;
    private HypeCache hypeCache;

    @Autowired(required = false)
    public void setHypeQuery(ObjectProvider<HypeQueryService> hypeQuery) {
        this.hypeQuery = hypeQuery;
    }

    @Autowired(required = false)
    public void setHypeCache(HypeCache hypeCache) {
        this.hypeCache = hypeCache;
    }

    private HypeQueryService hype() {
        return hypeQuery == null ? null : hypeQuery.getIfAvailable();
    }

    static boolean freshHype(HypeScoreCurrent row, HypeQueryService query) {
        return SealHypeLookups.freshHype(row, query);
    }

    boolean hypeIssuerAvailable(User owner) {
        return issuers.hypeIssuerAvailable(owner);
    }

    /** Pedido explícito no painel Hype; a emissão e a revisão seguem o mesmo fluxo de SealBond. */
    @Transactional
    public Map<String, Object> requestHype(CurrentUser user, Seal seal, Scheme scheme, WardrobeItem piece,
                                          String justification, UUID inferenceId, Boolean consent) {
        return responses.requestHype(user, seal, scheme, piece, justification, inferenceId, consent);
    }

    /** PERFIL publica conteúdo elegível na vitrine, por tipo ({@link SealProfileShowcase}). */
    boolean hasProfilePolicies(UUID ownerId, SealTier subject) {
        return showcase.hasProfilePolicies(ownerId, subject);
    }

    List<Scheme> profileSchemes(UUID ownerId, Predicate<Scheme> visible, int limit) {
        return showcase.profileSchemes(ownerId, visible, limit);
    }

    List<WardrobeItem> profilePieces(UUID ownerId, Predicate<WardrobeItem> visible, int limit) {
        return showcase.profilePieces(ownerId, visible, limit);
    }

    // ================================================================== RF25 — selos do perfil emissor
    /**
     * {@code availableFrom}/{@code availableUntil} delimitam a campanha (novas concessões); {@code grantValidityDays} é a
     * validade de cada selo concedido, contada da emissão (nulo = {@link #DEFAULT_SEAL_VALIDITY}).
     */
    public record SealForm(String name, SealTier tier, String policyText, String iconUrl, Map<String, Object> background,
                           Instant availableFrom, Instant availableUntil, Integer usageLimit, SealStatus status,
                           Map<String, Object> design, Map<String, Object> policy, Integer grantValidityDays) {
        public SealForm(String name, SealTier tier, String policyText, String iconUrl, Map<String, Object> background,
                        Instant availableFrom, Instant availableUntil, Integer usageLimit, SealStatus status,
                        Map<String, Object> design, Map<String, Object> policy) {
            this(name, tier, policyText, iconUrl, background, availableFrom, availableUntil, usageLimit, status, design, policy, null);
        }
    }

    /** Teto da validade configurável de um selo concedido (10 anos). */
    public static final int MAX_GRANT_VALIDITY_DAYS = 3650;

    @Transactional
    public Map<String, Object> createSeal(CurrentUser user, SealForm form) {
        return forms.createSeal(user, form);
    }

    /**
     * RF25 — Copilot especializado: interpreta o pedido e cria o modelo de referência da política.
     * A inferência é auditada; o selo só é publicado na etapa final.
     */
    @Transactional
    public Map<String, Object> draft(CurrentUser user, SealTier tier) {
        return draft(user, tier, null, null);
    }

    @Transactional
    public Map<String, Object> draft(CurrentUser user, SealTier tier, String message, Map<String, Object> previousPolicy) {
        return draft(user, tier, message, previousPolicy, null);
    }

    @Transactional
    public Map<String, Object> draft(CurrentUser user, SealTier tier, String message, Map<String, Object> previousPolicy,
                                     List<SealPolicyCopilot.Message> conversation) {
        return drafts.draft(user, tier, message, previousPolicy, conversation);
    }

    @Transactional
    public Map<String, Object> updateSeal(CurrentUser user, UUID sealId, SealForm form) {
        return forms.updateSeal(user, sealId, form);
    }

    /** Todos os selos do emissor (aba do próprio dono). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sealsOf(UUID ownerId) {
        return views.sealsOf(ownerId);
    }

    /** Selos de um perfil para quem visita: o dono (e o admin) vê todos; os demais só os ativos de emissor ativo. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sealsOf(CurrentUser viewer, UUID ownerId) {
        return views.sealsOf(viewer, ownerId);
    }

    /** RNF12 — um selo está disponível quando ativo, dentro da janela e abaixo do teto de emissão. */
    public static boolean available(Seal s, Instant now) {
        return SealViews.available(s, now);
    }

    public static String unavailableReason(Seal s, Instant now) {
        return SealViews.unavailableReason(s, now);
    }

    Map<String, Object> sealView(Seal s) {
        return views.sealView(s);
    }

    /** Medalhões dos vínculos APROVADOS de um esquema — o que o card mostra no espaço reservado ao selo. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> approvedBadges(UUID schemeId) {
        return badges.approvedBadges(schemeId);
    }

    /** RF53 — peças por requisição em {@link #pieceSeals} (o guarda-roupa pede por página). */
    public static final int MAX_PIECE_SEALS = 60;

    /** RF53 — selos de marca/celebridade "na frente" das peças visíveis a quem pede ({@link SealPieceBadges}). */
    @Transactional(readOnly = true)
    public Map<String, Object> pieceSeals(CurrentUser viewer, List<UUID> ids) {
        return badges.pieceSeals(viewer, ids);
    }

    /** RF53 — vínculos APROVADOS e vigentes de tier PEÇA por peça, só de looks aceitos por {@code schemeVisible}. */
    public static Map<UUID, List<SealBond>> approvedPieceBonds(Collection<UUID> pieceIds, SchemeItemRepository schemeItems,
                                                               SealBondRepository bonds, Predicate<Scheme> schemeVisible) {
        return SealPieceBadges.approvedPieceBonds(pieceIds, schemeItems, bonds, schemeVisible);
    }

    static boolean canViewPiece(Guard guard, CurrentUser viewer, WardrobeItem w) {
        return SealPieceBadges.canViewPiece(guard, viewer, w);
    }

    static boolean canViewScheme(Guard guard, CurrentUser viewer, Scheme s) {
        return SealPieceBadges.canViewScheme(guard, viewer, s);
    }

    /** Medalhão de um vínculo aprovado (cards, aba de destaques): tier, emissor, Premium e o desenho do selo. */
    public static Map<String, Object> badge(SealBond b) {
        return SealViews.badge(b);
    }

    /** Selos padrão criados na aprovação do perfil (um por tier), para que o vínculo sempre tenha selo a emitir. */
    @Transactional
    public void ensureDefaultSeals(User owner) {
        forms.ensureDefaultSeals(owner);
    }

    // ================================================================== RF20.CA01 / RF21.CA17 — sugestões
    public record Candidate(UUID targetOwnerId, String kind, String name, String logoUrl, BigDecimal confidence,
                            String justification, SealTier tier, List<UUID> linkedPieceIds, SealBondBasis basis,
                            String eraLabel, UUID sealId) {
        public Candidate(UUID targetOwnerId, String kind, String name, String logoUrl, BigDecimal confidence, String justification,
                         SealTier tier, List<UUID> linkedPieceIds, SealBondBasis basis, String eraLabel) {
            this(targetOwnerId, kind, name, logoUrl, confidence, justification, tier, linkedPieceIds, basis, eraLabel, null);
        }
    }

    /** Executa a análise das peças e grava até 3 sugestões (status SUGGESTED). Não bloqueia o salvamento. */
    @Transactional
    public Map<String, Object> suggest(CurrentUser user, UUID schemeId) {
        return suggestions.suggest(user, schemeId);
    }

    /** RF13: check each referenced look without changing its existing seal bonds. */
    @Transactional(readOnly = true)
    public Map<String, Object> previewScheme(CurrentUser user, UUID schemeId) {
        return suggestions.previewScheme(user, schemeId);
    }

    /**
     * Criar Look (RF5 + RF21.CA01): antes de salvar, a IA procura marcas e celebridades com que o look pode ter selo, a
     * partir das peças escolhidas, do estilo e da ocasião. Nada é gravado: a pessoa marca as que quer pedir e o vínculo
     * nasce ao salvar (as mesmas regras de {@link #suggest}: só marca validada e celebridade verificada com consentimento).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, List<UUID> pieceIds, List<String> occasion, List<String> style) {
        return preview(user, pieceIds, occasion, style, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, List<UUID> pieceIds, List<String> occasion, List<String> style, Map<String, Object> background) {
        return suggestions.preview(user, pieceIds, occasion, style, background);
    }

    /** Campos da peça (RF4) que a IA compara para achar marcas e celebridades com peça semelhante. */
    public record PieceFields(String name, String category, String subcategory, String color, String brandName,
                              List<String> occasion, List<String> style, String material, String variation,
                              Map<String, List<String>> attributes, String sex, String size, String market, Map<String, Object> background) {
        public PieceFields(String name, String category, String subcategory, String color, String brandName, List<String> occasion, List<String> style) {
            this(name, category, subcategory, color, brandName, occasion, style, null, null, null, null, null, null, null);
        }
    }

    /** Adicionar peça (RF4 · "Mais detalhes" › selos): prévia sem gravação, pelas mesmas regras de {@link #preview}. */
    @Transactional(readOnly = true)
    public Map<String, Object> previewPiece(CurrentUser user, PieceFields f) {
        return suggestions.previewPiece(user, f);
    }

    // ================================================================== CA02 aceite · CA03 edição · CA04 recusa
    /**
     * RF21.CA23 — selo indisponível (teto de emissões, fora da janela, inativo) no momento do aceite: o vínculo fica
     * REJECTED com o motivo e a trilha de auditoria. A transação NÃO desfaz isso ({@code noRollbackFor}); qualquer
     * outro erro (ex.: falta de consentimento de imagem) desfaz o aceite e o vínculo continua SUGERIDO.
     */
    public static final class SealUnavailable extends ApiException {
        public SealUnavailable(String reason) {
            super(409, "SELO_INDISPONIVEL", reason);
        }
    }

    @Transactional(noRollbackFor = SealUnavailable.class)
    public Map<String, Object> accept(CurrentUser user, UUID bondId, Boolean imageRightsConsent) {
        return responses.accept(user, bondId, imageRightsConsent);
    }

    /** CA03 — escolher outra marca/celebridade da lista (origem MANUAL). */
    @Transactional(noRollbackFor = SealUnavailable.class)
    public Map<String, Object> linkManually(CurrentUser user, UUID schemeId, UUID targetOwnerId, Boolean imageRightsConsent) {
        return responses.linkManually(user, schemeId, targetOwnerId, imageRightsConsent);
    }

    @Transactional
    public Map<String, Object> refuse(CurrentUser user, UUID bondId) {
        return responses.refuse(user, bondId);
    }

    /** Recusa de todas as sugestões do esquema (CA04) — guardadas em "Meus Selos" para aplicação manual depois. */
    @Transactional
    public int refuseAll(CurrentUser user, UUID schemeId) {
        return responses.refuseAll(user, schemeId);
    }

    /** Validade do selo concedido: conta da emissão e nunca herda o fim da campanha. */
    static Instant grantExpiry(Seal seal, Instant issuedAt) {
        return SealBondRouting.grantExpiry(seal, issuedAt);
    }

    // ================================================================== CA07 revisão · CA14 revogação
    @Transactional(readOnly = true)
    public List<Map<String, Object>> reviewQueue(CurrentUser user) {
        return reviews.reviewQueue(user);
    }

    @Transactional
    public Map<String, Object> review(CurrentUser user, UUID bondId, boolean approve, String reason) {
        return reviews.review(user, bondId, approve, reason);
    }

    @Transactional
    public Map<String, Object> revoke(CurrentUser user, UUID bondId, String reason) {
        return reviews.revoke(user, bondId, reason);
    }

    /** CA14 — esquema excluído ou tornado privado revoga os selos (cupons resgatados continuam válidos). */
    @Transactional
    public void revokeForScheme(UUID schemeId, String reason) {
        reviews.revokeForScheme(schemeId, reason);
    }

    /** Exclusão da peça também encerra seus vínculos diretos; resgates anteriores seguem preservados. */
    @org.springframework.context.event.EventListener
    @Transactional
    public void onPieceDeleted(DomainEvents.PieceDeleted event) {
        reviews.onPieceDeleted(event);
    }

    /** RF9.CA05 — edição da lista de peças de esquema com vínculo aprovado: revalidação pendente + aviso ao emissor. */
    @Transactional
    public void flagRevalidation(Scheme scheme) {
        reviews.flagRevalidation(scheme);
    }

    // ================================================================== Meus Selos
    @Transactional(readOnly = true)
    public Map<String, Object> mySeals(CurrentUser user) {
        return promotionReads.mySeals(user);
    }

    // ================================================================== promoções (CA11–CA13, CA21–CA23, RNF12)
    public record PromotionForm(PromotionType type, String title, String description, String rules, Integer discountPercent,
                                UUID sealId, String requiredSealKind, Instant startsAt, Instant expiresAt,
                                Integer totalQuota, Integer perUserLimit, UUID partnerBrandUserId, Visibility visibility, String storeUrl) {
    }

    /** Link http(s) de loja terceira (ou nulo); regra em {@link PromotionRules#storeUrl}. */
    public static String storeUrl(String raw) {
        return PromotionRules.storeUrl(raw);
    }

    /** Link externo exibido ao usuário: só https com host; regra em {@link PromotionRules#httpsOnly}. */
    public static String httpsOnly(String raw) {
        return PromotionRules.httpsOnly(raw);
    }

    /** Card RF38 — promoções que o usuário pode resgatar agora (selo válido, período, estoque e limite por pessoa). */
    @Transactional(readOnly = true)
    public List<Promotion> eligiblePromotions(UUID userId) {
        return promotionReads.eligiblePromotions(userId);
    }

    @Transactional
    public Map<String, Object> createPromotion(CurrentUser user, PromotionForm f) {
        return promotionWriter.createPromotion(user, f);
    }

    /** Administration creates a coupon for its verified issuer; participant eligibility remains unchanged. */
    @Transactional
    public Map<String, Object> createAdminPromotion(CurrentUser admin, UUID issuerId, PromotionForm form) {
        return promotionWriter.createAdminPromotion(admin, issuerId, form);
    }

    @Transactional
    public Map<String, Object> updatePromotion(CurrentUser user, UUID id, PromotionForm f) {
        return promotionWriter.updatePromotion(user, id, f);
    }

    @Transactional
    public Map<String, Object> setPromotionStatus(CurrentUser user, UUID id, PromotionStatus status) {
        return promotionWriter.setPromotionStatus(user, id, status);
    }

    /** Promoções do perfil, filtradas pelos selos do solicitante (CA11/CA21). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> promotionsOf(CurrentUser viewer, UUID ownerId) {
        return promotionReads.promotionsOf(viewer, ownerId);
    }

    static String unavailable(Promotion p, Instant now) {
        return SealPromotionReads.unavailable(p, now);
    }

    /** CA12/CA13/CA22 — resgate com código único, estoque e limite por usuário. */
    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID promotionId) {
        return promotionWriter.redeem(user, promotionId);
    }

    /** Regra 7 — métricas por perfil emissor. */
    @Transactional(readOnly = true)
    public Map<String, Object> issuerMetrics(CurrentUser user) {
        return promotionReads.issuerMetrics(user);
    }

    Map<String, Object> bondView(SealBond b) {
        return views.bondView(b);
    }
}
