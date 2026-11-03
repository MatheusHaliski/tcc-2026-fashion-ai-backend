package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.insights.InsightContext;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.CopilotService.MIN_PIECES;

/** Painel do Copilot: contexto pré-preenchido (CA01/CA08) e sugestões visuais antes de qualquer pergunta. */
final class CopilotPanel extends CopilotTools {
    CopilotPanel(CopilotContext ctx) {
        super(ctx);
    }

    static List<String> promptsFor(String view) {
        return switch (view == null ? "" : view.toUpperCase(Locale.ROOT)) {
            case "GRADE" -> List.of(Msg.t("copilot.prompt_monte_um_look"), Msg.t("copilot.prompt_roupa_sem_uso"), Msg.t("copilot.prompt_o_que_falta"));
            case "QUARTO" -> List.of(Msg.t("copilot.prompt_onde_esta_tenis"), Msg.t("copilot.prompt_vista_me_trabalho"), Msg.t("copilot.prompt_organize_gavetas"));
            case "DESTAQUES" -> List.of(Msg.t("copilot.prompt_melhorar_inventario"), Msg.t("copilot.prompt_qual_desafio"), Msg.t("copilot.prompt_utilizacao_baixa"));
            default -> List.of(Msg.t("copilot.prompt_sugira_3_looks"), Msg.t("copilot.prompt_algo_diferente"), Msg.t("copilot.prompt_esta_frio"));
        };
    }

    Map<String, Object> context(CurrentUser user, String view, List<UUID> selection, String city, Double lat, Double lon) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", user.id());
        out.put("view", view == null ? "COPILOT" : view.toUpperCase(Locale.ROOT));
        out.put("pieces", pieces.countByUserId(user.id()));
        out.put("available", eligible.size());
        out.put("ready", eligible.size() >= MIN_PIECES);
        if (eligible.size() < MIN_PIECES) {
            out.put("limitation", Map.of("message", Msg.t("copilot.o_copilot_precisa_de_ao"), "href", "/pieces/new"));
        }
        // ocasião e humor pré-preenchidos pelo que o sistema conhece (último Look do Dia e ocasiões mais usadas)
        List<DailyLook> recent = dailyLooks.findTop30ByUserIdOrderByLookDateDesc(user.id());
        Map<String, Long> occ = recent.stream().flatMap(dl -> Json.csv(dl.getScheme().getOccasion()).stream())
                .collect(Collectors.groupingBy(o -> o, Collectors.counting()));
        out.put("occasion", occ.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(1).map(Map.Entry::getKey).toList());
        out.put("mood", recent.isEmpty() || recent.get(0).getScheme().getMood() == null ? null : recent.get(0).getScheme().getMood().name());
        out.put("weather", WeatherService.view(weather.resolve(lat, lon, city)));
        out.put("selection", selection == null ? List.of() : selection);
        out.put("suggestedPrompts", promptsFor(view));
        out.put("activeChallenges", challenges.activeSummary(user.id()));
        out.put("activeMoments", activeMoments(user.id()));
        return out;
    }

    /**
     * Painel do Copilot antes de qualquer pergunta: looks prontos do usuário para hoje, combinações novas montadas só com
     * o acervo (motor local, sem custo), peças esquecidas, peças que combinam com o clima/estação e looks em alta na rede.
     * Tudo volta como esquema/peça completos para o card abrir o detalhe ampliado (RF7) no modal.
     */
    Map<String, Object> suggestions(CurrentUser user, String city, Double lat, Double lon) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        WeatherService.Context w = weather.resolve(lat, lon, city);
        String season = w.season();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("weather", WeatherService.view(w));
        // 1) looks prontos: favoritos, Look do Dia recente e os menos repetidos primeiro
        List<Scheme> mine = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream()
                .filter(Scheme::isDisponivel)
                .sorted(Comparator.comparing((Scheme s) -> !s.isFavorite()).thenComparing(Scheme::getLookDoDiaCount))
                .limit(6).toList();
        out.put("readyLooks", mine.stream().map(s -> schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        // 2) combinações novas (não salvas) com peças do acervo — o usuário salva com um clique
        List<Map<String, Object>> fresh = new ArrayList<>();
        if (eligible.size() >= 2) {
            Map<UUID, WardrobeItem> byId = eligible.stream().collect(Collectors.toMap(WardrobeItem::getId, x -> x, (a, b) -> a));
            for (LocalSchemeComposer.Composition c : LocalSchemeComposer.compose(eligible, List.of(), List.of(), season, null, 3)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("title", c.title());
                m.put("rationale", c.rationale());
                m.put("occasions", c.occasions());
                m.put("styles", c.styles());
                m.put("totalPrice", c.totalPrice());
                m.put("pieces", c.items().stream().map(pk -> byId.get(pk.wardrobeItemId())).filter(Objects::nonNull)
                        .map(x -> Views.piece(x, null, null)).toList());
                m.put("pieceIds", c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList());
                fresh.add(m);
            }
        }
        // P2-16 — os mesmos seis números dos looks do chat e do Autopiloto (LookScorer): compatibilidade com o DNA, Hype
        // (média v2 das peças), novidade, reutilização, uso e sustentabilidade, lado a lado e nunca somados. Sem modo
        // escolhido, a ordem do motor local fica como está; dimensão sem base vem nula ("—"), nunca 0.
        out.put("newCombinations", fresh.isEmpty() ? fresh : scoreLooks(user, fresh, null));
        // 3) peças esquecidas: a MESMA régua do app inteiro (RoomService.forgotten — 60+ dias desde o último uso ou, se
        //    nunca usada, desde o cadastro). Antes era 30 dias aqui e "nunca usada" contava até para peça cadastrada ontem.
        LocalDate todayZ = LocalDate.now(FaiPointsService.ZONE);
        out.put("forgottenPieces", eligible.stream().filter(x -> RoomService.forgotten(x, x.getLastWornDate(), todayZ))
                .sorted(Comparator.comparingLong((WardrobeItem x) -> -HypeQueryService.idleDays(x, todayZ)))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 4) peças para o clima: mesma régua do Autopiloto (faixa de temperatura → descarta peças inadequadas; camadas no frio)
        String band = w.band();
        out.put("weatherBand", band);
        out.put("weatherPieces", eligible.stream().filter(x -> !WeatherService.unsuitable(x.getSubcategory(), band))
                .sorted(Comparator.comparing((WardrobeItem x) -> !("CAMADAS".equals(band) || "INVERNO_PESADO".equals(band)) || !WeatherService.isLayer(x.getSubcategory())))
                .limit(6).map(x -> Views.piece(x, null, null)).toList());
        // 5) em alta na rede: looks públicos de outras pessoas, os de maior HypeScore v2 primeiro (sem Hype calculado = por último)
        List<Scheme> publicLooks = schemes.findPublicFeed(org.springframework.data.domain.PageRequest.of(0, 30)).stream()
                .filter(s -> !s.getUser().getId().equals(user.id()) && schemeService.canView(user, s)).toList();
        Map<UUID, HypeScoreCurrent> lookHype = hype.currentOf(HypeEntityType.SCHEME, publicLooks.stream().map(Scheme::getId).toList());
        out.put("trendingLooks", publicLooks.stream()
                .sorted(Comparator.comparing((Scheme s) -> lookHype.containsKey(s.getId()) ? lookHype.get(s.getId()).getScore() : null,
                        Comparator.nullsLast(Comparator.<java.math.BigDecimal>reverseOrder())))
                .limit(4).map(s -> schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        out.put("suggestedPrompts", promptsFor("COPILOT"));
        // insights dinâmicos do contexto COPILOT: Hype sempre ao lado do DNA/uso, redescoberta antes de qualquer compra
        out.put("insights", insights.itemsOrEmpty(user, InsightContext.COPILOT));
        return out;
    }
}
