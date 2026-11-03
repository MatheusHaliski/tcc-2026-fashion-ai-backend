package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.ChallengeVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeNoteRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.application.service.ChallengeService.Progress;

import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.DIM_NAMES;
import static br.com.fashionai.application.service.ChallengeRules.VOTED;
import static br.com.fashionai.application.service.ChallengeRules.dateOf;
import static br.com.fashionai.application.service.ChallengeRules.round2;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeRules.tplRule;
import static br.com.fashionai.application.service.ChallengeRules.windowStart;
import static br.com.fashionai.application.service.ChallengeService.CONCLUIDO;
import static br.com.fashionai.application.service.ChallengeService.PRESET_NOTES;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CANCELADO;
import static br.com.fashionai.application.service.ChallengeService.P_CONCLUIU;
import static br.com.fashionai.application.service.ChallengeService.REACTIONS;

/**
 * CA07/CA08/CA09/CA12 — visão do desafio, looks inscritos (às cegas até o resultado) e card de resultado.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeDetailView {
    private final Guard guard;
    private final ChallengeTemplateRepository templates;
    private final ChallengeParticipantRepository participants;
    private final UserRepository users;
    private final ChallengeNoteRepository notes;
    private final ChallengeVoteRepository votes;
    private final ChallengeEventRepository evidence;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final ChallengeStore store;
    private final ChallengeProgressMeter progress;
    private final ChallengeRealMirror mirror;

    ChallengeDetailView(Guard guard, ChallengeTemplateRepository templates, ChallengeParticipantRepository participants,
                        UserRepository users, ChallengeNoteRepository notes, ChallengeVoteRepository votes,
                        ChallengeEventRepository evidence, SchemeRepository schemes, SchemeItemRepository schemeItems,
                        ChallengeStore store, ChallengeProgressMeter progress, ChallengeRealMirror mirror) {
        this.guard = guard;
        this.templates = templates;
        this.participants = participants;
        this.users = users;
        this.notes = notes;
        this.votes = votes;
        this.evidence = evidence;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.store = store;
        this.progress = progress;
        this.mirror = mirror;
    }

    Map<String, Object> detail(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElseThrow();
        List<ChallengeParticipant> ps = participants.findByInstanceId(id);
        ChallengeParticipant me = ps.stream().filter(p -> p.getUserId().equals(user.id())).findFirst().orElse(null);
        if (me == null && !"COMUNIDADE".equals(i.getMode())) {
            throw guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio"));
        }
        Map<String, Object> params = Json.map(i.getParamsJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", i.getId());
        out.put("code", t.getCode());
        out.put("name", tplName(t));
        out.put("rule", t.getCode().equals("DAILY_CHALLENGE") ? params.getOrDefault("rule", tplRule(t)) : tplRule(t));
        out.put("mode", i.getMode());
        out.put("state", i.getState());
        out.put("startsAt", i.getStartsAt());
        out.put("endsAt", i.getEndsAt());
        out.put("acceptDeadline", i.getAcceptDeadline());
        out.put("daysLeft", i.getEndsAt() == null ? null : Math.max(0, ChronoUnit.DAYS.between(today(), dateOf(i.getEndsAt()))));
        out.put("improves", Json.strings(t.getScoreDimensionsJson()).stream().map(x -> DIM_NAMES.getOrDefault(x, x)).toList());
        out.put("reward", t.getRewardPoints());
        out.put("isCreator", i.getCreatedBy().equals(user.id()));
        if (params.get("theme") != null) {
            out.put("theme", params.get("theme"));
        }
        if (me != null) {
            Progress pr = progress.progress(i, me, t);
            Map<String, Object> mine = new LinkedHashMap<>();
            mine.put("status", me.getStatus());
            mine.put("value", pr.value());
            mine.put("target", pr.target());
            mine.put("fraction", round2(pr.fraction()));
            mine.put("best", Math.max(me.getBestRecord(), pr.best()));
            mine.put("label", pr.label());
            mine.put("pendingSurvival", pr.pending());
            mine.put("team", me.getTeam());
            Map<String, Object> goal = Json.map(me.getPersonalGoalJson());
            if (goal.get("grid") != null) {
                mine.put("grid", goal.get("grid"));
            }
            if (t.getCode().equals("REAL_MIRROR")) {
                ZonedDateTime ws = windowStart(i.getId(), today());
                mine.put("window", Map.of("start", ws.toLocalTime().toString(), "end", ws.plusMinutes(30).toLocalTime().toString(),
                        "open", ZonedDateTime.now(FaiPointsService.ZONE).isAfter(ws) && ZonedDateTime.now(FaiPointsService.ZONE).isBefore(ws.plusMinutes(30))));
                mine.put("photoConsent", Boolean.TRUE.equals(goal.get("photoConsent")));
                mine.put("photos", mirror.mirrorPhotos(i, me));                  // URLs da API, nunca de /media
            }
            if (params.get("piece_ids") != null) {
                mine.put("pieceIds", params.get("piece_ids"));
            }
            out.put("me", mine);
        }
        // CA07 — só frações, nunca valores absolutos de peças dos colegas
        List<ChallengeParticipant> active = ps.stream().filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus())).toList();
        boolean seesTeamPhotos = me != null && t.getCode().equals("REAL_MIRROR") && !"COMUNIDADE".equals(i.getMode()) && active.contains(me);
        if (!"SOLO".equals(i.getMode())) {
            boolean hideAuthors = "DUELO".equals(i.getMode()) && VOTED.contains(t.getCode()) && !CONCLUIDO.equals(i.getState());
            out.put("members", ps.stream().filter(p -> !P_CANCELADO.equals(p.getStatus())).map(p -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("user", users.findById(p.getUserId()).map(u -> Map.of("id", u.getId(), "username", u.getUsername(),
                        "avatarUrl", String.valueOf(u.getAvatarUrl()))).orElse(null));
                m.put("status", p.getStatus());
                m.put("team", p.getTeam());
                m.put("fraction", round2(p.getProgressFraction().doubleValue()));
                // ETI-05 — foto do colega só com o consentimento dele (e sempre pela API autenticada)
                if (seesTeamPhotos && !p.getUserId().equals(user.id()) && Boolean.TRUE.equals(Json.map(p.getPersonalGoalJson()).get("photoConsent"))) {
                    m.put("mirrorPhotos", mirror.mirrorPhotos(i, p));
                }
                return m;
            }).toList());
            if ("EQUIPE".equals(i.getMode())) {
                out.put("teamFraction", round2(active.stream().mapToDouble(p -> p.getProgressFraction().doubleValue()).average().orElse(0)));
            }
            if ("COMUNIDADE".equals(i.getMode())) {
                out.put("members", null);
                out.put("playing", active.size());
            }
            out.put("entries", entries(user, i, t, hideAuthors));
            out.put("notes", notes.findTop100ByInstanceIdOrderByCreatedAtDesc(id).stream().map(n -> Map.of("kind", n.getKind(), "content", n.getContent(),
                    "user", users.findById(n.getUserId()).map(User::getUsername).orElse("—"), "at", n.getCreatedAt())).toList());
            out.put("reactions", REACTIONS);
            out.put("presetNotes", PRESET_NOTES);
        }
        out.put("result", Json.map(i.getResultJson()));
        out.put("decoration", t.getRoomDecoration());
        return out;
    }

    /** CA09 — só os looks que cada membro publicou no desafio, nunca o guarda-roupa; CA08 — às cegas até o resultado. */
    List<Map<String, Object>> entries(CurrentUser viewer, ChallengeInstance i, ChallengeTemplate t, boolean blind) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<UUID, Long> voteCount = CONCLUIDO.equals(i.getState()) ? votes.findByInstanceId(i.getId()).stream()
                .collect(Collectors.groupingBy(ChallengeVote::getEntrySchemeId, Collectors.counting())) : Map.of();
        for (ChallengeEvent e : evidence.findByInstanceId(i.getId())) {
            if (!"LOOK_ENTRY".equals(e.getEvidenceType())) {
                continue;
            }
            Scheme s = schemes.findById(e.getRefId()).orElse(null);
            if (s == null) {
                continue;
            }
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("entryId", s.getId());
            m.put("coverImageUrl", s.getCoverImageUrl());
            m.put("title", blind ? Msg.t("challenge.look", (out.size() + 1)) : s.getTitle());
            m.put("pieces", items.stream().map(si -> {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("imageUrl", si.getWardrobeItem().getImageUrl());
                pm.put("category", si.getWardrobeItem().getCategory());
                if (!blind) {
                    pm.put("name", si.getWardrobeItem().getName());
                    pm.put("brand", si.getWardrobeItem().getBrandName());
                }
                return pm;
            }).toList());
            m.put("author", blind ? null : users.findById(e.getUserId()).map(User::getUsername).orElse("—"));
            m.put("mine", e.getUserId().equals(viewer.id()));
            m.put("votedByMe", votes.existsByInstanceIdAndVoterUserIdAndEntrySchemeId(i.getId(), viewer.id(), s.getId()));
            if (!voteCount.isEmpty()) {
                m.put("votes", voteCount.getOrDefault(s.getId(), 0L));
            }
            out.add(m);
        }
        return out;
    }

    Map<String, Object> resultCard(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElseThrow();
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id())
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("title", tplName(t));
        card.put("mode", i.getMode());
        card.put("format", "9:16");
        if (t.getCode().equals("DAILY_CHALLENGE")) {
            Map<String, Object> params = Json.map(i.getParamsJson());
            String grid = String.valueOf(Json.map(me.getPersonalGoalJson()).getOrDefault("grid", "⬜"));
            card.put("text", Msg.t("challenge.desafio_do_dia", params.getOrDefault("number", ""), grid));
            card.put("grid", grid);
            card.put("note", Msg.t("challenge.grade_compartilhavel_sem_expor_as"));
            return card;
        }
        Progress pr = progress.progress(i, me, t);
        card.put("fraction", round2(Math.max(pr.fraction(), me.getProgressFraction().doubleValue())));
        card.put("best", Math.max(pr.best(), me.getBestRecord()));
        card.put("label", pr.label());
        card.put("result", Json.map(i.getResultJson()));
        card.put("excludes", List.of(Msg.t("common.preco"), Msg.t("challenge.custo_por_uso"), "marcas", "acervo completo"));
        return card;
    }
}
