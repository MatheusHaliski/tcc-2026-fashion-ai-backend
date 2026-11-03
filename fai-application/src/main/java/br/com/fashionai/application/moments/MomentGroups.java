package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService.GroupMomentRequest;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.NotificationType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentInput.enumOf;
import static br.com.fashionai.application.moments.MomentInput.parseInstant;
import static br.com.fashionai.application.moments.MomentService.MAX_PRIZE;

/** FLAIR — Momentos privados de grupo (§26–§34): calendário do grupo, resumo, criação e slug. */
final class MomentGroups extends MomentSupport {
    MomentGroups(MomentContext ctx) {
        super(ctx);
    }

    /** Calendário do grupo (§33): próximos, ativos e Memórias (§34). Só para membros. */
    Map<String, Object> groupMoments(CurrentUser user, UUID teamId) {
        FlairTeam t = teams.findById(teamId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.grupo")));
        if (!user.admin() && !isMember(user.id(), teamId)) {
            throw guard.deny(user, "team:" + teamId, Msg.t("moment.so_membros_do_grupo"));
        }
        Instant now = now();
        Map<String, Object> out = groupSummary(t, now);
        List<Moment> all = moments.findByGroupIdOrderByStartAtDesc(teamId);
        Map<UUID, MomentParticipation> mine = participations.findByMomentIdInAndUserId(all.stream().map(Moment::getId).toList(), user.id()).stream()
                .collect(Collectors.toMap(MomentParticipation::getMomentId, p -> p, (a, b) -> a));
        List<Map<String, Object>> upcoming = new ArrayList<>(), active = new ArrayList<>(), history = new ArrayList<>();
        for (Moment m : all) {
            if (m.getStatus() == MomentStatus.CANCELLED) {
                continue;
            }
            Map<String, Object> c = MomentViews.card(m, now);
            c.put("me", participationView(mine.get(m.getId())));
            switch (MomentTime.effective(m, now)) {
                case SCHEDULED, DRAFT -> upcoming.add(c);
                case ACTIVE -> active.add(c);
                default -> {
                    c.put("memory", Json.map(m.getMemoryJson()));
                    history.add(c);
                }
            }
        }
        upcoming.sort(Comparator.comparing(c -> (String) ((Map<?, ?>) c.get("time")).get("startAt")));
        out.put("upcoming", upcoming);
        out.put("active", active);
        out.put("history", history);
        out.put("members", members.countByTeamId(teamId));
        out.put("modes", List.of(FlairMomentMode.values()));
        return out;
    }

    Map<String, Object> groupSummary(FlairTeam t, Instant now) {
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("id", t.getId());
        g.put("name", t.getName());
        g.put("color", t.getColor());
        g.put("code", t.getCode());
        List<Moment> live = moments.findByGroupIdOrderByStartAtDesc(t.getId()).stream().filter(m -> m.getStatus().live()).toList();
        g.put("activeCount", live.stream().filter(m -> MomentTime.active(m, now)).count());
        g.put("upcomingCount", live.stream().filter(m -> MomentTime.upcoming(m, now)).count());
        return g;
    }

    /** FLAIR → Criar → Momento privado (§27). Nunca público; nunca em descoberta; membros avisados uma vez (§44). */
    Map<String, Object> createGroupMoment(CurrentUser user, UUID teamId, GroupMomentRequest req) {
        guard.requireCanCreate(user);
        FlairTeam t = teams.findById(teamId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.grupo")));
        if (!isMember(user.id(), teamId)) {
            throw guard.deny(user, "team:" + teamId, Msg.t("moment.so_membros_do_grupo"));
        }
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("moment.de_um_nome_ao_momento"));
        }
        ZoneId zone = MomentTime.zone(req.timezone());
        Instant start = parseInstant(req.startAt(), "startAt", zone);
        Instant end = parseInstant(req.endAt(), "endAt", zone);
        if (!end.isAfter(start)) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_fim_precisa_ser_depois"));
        }
        if (end.isBefore(now())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_momento_ja_teria_terminado"));
        }
        Moment m = new Moment();
        Moment base = req.basedOnMomentId() == null ? null : moments.findById(req.basedOnMomentId()).filter(x -> canSee(user, x)).orElse(null);
        m.setSlug(slugFor(req.name(), t.getCode()));
        m.setName(req.name().trim());
        m.setDescription(req.description() == null ? null : req.description().trim());
        m.setType(req.flairMode() == null ? MomentType.PRIVATE_GROUP : MomentType.FLAIR_EVENT);
        m.setNature(MomentNature.PRIVATE);
        m.setStatus(start.isAfter(now()) ? MomentStatus.SCHEDULED : MomentStatus.ACTIVE);
        m.setStartAt(start);
        m.setEndAt(end);
        m.setTimezone(zone.getId());
        m.setScope(MomentScope.GROUP);
        MomentVisibility vis = req.visibility() == null ? MomentVisibility.GROUP : enumOf(MomentVisibility.class, req.visibility(), "visibility");
        if (vis == MomentVisibility.PUBLIC) {
            vis = MomentVisibility.GROUP;   // Momento de grupo nunca é público (§28)
        }
        m.setVisibility(vis);
        m.setCreatedByUserId(user.id());
        m.setGroupId(t.getId());
        m.setOfficial(false);
        m.setPointsEnabled(true);
        m.setBasePoints(0);
        m.setPointsMultiplier(BigDecimal.ONE);
        m.setFlairMode(req.flairMode() == null ? FlairMomentMode.MOMENT : enumOf(FlairMomentMode.class, req.flairMode(), "flairMode"));
        m.setCooperativeGoal(m.getFlairMode() == FlairMomentMode.COOPERATIVE ? Optional.ofNullable(req.cooperativeGoal()).filter(g -> g > 0).orElse(10) : null);
        m.setStyleTags(Json.csv(req.styleTags() == null || req.styleTags().isEmpty() ? (base == null ? List.of() : Json.csv(base.getStyleTags())) : req.styleTags()));
        m.setColorTags(Json.csv(req.colorTags() == null || req.colorTags().isEmpty() ? (base == null ? List.of() : Json.csv(base.getColorTags())) : req.colorTags()));
        m.setOccasionTags(Json.csv(req.occasionTags() == null ? List.of() : req.occasionTags()));
        if (base != null) {
            m.setInterpretationsJson(base.getInterpretationsJson());
            m.setThemeJson(base.getThemeJson());
        } else {
            m.setThemeJson(Json.write(Map.of("accent", t.getColor() == null ? "#1F7A76" : t.getColor(), "icon", "🎯", "animation", "none")));
        }
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("looksPerUser", req.looksPerUser() == null ? 1 : Math.max(0, req.looksPerUser()));
        settings.put("allowRemix", req.allowRemix() == null || req.allowRemix());
        settings.put("allowVoting", req.allowVoting() == null || req.allowVoting());
        settings.put("allowComments", req.allowComments() == null || req.allowComments());
        settings.put("allowAi", req.allowAi() == null || req.allowAi());
        settings.put("allowExternalPieces", req.allowExternalPieces() == null || req.allowExternalPieces());
        settings.put("anonymousVoting", req.anonymousVoting() == null || req.anonymousVoting());
        settings.put("prizes", req.prizes() == null ? List.of() : req.prizes().stream().map(x -> Math.max(0, Math.min(MAX_PRIZE, x))).limit(3).toList());
        settings.put("theme", req.theme());
        m.setSettingsJson(Json.write(settings));
        Map<String, Object> rules = new LinkedHashMap<>();
        rules.put("text", req.rules());
        rules.put("theme", req.theme());
        m.setRulesJson(Json.write(rules));
        moments.save(m);
        // o criador já está dentro; os demais membros recebem um único aviso
        new MomentParticipationFlow(ctx).join(user, m.getId().toString(), null);
        for (FlairTeamMember mm : members.findByTeamIdOrderByCreatedAtAsc(t.getId())) {
            if (!mm.getUser().getId().equals(user.id())) {
                notifications.notify(mm.getUser().getId(), user.id(), NotificationType.MOMENT_GROUP_CREATED, "MOMENT", m.getId(),
                        Msg.k("moment.notif.grupo_criou_titulo", t.getName()), Msg.k("moment.notif.grupo_criou_corpo", m.getName(), MomentTime.localStart(m).toString()),
                        Map.of("href", "/moments/" + m.getSlug()));
            }
        }
        return new MomentDetail(ctx).detail(user, m.getId().toString());
    }

    String slugFor(String name, String teamCode) {
        String base = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        String slug = base + "-" + (teamCode == null ? "g" : teamCode.toLowerCase(Locale.ROOT)) + "-" + Integer.toHexString((int) (now().toEpochMilli() % 0xFFFFF));
        int n = 0;
        while (moments.findBySlug(slug).isPresent()) {
            slug = base + "-" + (++n);
        }
        return slug;
    }
}
