package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairCoinEntry;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairService.season;

/**
 * Perfil FLAIR do {@link FlairService}: coins e pontos de rank com recompensa idempotente, o painel do jogador, a loja
 * de skins (só cosméticos) e a reavaliação dos direitos a cupom depois de uma vitória.
 */
final class FlairWallet {
    private final FlairProfileRepository profiles;
    private final FlairCoinEntryRepository coins;
    private final UserRepository users;
    private final FlairTeamMemberRepository members;
    private final FlairMatchEntryRepository entries;
    private final ApplicationEventPublisher events;
    private final FlairTeams teamsMode;
    private final FlairMatchLog matchLog;

    FlairWallet(FlairProfileRepository profiles, FlairCoinEntryRepository coins, UserRepository users, FlairTeamMemberRepository members,
                FlairMatchEntryRepository entries, ApplicationEventPublisher events, FlairTeams teamsMode, FlairMatchLog matchLog) {
        this.profiles = profiles;
        this.coins = coins;
        this.users = users;
        this.members = members;
        this.entries = entries;
        this.events = events;
        this.teamsMode = teamsMode;
        this.matchLog = matchLog;
    }

    static final Map<String, Integer> SKINS = Map.of("BRAND_FRAME", 300, "HOLOGRAFICO", 500, "CHAMPION", 800);

    // ================================================================== perfil, coins e rank

    FlairProfile profile(UUID userId) {
        return profiles.findByUserId(userId).orElseGet(() -> {
            FlairProfile p = new FlairProfile();
            p.setUser(users.findById(userId).orElseThrow());
            return profiles.save(p);
        });
    }

    /** Recompensa idempotente: (motivo, referência) paga uma vez só. */
    boolean award(UUID userId, int delta, int rankPoints, String reason, String ref) {
        if (coins.existsByUserIdAndReasonAndRef(userId, reason, ref)) {
            return false;
        }
        FlairCoinEntry e = new FlairCoinEntry();
        e.setUser(users.findById(userId).orElseThrow());
        e.setDelta(delta);
        e.setReason(reason);
        e.setRef(ref);
        coins.save(e);
        FlairProfile p = profile(userId);
        p.setCoins(p.getCoins() + delta);
        p.setRankPoints(p.getRankPoints() + rankPoints);
        return true;
    }

    public Map<String, Object> me(CurrentUser user) {
        FlairProfile p = profile(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("coins", p.getCoins());
        out.put("rank", FlairEngine.rank(p.getRankPoints()));
        out.put("wins", p.getWins());
        out.put("losses", p.getLosses());
        out.put("draws", p.getDraws());
        out.put("skins", Json.strings(p.getSkinsJson()));
        out.put("activeSkin", p.getActiveSkin());
        out.put("skinShop", SKINS);
        out.put("season", season());
        out.put("team", members.findByUserId(user.id()).map(m -> teamsMode.teamView(m.getTeam(), user)).orElse(null));
        out.put("ledger", coins.findTop30ByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .map(e -> Map.of("delta", e.getDelta(), "reason", e.getReason(), "ref", e.getRef(), "at", e.getCreatedAt())).toList());
        out.put("recent", entries.findTop30ByUserIdOrderByCreatedAtDesc(user.id()).stream().limit(10).map(matchLog::entryView).toList());
        out.put("ethics", Msg.t("flair.sem_apostas_coins_vem_do"));
        return out;
    }

    public Map<String, Object> buySkin(CurrentUser user, String skin, boolean activate) {
        String code = skin == null ? "" : skin.toUpperCase(Locale.ROOT);
        Integer price = SKINS.get(code);
        if (price == null) {
            throw ApiException.notFound("Skin");
        }
        FlairProfile p = profile(user.id());
        List<String> owned = new ArrayList<>(Json.strings(p.getSkinsJson()));
        if (!owned.contains(code)) {
            if (p.getCoins() < price) {
                throw new ApiException(409, "COINS_INSUFICIENTES", Msg.t("flair.faltam_coins_para_esta_skin", (price - p.getCoins())));
            }
            award(user.id(), -price, 0, "SKIN", code);
            owned.add(code);
            p.setSkinsJson(Json.write(owned));
        }
        if (activate) {
            p.setActiveSkin(code);
        }
        return me(user);
    }

    /** Card RF38 — uma vitória pode completar uma combinação: reavalia os direitos a cupom depois do commit. */
    public void rightsCheck(UUID userId) {
        events.publishEvent(new br.com.fashionai.application.events.DomainEvents.CouponRightsCheck(userId));
    }

}
