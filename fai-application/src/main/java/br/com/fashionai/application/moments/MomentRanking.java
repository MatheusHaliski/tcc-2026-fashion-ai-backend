package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService.VoteRequest;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentInput.enumOf;
import static br.com.fashionai.application.moments.MomentService.LEADERBOARD_MAX;

/** Ranking (§36) e votação por dimensão. */
final class MomentRanking extends MomentSupport {
    MomentRanking(MomentContext ctx) {
        super(ctx);
    }

    /** Ranking (§36): votos por dimensão + MomentMatch como desempate. Só Momentos competitivos; privados só para membros. */
    Map<String, Object> leaderboard(CurrentUser viewer, String idOrSlug) {
        Moment m = visible(viewer, idOrSlug);
        Map<String, Object> out = new LinkedHashMap<>();
        if (!competitive(m)) {
            out.put("competitive", false);
            out.put("items", List.of());
            if (m.getFlairMode() == FlairMomentMode.COOPERATIVE) {
                long looks = submissions.countByMomentIdAndWithdrawnFalse(m.getId());
                out.put("cooperative", Map.of("goal", m.getCooperativeGoal() == null ? 0 : m.getCooperativeGoal(), "looks", looks));
            }
            return out;
        }
        // só o que quem olha pode ver: um look PRIVATE num Momento público não entra no ranking público
        Map<UUID, Scheme> byScheme = new HashMap<>();
        List<MomentSubmission> subs = new MomentCommunity(ctx).visibleSubmissions(viewer, m, byScheme);
        Map<UUID, Map<MomentVoteDimension, Integer>> byDim = new HashMap<>();
        for (MomentVote v : votes.findByMomentId(m.getId())) {
            byDim.computeIfAbsent(v.getSubmissionId(), k -> new java.util.EnumMap<>(MomentVoteDimension.class)).merge(v.getDimension(), 1, Integer::sum);
        }
        List<MomentSubmission> ranked = subs.stream().sorted(Comparator.comparingInt(MomentSubmission::getVoteCount).reversed()
                .thenComparing(s -> s.getMatchScore() == null ? 0 : s.getMatchScore(), Comparator.reverseOrder()).thenComparing(MomentSubmission::getSubmittedAt)).limit(LEADERBOARD_MAX).toList();
        Map<UUID, User> owners = users.findAllById(ranked.stream().map(MomentSubmission::getUserId).collect(Collectors.toSet())).stream().collect(Collectors.toMap(User::getId, u -> u));
        boolean anonymous = Boolean.TRUE.equals(settings(m).get("anonymousVoting")) && !m.getVisibility().discoverable();
        List<Map<String, Object>> items = new ArrayList<>();
        int pos = 0;
        for (MomentSubmission s : ranked) {
            pos++;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("position", pos);
            row.put("submissionId", s.getId());
            row.put("schemeId", s.getSchemeId());
            row.put("votes", s.getVoteCount());
            row.put("match", s.getMatchScore());
            row.put("byDimension", byDim.getOrDefault(s.getId(), Map.of()).entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue)));
            row.put("you", viewer != null && viewer.id().equals(s.getUserId()));
            row.put("user", anonymous && !(viewer != null && viewer.id().equals(s.getUserId())) ? null : Views.user(owners.get(s.getUserId())));
            Scheme sc = byScheme.get(s.getSchemeId());
            row.put("title", sc.getTitle());
            row.put("coverImageUrl", sc.getCoverImageUrl());
            items.add(row);
        }
        out.put("competitive", true);
        out.put("items", items);
        out.put("dimensions", List.of(MomentVoteDimension.values()));
        return out;
    }

    /** Votar/desvotar numa dimensão. Nunca no próprio look; nunca fora do período; um por (envio, dimensão). */
    Map<String, Object> vote(CurrentUser user, String idOrSlug, VoteRequest req) {
        guard.requireCanCreate(user);
        Moment m = visible(user, idOrSlug);
        if (!competitive(m)) {
            throw ApiException.conflict("SEM_VOTACAO", Msg.t("moment.este_momento_nao_tem_votacao"));
        }
        if (MomentTime.effective(m, now()) != MomentStatus.ACTIVE) {
            throw ApiException.conflict("MOMENTO_FORA_DO_PERIODO", Msg.t("moment.votacao_so_durante_o_periodo"));
        }
        if (m.getGroupId() != null && !isMember(user.id(), m.getGroupId())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("moment.so_membros_do_grupo"));
        }
        MomentSubmission s = submissions.findById(req.submissionId()).filter(x -> x.getMomentId().equals(m.getId()) && !x.isWithdrawn())
                .orElseThrow(() -> ApiException.notFound(Msg.t("moment.envio")));
        if (s.getUserId().equals(user.id())) {
            throw ApiException.conflict("VOTO_PROPRIO", Msg.t("moment.nao_da_para_votar_no_proprio"));
        }
        boolean member = user.admin() || (m.getGroupId() != null && isMember(user.id(), m.getGroupId()));
        Scheme target = schemes.findById(s.getSchemeId()).orElse(null);
        if (target == null || (!member && !guard.canView(user, target.getUser().getId(), target.getVisibility()))) {
            throw ApiException.notFound(Msg.t("moment.envio"));   // mesmo 404 de envio inexistente: não confirma que o look existe
        }
        MomentVoteDimension dim = enumOf(MomentVoteDimension.class, req.dimension() == null ? "" : req.dimension(), "dimension");
        Optional<MomentVote> existing = votes.findBySubmissionIdAndVoterIdAndDimension(s.getId(), user.id(), dim);
        boolean voted;
        if (existing.isPresent()) {
            votes.delete(existing.get());
            s.setVoteCount(Math.max(0, s.getVoteCount() - 1));
            voted = false;
        } else {
            MomentVote v = new MomentVote();
            v.setMomentId(m.getId());
            v.setSubmissionId(s.getId());
            v.setVoterId(user.id());
            v.setDimension(dim);
            votes.save(v);
            s.setVoteCount(s.getVoteCount() + 1);
            voted = true;
        }
        submissions.save(s);
        return Map.of("voted", voted, "dimension", dim.name(), "votes", s.getVoteCount());
    }
}
