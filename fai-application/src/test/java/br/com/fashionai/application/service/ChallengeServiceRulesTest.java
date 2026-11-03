package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Desafios (RF36) por regra de cada modelo: Segunda Chance, Cápsula, Minha Estação, Arrume-se Comigo, desafios propostos
 * pela comunidade com blocos de regra, regras do Desafio do Dia e as participações listadas por situação.
 * Separado de {@code ChallengeServiceTest} no lote R82, sem mudar nenhuma asserção.
 */
class ChallengeServiceRulesTest extends ChallengeServiceFixture {
    @Test
    void segundaChanceResgataAsPecasEsquecidas() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        mine.subList(0, 4).forEach(w -> w.markCreatedAt(Instant.now().minusSeconds(200L * 86_400)));
        UUID id = id(challenges.start(ana, solo("SECOND_CHANCE", Map.of("percent", 50))));
        Map<String, Object> me = map(challenges.detail(ana, id).get("me"));
        assertThat(me.get("target")).isEqualTo(2);
        assertThat(map(challenges.decorations(world.me.getId()).get(0))).containsEntry("type", "etiqueta_2a_chance");
        saveLook(world.me, mine.get(0), mine.get(1));
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.CONCLUIDO);
    }

    @Test
    void capsulaComTrintaETresPecas() {
        for (int i = 0; i < 21; i++) {
            kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "extra " + i, i % 2 == 0 ? "upper_piece" : "lower_piece", "t_shirt", "black"));
        }
        List<String> all = pieceIds(world.me).stream().map(UUID::toString).toList();
        assertThat(all).hasSize(33);
        UUID id = id(challenges.start(ana, solo("CAPSULE_SEASON", Map.of("piece_ids", all, "target_days", 200))));
        assertThat(Json.map(instance(id).getParamsJson())).containsEntry("target_days", 90);
        dailyLook(world.me, world.looksOf(world.me).get(0), LocalDate.now(FaiPointsService.ZONE));
        assertThat(map(challenges.detail(ana, id).get("me")).get("value")).isEqualTo(1);
        assertThat((List<?>) map(challenges.decorations(world.me.getId()).get(0)).get("tapedPieceIds")).isEmpty();
        // look com peça de fora da cápsula vira violação do dia
        WardrobeItem outside = Kit.piece(world.me, "fora", "upper_piece", "shirt", "white");
        kit.dep(WardrobeItemRepository.class).save(outside);
        Scheme s = world.look(world.me, "fora da cápsula", outside, world.piecesOf(world.me).get(1));
        challenges.onDailyLook(new DomainEvents.DailyLookRegistered(world.me.getId(), s.getId(), LocalDate.now(), "MANUAL",
                List.of(outside.getId(), world.piecesOf(world.me).get(1).getId())));
    }

    @Test
    void minhaEstacaoPrecisaDaCartelaDoDna() {
        assertThatThrownBy(() -> challenges.start(ana, solo("MY_SEASON", null))).isInstanceOf(ApiException.class);
        StyleDna dna = new StyleDna();
        dna.setUser(world.me);
        dna.setColorSeason("VERAO");
        kit.dep(StyleDnaRepository.class).save(dna);
        UUID id = id(challenges.start(ana, solo("MY_SEASON", null)));
        dailyLook(world.me, world.looksOf(world.me).get(1), LocalDate.now(FaiPointsService.ZONE));
        assertThat(map(challenges.detail(ana, id).get("me"))).containsKey("value");
        for (String season : List.of("PRIMAVERA", "OUTONO", "INVERNO")) {
            dna.setColorSeason(season);
            assertThat(evaluator().paletteFamilies(world.me.getId())).isNotEmpty();
        }
        dna.setColorPalette("#ff0000,#0000ff");
        assertThat(evaluator().paletteFamilies(world.me.getId())).isNotEmpty();
    }

    @Test
    void arrumeSeComigoContaOVideoDoVistaMe() {
        UUID id = id(challenges.start(ana, solo("GRWM", null)));
        challenges.onMirror(new DomainEvents.MirrorAction(world.me.getId(), "GRWM_VIDEO"));
        challenges.onMirror(new DomainEvents.MirrorAction(world.me.getId(), "OUTRA_ACAO"));
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.CONCLUIDO);
    }

    @Test
    void desafioDaComunidadeComBlocosDeRegraEPromocaoPeloAdmin() {
        assertThatThrownBy(() -> challenges.propose(ana, new ChallengeService.ProposalRequest(" ", List.of(Map.of("type", "monochrome", "value", true)), null, 3)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.propose(ana, new ChallengeService.ProposalRequest("Vazio", List.of(), null, 3))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.propose(ana, new ChallengeService.ProposalRequest("Errado", List.of(Map.of("type", "inventado", "value", 1)), null, 3)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.propose(ana, new ChallengeService.ProposalRequest("Valor", List.of(Map.of("type", "category", "value", "nada")), null, 3)))
                .isInstanceOf(ApiException.class);

        List<Map<String, Object>> blocks = List.of(
                Map.of("type", "category", "value", "upper_piece"),
                Map.of("type", "piece_count", "value", 5),
                Map.of("type", "state", "value", "available", "quantifier", "all"),
                Map.of("type", "origin", "value", "COMPRADA|HERDADA"));
        Map<String, Object> p = challenges.propose(ana, new ChallengeService.ProposalRequest("Básico de cima", blocks.subList(0, 3), List.of("solo", "equipe", "duelo"), 40));
        String code = String.valueOf(p.get("code"));
        assertThat(String.valueOf(p.get("rule"))).contains("30");
        assertThat(ChallengeRules.describe(blocks)).contains("+");
        assertThat(ChallengeRules.describe(List.of(Map.of("type", "monochrome"), Map.of("type", "neutral_only"), Map.of("type", "distinct_colors", "value", 3),
                Map.of("type", "unused_days", "value", 30), Map.of("type", "slot", "value", "upper"), Map.of("type", "state", "value", "forgotten"),
                Map.of("type", "state", "value", "favorite"), Map.of("type", "color_family", "value", "Azul")))).isNotBlank();

        UUID id = id(challenges.start(bia, solo(code, null)));
        WardrobeItem top = world.piece(world.rival, "t_shirt");
        saveLook(world.rival, top, world.piece(world.rival, "jeans"));
        assertThat(map(challenges.detail(bia, id).get("me")).get("value")).isEqualTo(1);
        assertThat(challenges.promote(Kit.admin(world.friend), code)).containsEntry("origin", "OFFICIAL");
        assertThat(challenges.catalog(bia).get("activeCount")).isEqualTo(1L);
    }

    @Test
    void regrasDoDesafioDoDiaAvaliamCadaBloco() {
        List<WardrobeItem> look = List.of(world.piece(world.me, "t_shirt"), world.piece(world.me, "jeans"), world.piece(world.me, "cap"));
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        for (int day = 0; day < 7; day++) {
            assertThat(evaluator().evaluate(world.me.getId(), look, ChallengeRules.dailyRuleBlocks(today.plusDays(day)), today)).isNotEmpty();
            assertThat(ChallengeRules.dailyRuleText(today.plusDays(day))).isNotBlank();
        }
        List<Map<String, Object>> more = new ArrayList<>();
        more.add(new LinkedHashMap<>(Map.of("type", "state", "value", "favorite")));
        more.add(new LinkedHashMap<>(Map.of("type", "state", "value", "available", "quantifier", "all")));
        more.add(new LinkedHashMap<>(Map.of("type", "piece_count", "value", 5)));
        more.add(new LinkedHashMap<>(Map.of("type", "unknown", "value", 1)));
        assertThat(evaluator().evaluate(world.me.getId(), look, more, today)).containsExactly(false, true, true, false);
        assertThat(ChallengeRules.teamOf(Map.of(world.me.getId().toString(), "b"), world.me.getId(), "DUELO")).isEqualTo("B");
        assertThat(ChallengeRules.teamOf(null, world.me.getId(), "SOLO")).isNull();
        assertThat(ChallengeRules.windowStart(UUID.randomUUID(), today).getHour()).isBetween(9, 21);
    }

    @Test
    void participacoesListadasPorSituacao() {
        challenges.start(ana, solo("CHANEL_WEEK", null));
        challenges.start(ana, new ChallengeService.StartRequest("GRWM", "SOLO", null, null, null, true, false));
        challenges.start(bia, new ChallengeService.StartRequest("GRWM", "EQUIPE", null, List.of(world.me.getId()), null, false, false));
        Map<String, Object> m = challenges.mine(ana);
        assertThat((List<?>) m.get("active")).hasSize(1);
        assertThat((List<?>) m.get("drafts")).hasSize(1);
        assertThat((List<?>) m.get("invites")).hasSize(1);
        assertThat(MemoryRepository.<ChallengeParticipant>rows(kit.dep(ChallengeParticipantRepository.class))).hasSize(4);
        assertThat(challenges.mine(caio).get("active")).isEqualTo(List.of());
        assertThat(challenges.restriction(world.friend.getId())).isEmpty();
    }
}
