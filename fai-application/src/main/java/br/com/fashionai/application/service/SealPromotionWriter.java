package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SealService.PromotionForm;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF20.CA11–CA13 / RF21.CA21–CA23 / RNF12 — o emissor cria, edita e pausa promoções (também pela administração) e
 * a pessoa resgata com código único, estoque e limite por pessoa. Colaborador do {@link SealService} (R80).
 */
final class SealPromotionWriter {
    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository redemptions;
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final UserRepository users;
    private final Guard guard;
    private final Audit audit;
    private final SealIssuers issuers;
    private final SealPromotionReads reads;

    SealPromotionWriter(PromotionRepository promotions, PromotionRedemptionRepository redemptions, SealRepository seals, SealBondRepository bonds, UserRepository users, Guard guard, Audit audit, SealIssuers issuers, SealPromotionReads reads) {
        this.promotions = promotions;
        this.redemptions = redemptions;
        this.seals = seals;
        this.bonds = bonds;
        this.users = users;
        this.guard = guard;
        this.audit = audit;
        this.issuers = issuers;
        this.reads = reads;
    }

    Map<String, Object> createPromotion(CurrentUser user, PromotionForm f) {
        issuers.requireIssuer(user);
        Promotion p = new Promotion();
        p.setOwnerUserId(user.id());
        applyPromotion(user, p, f);
        promotions.save(p);
        return reads.promotionView(p, null);
    }

    /** Administration creates a coupon for its verified issuer; participant eligibility remains unchanged. */
    Map<String, Object> createAdminPromotion(CurrentUser admin, UUID issuerId, PromotionForm form) {
        guard.requireAdmin(admin);
        if (issuerId == null || form == null || form.type() == null
                || !List.of(PromotionType.CUPOM_LOJA, PromotionType.DESCONTO_ECOMMERCE, PromotionType.FRETE_GRATIS).contains(form.type()))
            throw ApiException.badRequest("CUPOM_INVALIDO", "Informe emissor e tipo de cupom.");
        User owner = users.findById(issuerId).orElseThrow(() -> ApiException.notFound("Emissor"));
        CurrentUser issuer = CurrentUser.of(owner, admin.ip(), admin.userAgent());
        guard.requireApprovedInstitutional(issuer, "admin:coupon", "O cupom precisa de marca ou celebridade aprovada.");
        Map<String, Object> created = createPromotion(issuer, form);
        audit.log(admin, AuditActions.SELO_EDITADO, "promotion:" + created.get("id"), Map.of("op", "admin-create-coupon", "issuerId", issuerId));
        return created;
    }

    Map<String, Object> updatePromotion(CurrentUser user, UUID id, PromotionForm f) {
        issuers.requireIssuer(user);
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        applyPromotion(user, p, f);
        return reads.promotionView(p, null);
    }

    Map<String, Object> setPromotionStatus(CurrentUser user, UUID id, PromotionStatus status) {
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        p.setStatus(status);
        return reads.promotionView(p, null);
    }

    private void applyPromotion(CurrentUser user, Promotion p, PromotionForm f) {
        PromotionRules.requireType(f.type());
        User owner = users.findById(user.id()).orElseThrow();
        boolean celebrity = owner.getProfileType() == ProfileType.CELEBRIDADE;
        PromotionRules.requireTypeFor(f.type(), celebrity);
        p.setType(f.type());
        p.setTitle(InputSanitizer.required("title", f.title(), 3, 160));
        p.setDescription(InputSanitizer.clean(f.description(), 512));
        p.setRules(InputSanitizer.clean(f.rules(), 2048));
        p.setDiscountPercent(PromotionRules.discountPercent(f.discountPercent()));
        if (f.sealId() != null) {
            Seal seal = seals.findById(f.sealId()).orElseThrow(() -> ApiException.notFound("Selo"));
            guard.requireOwner(user, seal.getOwner().getId(), "seal:" + f.sealId());
            if (seal.getStatus() != SealStatus.ACTIVE) {
                // RNF12 — promoções só se aplicam a selos ativos.
                throw ApiException.badRequest("SELO_INATIVO", Msg.t("seal.promocoes_so_podem_ser_aplicadas"));
            }
            p.setSeal(seal);
        }
        p.setRequiredSealKind(PromotionRules.requiredSealKind(celebrity));
        p.setStartsAt(f.startsAt());
        p.setExpiresAt(f.expiresAt());
        PromotionRules.requirePeriod(f.startsAt(), f.expiresAt());
        p.setTotalQuota(f.totalQuota());
        p.setPerUserLimit(PromotionRules.perUserLimit(f.perUserLimit()));
        if (f.partnerBrandUserId() != null) {
            if (!celebrity) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", Msg.t("seal.marca_parceira_so_se_aplica"));
            }
            User partner = users.findById(f.partnerBrandUserId()).orElseThrow(() -> ApiException.notFound(Msg.t("seal.marca_parceira")));
            if (partner.getProfileType() != ProfileType.MARCA) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", Msg.t("seal.a_parceira_precisa_ser_uma"));
            }
            // a marca não vira parceira sem consentir: precisa ter aprovado um vínculo de selo desta celebridade
            if (!partner.getId().equals(p.getPartnerBrandUserId()) && !partnerConsented(owner.getId(), partner)) {
                throw new ApiException(409, "PARCERIA_NAO_AUTORIZADA", Msg.t("seal.a_marca_parceira_ainda_nao_aprovou"));
            }
            p.setPartnerBrandUserId(partner.getId());
        }
        p.setVisibility(f.visibility() == null ? Visibility.PUBLIC : f.visibility());
        p.setStoreUrl(PromotionRules.storeUrl(f.storeUrl()));
    }

    /**
     * Consentimento da marca parceira: ela aprovou (revisão RF21) um vínculo de selo pedido por esta celebridade e o
     * vínculo segue válido; a marca precisa estar aprovada e ativa.
     */
    boolean partnerConsented(UUID celebrityId, User partner) {
        if (!FlairService.sellerActive(partner)) {
            return false;
        }
        Instant now = Instant.now();
        return PromotionRules.partnerBondValid(bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(celebrityId, SealBondStatus.APPROVED),
                partner.getId(), now);
    }

    /** CA12/CA13/CA22 — resgate com código único, estoque e limite por usuário. */
    Map<String, Object> redeem(CurrentUser user, UUID promotionId) {
        guard.requireCanCreate(user);
        // trava a promoção: dois resgates simultâneos não passam juntos do limite por pessoa nem da cota total
        Promotion p = promotions.findForRedeem(promotionId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        Instant now = Instant.now();
        String reason = SealPromotionReads.unavailable(p, now);
        if (reason == null && !users.findById(p.getOwnerUserId()).map(FlairService::sellerActive).orElse(false)) {
            reason = Msg.t("seal.promocao_2", Msg.t("seal.indisponivel"));
        }
        if (reason != null) {
            throw ApiException.conflict("PROMOCAO_INDISPONIVEL", reason);
        }
        List<SealBond> myBonds = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)
                .stream().filter(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId())).toList();
        SealBond bond = reads.eligibleBond(p, myBonds);
        if (bond == null) {
            boolean revoked = bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id()).stream()
                    .anyMatch(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId()) && b.getStatus() == SealBondStatus.REVOKED);
            throw ApiException.conflict("SELO_INVALIDO", revoked ? Msg.t("seal.seu_selo_deste_perfil_foi")
                    : Msg.t("seal.e_preciso_ter_um_selo"));
        }
        long mine = redemptions.countByPromotionIdAndUserId(p.getId(), user.id());
        if (mine >= p.getPerUserLimit()) {
            throw ApiException.conflict("LIMITE_POR_USUARIO", Msg.t("seal.voce_ja_resgatou_esta_promocao"));
        }
        User owner = users.findById(p.getOwnerUserId()).orElseThrow();
        String partnerName = p.getPartnerBrandUserId() == null ? null
                : users.findById(p.getPartnerBrandUserId()).map(User::getUsername).orElse("PARC");
        String prefix = PromotionRules.codePrefix(owner.getUsername(), partnerName);
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
        return reads.redemptionView(r);
    }
}
