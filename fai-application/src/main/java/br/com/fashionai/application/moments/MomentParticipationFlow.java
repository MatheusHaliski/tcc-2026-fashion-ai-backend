package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService.JoinRequest;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.MomentApproach;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.moments.MomentInput.enumOf;

/** Participação (§46): salvar, participar, sair, visibilidade no perfil e o Desafio de Montagem do FLAIR. */
final class MomentParticipationFlow extends MomentSupport {
    MomentParticipationFlow(MomentContext ctx) {
        super(ctx);
    }

    /** Salvar no calendário / lembrar-me / preparar look (§46) — antes de começar ou durante. */
    Map<String, Object> save(CurrentUser user, String idOrSlug, Boolean remind, UUID preparedSchemeId) {
        guard.requireCanCreate(user);
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseGet(() -> fresh(m, user.id()));
        if (remind != null) {
            p.setRemind(remind);
        }
        if (preparedSchemeId != null) {
            Scheme s = schemes.findById(preparedSchemeId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.look")));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            p.setPreparedSchemeId(s.getId());
        }
        participations.save(p);
        return Map.of("me", participationView(p), "message", Msg.t("moment.salvo_no_seu_calendario"));
    }

    Map<String, Object> unsave(CurrentUser user, String idOrSlug) {
        Moment m = visible(user, idOrSlug);
        participations.findByMomentIdAndUserId(m.getId(), user.id()).ifPresent(p -> {
            if (p.getStatus() == MomentParticipationStatus.INTERESTED) {
                participations.delete(p);
            } else {
                p.setRemind(false);
                participations.save(p);
            }
        });
        return Map.of("ok", true);
    }

    MomentParticipation fresh(Moment m, UUID userId) {
        MomentParticipation p = new MomentParticipation();
        p.setMomentId(m.getId());
        p.setUserId(userId);
        p.setStatus(MomentParticipationStatus.INTERESTED);
        return p;
    }

    /** PARTICIPAR: "como quer participar?" + "usar só meu guarda-roupa?". Reentrar não zera nada (anti-farming). */
    Map<String, Object> join(CurrentUser user, String idOrSlug, JoinRequest req) {
        guard.requireCanCreate(user);
        Instant now = now();
        Moment m = visible(user, idOrSlug);
        MomentStatus eff = MomentTime.effective(m, now);
        if (eff != MomentStatus.ACTIVE && eff != MomentStatus.SCHEDULED) {
            throw ApiException.conflict("MOMENTO_ENCERRADO", Msg.t("moment.este_momento_ja_terminou"));
        }
        if (m.getGroupId() != null && !isMember(user.id(), m.getGroupId()) && !user.id().equals(m.getCreatedByUserId())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("moment.so_membros_do_grupo"));
        }
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseGet(() -> fresh(m, user.id()));
        boolean first = p.getJoinedAt() == null;
        if (req != null && req.approach() != null) {
            p.setApproach(enumOf(MomentApproach.class, req.approach(), "approach"));
        }
        if (req != null && req.wardrobeOnly() != null) {
            p.setWardrobeOnly(req.wardrobeOnly());
        }
        if (p.getStatus() == MomentParticipationStatus.INTERESTED || p.getStatus() == MomentParticipationStatus.LEFT) {
            p.setStatus(MomentParticipationStatus.JOINED);
        }
        if (first) {
            p.setJoinedAt(now);
        }
        p.setLeftAt(null);
        p.setJoinCount(p.getJoinCount() + 1);
        participations.save(p);
        if (first) {
            m.setParticipantCount(m.getParticipantCount() + 1);
            moments.save(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("me", participationView(p));
        out.put("message", eff == MomentStatus.SCHEDULED ? Msg.t("moment.voce_esta_dentro_comeca", MomentTime.localStart(m).toString()) : Msg.t("moment.voce_esta_dentro"));
        out.put("nextSteps", List.of("CREATE_LOOK", "USE_WARDROBE", "ASK_COPILOT", "SEE_COMMUNITY"));
        return out;
    }

    /**
     * FLAIR-UT §14.3 — um Desafio de Montagem entregue dentro do Momento conta como participação (aparece em "Meus
     * Momentos" e na linha do tempo). Não lança pontos de Momento: os do desafio já vêm do ledger do FLAIR.
     */
    void recordCardChallenge(Moment m, UUID userId) {
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), userId).orElseGet(() -> fresh(m, userId));
        boolean first = p.getJoinedAt() == null;
        if (p.getStatus() == MomentParticipationStatus.INTERESTED || p.getStatus() == MomentParticipationStatus.LEFT) {
            p.setStatus(MomentParticipationStatus.JOINED);
        }
        if (first) {
            p.setJoinedAt(now());
        }
        p.setLeftAt(null);
        participations.save(p);
        if (first) {
            m.setParticipantCount(m.getParticipantCount() + 1);
            moments.save(m);
        }
    }

    Map<String, Object> leave(CurrentUser user, String idOrSlug) {
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("moment.participacao")));
        if (p.getStatus() == MomentParticipationStatus.COMPLETED) {
            throw ApiException.conflict("MOMENTO_CONCLUIDO", Msg.t("moment.momento_concluido_fica_no_historico"));
        }
        p.setStatus(MomentParticipationStatus.LEFT);
        p.setLeftAt(now());
        participations.save(p);
        return Map.of("me", participationView(p));
    }

    /** Visibilidade no perfil (§41): a pessoa controla cada participação. */
    Map<String, Object> setProfileVisibility(CurrentUser user, String idOrSlug, boolean publicOnProfile) {
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("moment.participacao")));
        p.setPublicOnProfile(publicOnProfile);
        participations.save(p);
        return Map.of("me", participationView(p));
    }
}
