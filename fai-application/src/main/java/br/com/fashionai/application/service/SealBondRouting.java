package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealService.SealUnavailable;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * RF20/RF21 — do vínculo pendente à emissão: unicidade, emissor apto, consentimento de imagem, selo do nível cuja
 * política o alvo atende, critério de Hype, teto/janela (CA23), fila de revisão ou emissão (CA08) e a trilha de
 * auditoria do vínculo. Colaborador do {@link SealService} (R80).
 */
final class SealBondRouting {
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brandProfiles;
    private final NotificationService notifications;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    private final SealIssuers issuers;
    private final SealHypeLookups lookups;
    private final SealViews views;

    SealBondRouting(SealRepository seals, SealBondRepository bonds, SchemeItemRepository schemeItems, BrandProfileRepository brandProfiles, NotificationService notifications, Audit audit, ApplicationEventPublisher events, SealIssuers issuers, SealHypeLookups lookups, SealViews views) {
        this.seals = seals;
        this.bonds = bonds;
        this.schemeItems = schemeItems;
        this.brandProfiles = brandProfiles;
        this.notifications = notifications;
        this.audit = audit;
        this.events = events;
        this.issuers = issuers;
        this.lookups = lookups;
        this.views = views;
    }

    void requireUnique(SealBond b) {
        boolean dup = b.getPiece() != null
                ? bonds.findByPieceId(b.getPiece().getId()).stream().anyMatch(existing -> existing.getTargetOwner().getId().equals(b.getTargetOwner().getId())
                    && (existing.getStatus() == SealBondStatus.PENDING_REVIEW || existing.getStatus() == SealBondStatus.APPROVED))
                : !bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(b.getScheme().getId(), b.getTargetOwner().getId(),
                    List.of(SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED)).isEmpty();
        if (dup) {
            // RF20.CA09 — selo único por par esquema/emissor.
            throw ApiException.conflict("VINCULO_EXISTENTE", Msg.t("seal.este_esquema_ja_tem_vinculo"));
        }
    }

    /** Pendente → auto-aprovação (marca sem revisão) ou fila de revisão; celebridade sempre revisa (CA19). */
    Map<String, Object> route(CurrentUser user, SealBond b) {
        requireUnique(b);
        User target = b.getTargetOwner();
        if (issuers.issuer(target) == null) throw ApiException.forbidden(Msg.t("sealHype.issuer_unavailable"));
        boolean celebrity = target.getProfileType() == ProfileType.CELEBRIDADE;
        if (celebrity && !Boolean.TRUE.equals(b.getImageRightsConsent())) {
            throw ApiException.badRequest("CONSENTIMENTO_IMAGEM",
                    Msg.t("seal.confirme_que_entende_que_o"));
        }
        Seal seal = b.getSeal() != null && b.getSeal().getOwner().getId().equals(target.getId())
                && b.getSeal().getStatus() == SealStatus.ACTIVE ? b.getSeal() : sealFor(target, b.getTier(), b.getScheme());
        requireReferenceMatch(seal, target, b.getTier(), b.getScheme());
        lookups.requireHypeMatch(b, seal);
        String reason = seal == null ? Msg.t("seal.o_perfil_nao_tem_selo") : SealViews.unavailableReason(seal, Instant.now());
        if (reason != null) {
            // RF21.CA23 — teto atingido: recusa com mensagem explicativa, sem emissão.
            b.setStatus(SealBondStatus.REJECTED);
            b.setReviewNote(reason);
            logBond(user, b, "RECUSADO_LIMITE");
            throw new SealUnavailable(reason);
        }
        boolean requiresReview = celebrity || brandProfiles.findByOwnerId(target.getId()).map(BrandProfile::isRequiresSealReview).orElse(false);
        b.setRequiresReview(requiresReview);
        b.setSeal(seal);
        if (requiresReview) {
            b.setStatus(SealBondStatus.PENDING_REVIEW);
            notifications.notify(target.getId(), b.getRequestedBy().getId(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND",
                    b.getId(), Msg.k("seal.novo_vinculo_para_revisar"), Msg.k("seal.vinculou_o_look_ao_seu", b.getRequestedBy().getUsername(), SealViews.targetTitle(b)), null);
            logBond(user, b, "PENDENTE");
        } else {
            issue(b, null);
        }
        return views.bondView(b);
    }

    /**
     * Selo que o vínculo emite: entre os ativos do nível, o primeiro cuja política o look atende; senão um sem política;
     * políticas não atendidas nunca liberam resgate.
     */
    void requireReferenceMatch(Seal seal, User target, SealTier tier, Scheme scheme) {
        if (seal == null) return;
        SealPolicies.Policy policy = SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
        if (policy != null && policy.referenceModel() != null && sealFor(target, tier, scheme, seal.getId()) == null) {
            throw ApiException.badRequest("POLITICA_NAO_ATENDIDA", Msg.t("sealCopilot.modelo_nao_atendido"));
        }
    }

    private Seal sealFor(User target, SealTier tier, Scheme scheme) {
        return sealFor(target, tier, scheme, null);
    }

    private Seal sealFor(User target, SealTier tier, Scheme scheme, UUID selectedId) {
        if (tier == SealTier.PERFIL) return null;
        List<Seal> active = seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(target.getId(), SealStatus.ACTIVE);
        List<Seal> ofTier = active.stream().filter(s -> s.getTier() == tier && (selectedId == null || selectedId.equals(s.getId()))).toList();
        if (scheme != null && scheme.getId() != null) {
            List<WardrobeItem> pieces = schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId()).stream().map(SchemeItem::getWardrobeItem).toList();
            SealPolicies.HypeLookup[] hype = {null};          // RF53: só consulta o Hype se alguma política usar
            for (Seal s : ofTier) {
                SealPolicies.Policy pol = SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy"));
                if (pol != null && (pol.usesHype() || pol.referenceModel() != null && pol.referenceModel().containsKey("earnedSeals")) && hype[0] == null) {
                    hype[0] = lookups.hypeLookup(pieces.stream().filter(Objects::nonNull).map(WardrobeItem::getId).toList(), scheme.getId());
                }
                SealPolicies.HypeLookup h = hype[0] == null ? SealPolicies.HypeLookup.NONE : hype[0];
                if (pol != null && !pieces.isEmpty() && (tier == SealTier.PECA
                        ? pieces.stream().anyMatch(w -> SealPolicies.evaluate(pol, tier, List.of(w),
                            Json.csv(pol.referenceModel() == null ? scheme.getOccasion() : w.getOccasionTags()),
                            Json.csv(pol.referenceModel() == null ? scheme.getStyle() : w.getStyleTags()), h, SealCandidates.referenceBackground(scheme)).matched())
                        : SealPolicies.evaluate(pol, tier, pieces, Json.csv(scheme.getOccasion()), Json.csv(scheme.getStyle()), h, SealCandidates.referenceBackground(scheme)).matched())) {
                    return s;
                }
            }
            for (Seal s : ofTier) {
                if (SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")) == null) {
                    return s;
                }
            }
        }
        // Não devolve um selo com política quando nenhum modelo foi atendido (também vale no vínculo manual).
        return ofTier.stream().filter(s -> SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")) == null)
                .findFirst().orElse(null);
    }

    /**
     * Validade do selo concedido: conta da emissão e nunca herda o fim da campanha — um resgate no último minuto da
     * promoção não pode nascer expirado.
     */
    static Instant grantExpiry(Seal seal, Instant issuedAt) {
        Duration validity = seal.getGrantValidityDays() != null ? Duration.ofDays(seal.getGrantValidityDays()) : SealService.DEFAULT_SEAL_VALIDITY;
        return issuedAt.plus(validity);
    }

    /** CA08 — emissão do selo único e rastreável. */
    void issue(SealBond b, UUID decidedBy) {
        Seal seal = b.getSeal();
        b.setStatus(SealBondStatus.APPROVED);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(decidedBy);
        b.setIssuedAt(Instant.now());
        b.setExpiresAt(grantExpiry(seal, b.getIssuedAt()));
        String prefix = b.getTargetOwner().getProfileType() == ProfileType.CELEBRIDADE ? "PRM" : "BRD";
        String code;
        do {
            code = Hashing.promoCode(prefix);
        } while (bonds.findBySealCode(code).isPresent());
        b.setSealCode(code);
        seal.setUsageCount(seal.getUsageCount() + 1);
        Scheme scheme = b.getScheme();
        if (scheme != null) {
            List<String> ids = new ArrayList<>(Json.strings(scheme.getSealIdsJson()));
            if (!ids.contains(b.getId().toString())) ids.add(b.getId().toString());
            scheme.setSealIdsJson(Json.write(ids));
        }
        notifications.notify(b.getRequestedBy().getId(), b.getTargetOwner().getId(), NotificationType.SEAL_GRANTED, "SEAL_BOND",
                b.getId(), (seal.isPremium() ? Msg.k("seal.selo_premium_2") : Msg.k("seal.selo_de_marca")) + " emitido!",
                Msg.k("seal.seu_look_recebeu_o_selo", SealViews.targetTitle(b), seal.getName()), null);
        logBond(null, b, "EMITIDO");
        // o selo pode liberar promoções da marca/celebridade: direitos a cupom + notificação (card RF38)
        events.publishEvent(new DomainEvents.CouponRightsCheck(b.getRequestedBy().getId()));
    }

    void logBond(CurrentUser user, SealBond b, String result) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("origin", b.getOrigin().name());
        meta.put("confidence", b.getConfidence());
        meta.put("scheme", b.getScheme() == null ? null : b.getScheme().getId().toString());
        if (b.getPiece() != null) meta.put("piece", b.getPiece().getId().toString());
        meta.put("target", b.getTargetOwner().getId().toString());
        meta.put("status", b.getStatus().name());
        meta.put("decidedBy", b.getReviewedBy() == null ? (user == null ? Msg.t("seal.sistema_auto_aprovacao") : user.id().toString())
                : b.getReviewedBy().toString());
        audit.log(user == null ? "system" : user.id().toString(), AuditActions.MUDANCA_ESTADO_VINCULO_SELO,
                "seal-bond:" + b.getId(), result, null, null, meta);
    }
}
