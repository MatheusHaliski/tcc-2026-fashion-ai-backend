package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.UserRepository;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Equipes e liga semanal do {@link FlairService}: criar, entrar e sair de uma equipe (até 5), a visão da equipe e o
 * ranking da liga com as últimas batalhas.
 */
final class FlairTeams {
    private final FlairTeamRepository teams;
    private final FlairTeamMemberRepository members;
    private final FlairProfileRepository profiles;
    private final FlairMatchRepository matches;
    private final UserRepository users;
    private final Guard guard;

    FlairTeams(FlairTeamRepository teams, FlairTeamMemberRepository members, FlairProfileRepository profiles, FlairMatchRepository matches,
               UserRepository users, Guard guard) {
        this.teams = teams;
        this.members = members;
        this.profiles = profiles;
        this.matches = matches;
        this.users = users;
        this.guard = guard;
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    // ================================================================== equipes 3×3 e liga

    Map<String, Object> teamView(FlairTeam t, CurrentUser viewer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("code", t.getCode());
        m.put("color", t.getColor());
        m.put("points", t.getPoints());
        m.put("owner", Views.user(t.getOwner()));
        m.put("members", members.findByTeamIdOrderByCreatedAtAsc(t.getId()).stream().map(x -> Map.of("user", Views.user(x.getUser()), "role", x.getRole())).toList());
        m.put("mine", viewer != null && members.findByUserId(viewer.id()).map(x -> x.getTeam().getId().equals(t.getId())).orElse(false));
        return m;
    }

    public Map<String, Object> league(CurrentUser viewer) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("teams", teams.findTop20ByOrderByPointsDesc().stream().map(t -> teamView(t, viewer)).toList());
        out.put("mine", viewer == null ? null : members.findByUserId(viewer.id()).map(m -> teamView(m.getTeam(), viewer)).orElse(null));
        out.put("players", profiles.findTop20ByOrderByRankPointsDesc().stream().map(p -> Map.of("user", Views.user(p.getUser()), "rank", FlairEngine.rank(p.getRankPoints()), "wins", p.getWins())).toList());
        out.put("rule", Msg.t("flair.equipes_de_ate_5_no"));
        if (viewer != null) {
            out.put("battles", members.findByUserId(viewer.id()).map(m -> matches.findTop20ByTeamAIdOrTeamBIdOrderByCreatedAtDesc(m.getTeam().getId(), m.getTeam().getId()).stream()
                    .map(x -> Map.of("id", x.getId(), "theme", String.valueOf(x.getTheme()), "winner", String.valueOf(x.getWinnerSide()), "date", String.valueOf(x.getPlayDate()),
                            "side", x.getTeamAId().equals(m.getTeam().getId()) ? "A" : "B")).toList()).orElse(List.of()));
        }
        return out;
    }

    public Map<String, Object> createTeam(CurrentUser user, String name, String color) {
        guard.requireCanCreate(user);
        if (members.findByUserId(user.id()).isPresent()) {
            throw ApiException.conflict("JA_EM_EQUIPE", Msg.t("flair.saia_da_equipe_atual_antes"));
        }
        FlairTeam t = new FlairTeam();
        t.setName(InputSanitizer.required("name", InputSanitizer.moderated("name", name, 40), 3, 40));
        t.setColor(color != null && color.matches("#[0-9A-Fa-f]{6}") ? color.toUpperCase(Locale.ROOT) : "#2D55C9");
        String code;
        do {
            code = "T" + Long.toString(Math.abs(RANDOM.nextLong()), 36).toUpperCase(Locale.ROOT).substring(0, 6);
        } while (teams.findByCode(code).isPresent());
        t.setCode(code);
        t.setOwner(users.findById(user.id()).orElseThrow());
        teams.save(t);
        addMember(t, user.id(), "CAPITAO");
        return league(user);
    }

    private void addMember(FlairTeam t, UUID userId, String role) {
        FlairTeamMember m = new FlairTeamMember();
        m.setTeam(t);
        m.setUser(users.findById(userId).orElseThrow());
        m.setRole(role);
        members.save(m);
    }

    public Map<String, Object> joinTeam(CurrentUser user, String code) {
        guard.requireCanCreate(user);
        FlairTeam t = teams.findByCode(code == null ? "" : code.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound("Equipe"));
        if (members.findByUserId(user.id()).isPresent()) {
            throw ApiException.conflict("JA_EM_EQUIPE", Msg.t("flair.voce_ja_esta_numa_equipe"));
        }
        if (members.countByTeamId(t.getId()) >= 5) {
            throw ApiException.conflict("EQUIPE_CHEIA", Msg.t("flair.a_equipe_ja_tem_5"));
        }
        addMember(t, user.id(), "MEMBRO");
        return league(user);
    }

    public Map<String, Object> leaveTeam(CurrentUser user) {
        members.findByUserId(user.id()).ifPresent(m -> {
            FlairTeam t = m.getTeam();
            members.delete(m);
            members.flush();
            if (members.countByTeamId(t.getId()) == 0) {
                teams.delete(t);
            }
        });
        return league(user);
    }

}
