package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SealService.SealUnavailable;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF20.CA07 / CA14 / RF9.CA05 — revisão pelo emissor (aprovação com emissão, rejeição com motivo, revalidação),
 * revogações (pelo emissor, look excluído/privado, peça excluída) e aviso de revalidação. Colaborador do
 * {@link SealService} (R80).
 */
final class SealBondReviews {
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final NotificationService notifications;
    private final Guard guard;
    private final SealIssuers issuers;
    private final SealBondRouting routing;
    private final SealHypeLookups lookups;
    private final SealViews views;

    SealBondReviews(SealRepository seals, SealBondRepository bonds, NotificationService notifications, Guard guard, SealIssuers issuers, SealBondRouting routing, SealHypeLookups lookups, SealViews views) {
        this.seals = seals;
        this.bonds = bonds;
        this.notifications = notifications;
        this.guard = guard;
        this.issuers = issuers;
        this.routing = routing;
        this.lookups = lookups;
        this.views = views;
    }

    List<Map<String, Object>> reviewQueue(CurrentUser user) {
        issuers.requireIssuer(user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(user.id(), SealBondStatus.PENDING_REVIEW)) {
            Map<String, Object> v = views.bondView(b);
            v.put("scheme", views.schemeSummary(b.getScheme()));
            out.add(v);
        }
        // revalidação pendente (RF9.CA05): vínculos aprovados cujo esquema mudou a lista de peças.
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)) {
            if (b.getScheme() != null && b.getScheme().isRevalidationPending()) {
                Map<String, Object> v = views.bondView(b);
                v.put("revalidation", true);
                v.put("scheme", views.schemeSummary(b.getScheme()));
                out.add(v);
            }
        }
        return out;
    }

    Map<String, Object> review(CurrentUser user, UUID bondId, boolean approve, String reason) {
        issuers.requireIssuer(user);
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        boolean revalidation = b.getStatus() == SealBondStatus.APPROVED && b.getScheme() != null && b.getScheme().isRevalidationPending();
        if (b.getStatus() != SealBondStatus.PENDING_REVIEW && !revalidation) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.este_vinculo_nao_esta_aguardando"));
        }
        if (approve) {
            if (issuers.issuer(b.getTargetOwner()) == null) throw ApiException.forbidden(Msg.t("sealHype.issuer_unavailable"));
            if (b.getSeal() != null && Json.map(b.getSeal().getBackgroundConfigJson()).get("policy") instanceof Map<?, ?> policy
                    && "HYPE".equals(policy.get("mode")))
                b.setSeal(seals.findForIssuance(b.getSeal().getId()).orElseThrow(() -> ApiException.notFound(Msg.t("common.selo"))));
            routing.requireReferenceMatch(b.getSeal(), b.getTargetOwner(), b.getTier(), b.getScheme());
            lookups.requireHypeMatch(b, b.getSeal());
            if (b.getSeal() == null || !SealViews.available(b.getSeal(), Instant.now())) throw new SealUnavailable(Msg.t("sealHype.issuer_unavailable"));
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
                b.setReviewNote("revalidado");
                routing.logBond(user, b, "REVALIDADO");
            } else {
                routing.issue(b, user.id());
            }
        } else {
            if (reason == null || reason.isBlank()) {
                throw ApiException.badRequest("MOTIVO_OBRIGATORIO", Msg.t("seal.informe_o_motivo_da_rejeicao"));
            }
            b.setStatus(revalidation ? SealBondStatus.REVOKED : SealBondStatus.REJECTED);
            b.setReviewNote(InputSanitizer.clean(reason, 1000));
            b.setReviewedAt(Instant.now());
            b.setReviewedBy(user.id());
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
            }
            notifications.notify(b.getRequestedBy().getId(), user.id(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                    Msg.k("seal.vinculo_2", (revalidation ? "revogado" : Msg.k("seal.nao_aprovado"))), "Motivo: " + b.getReviewNote(), null);
            routing.logBond(user, b, revalidation ? "REVOGADO" : "REJEITADO");
        }
        return views.bondView(b);
    }

    Map<String, Object> revoke(CurrentUser user, UUID bondId, String reason) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        revokeInternal(b, reason == null ? "uso indevido" : reason, user.id());
        return views.bondView(b);
    }

    /** CA14 — esquema excluído ou tornado privado revoga os selos (cupons resgatados continuam válidos). */
    void revokeForScheme(UUID schemeId, String reason) {
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                revokeInternal(b, reason, null);
            } else if (b.getStatus() == SealBondStatus.SUGGESTED || b.getStatus() == SealBondStatus.PENDING_REVIEW) {
                b.setStatus(SealBondStatus.REVOKED);
                b.setReviewNote(reason);
            }
        }
    }

    /** Exclusão da peça também encerra seus vínculos diretos; resgates anteriores seguem preservados. */
    void onPieceDeleted(DomainEvents.PieceDeleted event) {
        for (SealBond bond : bonds.findByPieceId(event.pieceId())) {
            if (bond.getStatus() == SealBondStatus.APPROVED) {
                revokeInternal(bond, Msg.t("sealHype.piece_deleted"), null);
            } else if (bond.getStatus() == SealBondStatus.SUGGESTED || bond.getStatus() == SealBondStatus.PENDING_REVIEW) {
                bond.setStatus(SealBondStatus.REVOKED);
                bond.setReviewNote(Msg.t("sealHype.piece_deleted"));
            }
        }
    }

    private void revokeInternal(SealBond b, String reason, UUID by) {
        b.setStatus(SealBondStatus.REVOKED);
        b.setReviewNote(reason);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(by);
        notifications.notify(b.getRequestedBy().getId(), by, NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                Msg.k("seal.selo_revogado"), Msg.k("seal.o_selo_do_look_foi", SealViews.targetTitle(b), reason), null);
        routing.logBond(null, b, "REVOGADO");
    }

    /** RF9.CA05 — edição da lista de peças de esquema com vínculo aprovado: revalidação pendente + aviso ao emissor. */
    void flagRevalidation(Scheme scheme) {
        boolean any = false;
        for (SealBond b : bonds.findBySchemeId(scheme.getId())) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                any = true;
                notifications.notify(b.getTargetOwner().getId(), scheme.getUser().getId(), NotificationType.SEAL_BOND_REVIEW,
                        "SEAL_BOND", b.getId(), Msg.k("seal.revalidacao_pendente"),
                        Msg.k("seal.o_look_vinculado_ao_seu", scheme.getTitle()), null);
            }
        }
        scheme.setRevalidationPending(any);
    }
}
