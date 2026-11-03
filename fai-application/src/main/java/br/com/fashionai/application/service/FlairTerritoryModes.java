package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FlairModesService.Territory;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairTerritory;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairTerritoryRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairModeCatalog.TERRITORIES;
import static br.com.fashionai.application.service.FlairModeCatalog.territory;
import static br.com.fashionai.application.service.FlairModeValues.ids;
import static br.com.fashionai.application.service.FlairModeValues.seasonKey;
import static br.com.fashionai.application.service.FlairModeValues.today;

/** Fashion Monopoly e FLAIR Conquest: mapa de territórios com dono e defensores, ataques com limite diário e captura. */
final class FlairTerritoryModes {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairTerritoryRepository territories;
    private final FlairMatchEntryRepository entries;
    private final UserRepository users;
    private final NotificationService notifications;
    private final Guard guard;

    FlairTerritoryModes(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairTerritoryRepository territories,
                        FlairMatchEntryRepository entries, UserRepository users, NotificationService notifications, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.territories = territories;
        this.entries = entries;
        this.users = users;
        this.notifications = notifications;
        this.guard = guard;
    }

    Map<String, Object> territories(CurrentUser user, String map) {
        String m = map == null ? "CONQUEST" : map.toUpperCase(Locale.ROOT);
        Map<String, FlairTerritory> owned = territories.findByMapCode(m).stream().collect(Collectors.toMap(FlairTerritory::getTerritoryCode, x -> x));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Territory t : TERRITORIES) {
            if (!t.map().equals(m)) {
                continue;
            }
            FlairTerritory ft = owned.get(t.code());
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("territory", t);
            v.put("theme", FlairLooks.theme(t.theme()));
            v.put("owner", ft == null || ft.getOwner() == null ? null : Views.user(ft.getOwner()));
            v.put("mine", ft != null && ft.getOwner() != null && ft.getOwner().getId().equals(user.id()));
            v.put("defenders", ft == null ? List.of() : modeLooks.looksById(ids(Json.map(ft.getDefenderJson()).get("schemeIds"))).stream().map(l -> Map.of("title", l.title(), "rating", l.rating())).toList());
            v.put("capturedAt", ft == null ? null : ft.getCapturedAt());
            v.put("defenses", ft == null ? 0 : ft.getDefenses());
            list.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("map", m);
        out.put("territories", list);
        out.put("mine", list.stream().filter(x -> Boolean.TRUE.equals(x.get("mine"))).count());
        out.put("rule", "CONQUEST".equals(m) ? Msg.t("flairModes.ataque_com_3_looks_contra")
                : Msg.t("flairModes.ataque_um_distrito_com_1"));
        return out;
    }

    Map<String, Object> attack(CurrentUser user, String map, String code, List<UUID> schemeIds) {
        guard.requireCanCreate(user);
        String m = map.toUpperCase(Locale.ROOT);
        Territory terr = territory(m, code.toUpperCase(Locale.ROOT));
        int need = "CONQUEST".equals(m) ? 3 : 1;
        if (schemeIds == null || schemeIds.size() != need) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", "CONQUEST".equals(m) ? "Ataque com exatamente 3 looks." : Msg.t("flairModes.ataque_com_1_look"));
        }
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        long today = entries.findByUserIdAndCreatedAtAfter(user.id(), dayStart).stream().filter(e -> m.equals(e.getMatch().getMode()) && "A".equals(e.getSide())).count();
        if (today >= 5) {
            throw ApiException.conflict("LIMITE_ATAQUES", Msg.t("flairModes.voce_ja_atacou_5_vezes"));
        }
        FlairTerritory ft = territories.findByMapCodeAndTerritoryCode(m, terr.code()).orElseGet(() -> {
            FlairTerritory x = new FlairTerritory();
            x.setMapCode(m);
            x.setTerritoryCode(terr.code());
            x.setDefenderJson("{}");
            return x;
        });
        if (ft.getOwner() != null && ft.getOwner().getId().equals(user.id())) {
            throw ApiException.conflict("JA_E_SEU", Msg.t("flairModes.esse_territorio_ja_e_seu"));
        }
        Theme t = FlairLooks.theme(terr.theme());
        List<Look> atk = schemeIds.stream().map(id -> modeLooks.look(modeLooks.ownScheme(user, id))).toList();
        List<Look> def = modeLooks.looksById(ids(Json.map(ft.getDefenderJson()).get("schemeIds")));
        User owner = ft.getOwner();
        if (def.size() < need) {
            List<Look> fill = owner == null ? modeLooks.houseLooks(user.id(), 10, modeLooks.seed(m, terr.code())) : modeLooks.publicLooksOf(user, owner);
            List<Look> sorted = fill.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
            List<Look> merged = new ArrayList<>(def);
            for (Look l : sorted) {
                if (merged.size() >= need) {
                    break;
                }
                if (merged.stream().noneMatch(x -> Objects.equals(x.schemeId(), l.schemeId()))) {
                    merged.add(l);
                }
            }
            def = merged;
        }
        if (def.isEmpty()) {
            throw new ApiException(409, "SEM_DEFENSOR", Msg.t("flairModes.ainda_nao_ha_looks_publicos"));
        }
        List<Clash> rounds = new ArrayList<>();
        List<Look> atkSorted = atk.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
        List<Look> defSorted = def.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
        for (int i = 0; i < need; i++) {
            Look a = atkSorted.get(i), d = defSorted.get(Math.min(i, defSorted.size() - 1));
            Clash c = FlairLooks.battle(a, d, t);
            double sb = c.scoreB();
            List<String> notes = new ArrayList<>(c.notes());
            if (owner != null && "MONOPOLY".equals(m) && d.styles().contains(terr.style())) {
                sb = Math.round(sb * 1.10 * 10) / 10.0;
                notes.add(Msg.t("flairModes.b_dono_do_distrito_cartas", terr.style()));
            }
            rounds.add(new Clash(c.label() + " · " + (i + 1), a.title(), d.title(), c.scoreA(), sb, FlairLooks.winner(c.scoreA(), sb), notes, c.breakdown()));
        }
        long wa = rounds.stream().filter(r -> "A".equals(r.winner())).count();
        boolean captured = "CONQUEST".equals(m) ? wa >= 2 : wa >= 1;
        if (captured) {
            ft.setOwner(users.findById(user.id()).orElseThrow());
            ft.setDefenderJson(Json.write(Map.of("schemeIds", schemeIds.stream().map(UUID::toString).toList())));
            ft.setCapturedAt(Instant.now());
            ft.setDefenses(0);
            territories.save(ft);
            String title = "CONQUEST".equals(m) ? Msg.t("flairModes.seu_lookbook_conquistou_a_regiao", terr.name()) : Msg.t("flairModes.voce_conquistou_o_distrito", terr.name());
            notifications.notify(user.id(), null, NotificationType.ACHIEVEMENT_UNLOCKED, "FLAIR_TERRITORY", ft.getId(), "🗺️ " + title,
                    Msg.k("flairModes.seus_looks_agora_defendem_o", terr.emoji()), Map.of("href", "/flair?tab=modos&mode=" + m));
            recorder.trophy(user.id(), m, ("CONQUEST".equals(m) ? Msg.t("flairModes.conquest") : Msg.t("flairModes.monopoly")) + terr.name(), seasonKey(), Map.of("territory", terr.code()));
        } else {
            ft.setDefenses(ft.getDefenses() + 1);
            territories.save(ft);
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("territory", terr);
        r.put("theme", t);
        r.put("captured", captured);
        r.put("defender", owner == null ? Msg.t("common.a_casa") : "@" + owner.getUsername());
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("scoreA", wa);
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        return recorder.finish(user, m, terr.name(), captured ? "A" : "B", r, atk, owner, def);
    }
}
