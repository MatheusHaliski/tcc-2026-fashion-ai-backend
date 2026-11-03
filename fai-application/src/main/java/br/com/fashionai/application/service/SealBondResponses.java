package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondBasis;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * RF20.CA02–CA04 / RF21 — respostas de quem pede o selo: pedido explícito no painel Hype, aceite da sugestão,
 * vínculo manual e recusa (uma ou todas). Colaborador do {@link SealService} (R80).
 */
final class SealBondResponses {
    private final SealBondRepository bonds;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final Guard guard;
    private final SealBondRouting routing;
    private final SealHypeLookups lookups;
    private final SealViews views;

    SealBondResponses(SealBondRepository bonds, SchemeRepository schemes, SchemeItemRepository schemeItems, UserRepository users, BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles, Guard guard, SealBondRouting routing, SealHypeLookups lookups, SealViews views) {
        this.bonds = bonds;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.users = users;
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.guard = guard;
        this.routing = routing;
        this.lookups = lookups;
        this.views = views;
    }

    /** Pedido explícito no painel Hype; a emissão e a revisão seguem o mesmo fluxo de SealBond. */
    Map<String, Object> requestHype(CurrentUser user, Seal seal, Scheme scheme, WardrobeItem piece,
                                          String justification, UUID inferenceId, Boolean consent) {
        guard.requireCanCreate(user);
        if ((scheme == null) == (piece == null) || !user.id().equals(piece == null ? scheme.getUser().getId() : piece.getUser().getId()))
            throw ApiException.forbidden(Msg.t("guard.apenas_o_autor_pode_alterar"));
        if (seal.getTier() != (piece == null ? SealTier.LOOK : SealTier.PECA))
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_policy"));
        SealBond bond = new SealBond();
        bond.setScheme(scheme); bond.setPiece(piece); bond.setSeal(seal); bond.setTier(seal.getTier());
        bond.setTargetOwner(seal.getOwner()); bond.setRequestedBy(users.findById(user.id()).orElseThrow());
        List<UUID> linked = piece == null ? schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId()).stream()
                .map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).map(WardrobeItem::getId).toList() : List.of(piece.getId());
        bond.setLinkedPieceIdsJson(Json.write(linked)); bond.setStatus(SealBondStatus.EDITED); bond.setOrigin(SealBondOrigin.MANUAL);
        bond.setBasis(seal.getOwner().getProfileType() == ProfileType.CELEBRIDADE ? SealBondBasis.STYLE_SIGNATURE : SealBondBasis.BRAND_MATCH);
        bond.setConfidence(BigDecimal.ONE); bond.setJustification(InputSanitizer.clean(justification, 1024));
        bond.setAiInferenceId(inferenceId); bond.setImageRightsConsent(consent); bond.setRespondedAt(Instant.now());
        lookups.requireHypeMatch(bond, seal); routing.requireUnique(bond);
        bonds.save(bond);
        return routing.route(user, bond);
    }

    Map<String, Object> accept(CurrentUser user, UUID bondId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED && b.getStatus() != SealBondStatus.REFUSED) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.este_vinculo_ja_foi_respondido"));
        }
        b.setStatus(SealBondStatus.ACCEPTED);
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        return routing.route(user, b);
    }

    /** CA03 — escolher outra marca/celebridade da lista (origem MANUAL). */
    Map<String, Object> linkManually(CurrentUser user, UUID schemeId, UUID targetOwnerId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        User target = users.findById(targetOwnerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (target.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.badRequest("PERFIL_INVALIDO", Msg.t("seal.so_marcas_e_celebridades_cadastradas"));
        }
        if (target.getProfileType() == ProfileType.MARCA && brandProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getApprovalStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("MARCA_NAO_VALIDADA", Msg.t("seal.somente_marcas_com_perfil_validado"));
        }
        if (target.getProfileType() == ProfileType.CELEBRIDADE && celebrityProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getVerificationStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("CELEBRIDADE_NAO_VERIFICADA", Msg.t("seal.somente_celebridades_verificadas_concedem"));
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
        b.setJustification(Msg.t("seal.vinculo_escolhido_manualmente_pelo"));
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        routing.requireUnique(b);
        bonds.save(b);
        return routing.route(user, b);
    }

    Map<String, Object> refuse(CurrentUser user, UUID bondId) {
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.so_sugestoes_podem_ser_recusadas"));
        }
        b.setStatus(SealBondStatus.REFUSED);
        b.setRespondedAt(Instant.now());
        routing.logBond(user, b, "RECUSADO");
        return views.bondView(b);
    }

    /** Recusa de todas as sugestões do esquema (CA04) — guardadas em "Meus Selos" para aplicação manual depois. */
    int refuseAll(CurrentUser user, UUID schemeId) {
        int n = 0;
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.SUGGESTED && b.getRequestedBy().getId().equals(user.id())) {
                b.setStatus(SealBondStatus.REFUSED);
                b.setRespondedAt(Instant.now());
                routing.logBond(user, b, "RECUSADO");
                n++;
            }
        }
        return n;
    }

    private SealBond mine(CurrentUser user, UUID bondId) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getRequestedBy().getId(), "seal-bond:" + bondId);
        return b;
    }
}
