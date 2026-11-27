package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Desafios (RF36) com o catálogo oficial semeado na V5: criar, convidar, aceitar, sair e cancelar; progresso medido
 * pelas evidências reais (looks salvos, Looks do Dia, ações do espelho, peças cadastradas); conclusão e recompensa por
 * modo (solo, equipe, duelo e comunidade); votação às cegas, bilhetes e reações; desafios propostos pela comunidade.
 */
class ChallengeServiceTest {
    /** Linhas de challenge_templates da V5 (code, nome, regra, modos, duração, dimensões, pontos, esforço, mín, máx, decoração). */
    private static final Object[][] TEMPLATES = {
            {"TEN_X_TEN", "10×10", "10 peças, 10 looks", "[\"SOLO\",\"EQUIPE\"]", 10, "[\"V\",\"R\"]", 300, "MEDIO", 1, 6, "quadro_cortica"},
            {"CAPSULE_SEASON", "Temporada Cápsula", "33 peças", "[\"SOLO\",\"EQUIPE\"]", 90, "[\"U\",\"V\"]", 500, "ALTO", 1, 6, "fita_alfaiate"},
            {"SECOND_CHANCE", "Segunda Chance", "Resgatar esquecidas", "[\"SOLO\",\"EQUIPE\"]", 14, "[\"R\",\"U\"]", 250, "MEDIO", 1, 6, "etiqueta_2a_chance"},
            {"NO_REPEAT", "Sem Repetir", "Sem repetir", "[\"SOLO\",\"DUELO\"]", null, "[\"R\"]", 200, "MEDIO", 1, 8, "calendario_parede"},
            {"WEAR_WHAT_YOU_HAVE", "Vista o que Você Tem", "Sem compras", "[\"SOLO\",\"EQUIPE\",\"COMUNIDADE\"]", 7, "[\"U\"]", 150, "BAIXO", 1, 6, null},
            {"CHANEL_WEEK", "Semana Chanel", "Tira uma coisa", "[\"SOLO\",\"EQUIPE\"]", 7, "[\"I\"]", 150, "BAIXO", 1, 6, null},
            {"MY_SEASON", "Minha Estação", "Cartela", "[\"SOLO\",\"DUELO\"]", 7, "[\"I\"]", 150, "MEDIO", 1, 8, null},
            {"RUNWAY_BATTLE", "Batalha na Passarela", "Votação às cegas", "[\"EQUIPE\",\"DUELO\"]", 7, "[\"V\"]", 200, "MEDIO", 2, 8, "tema_espelho"},
            {"DAILY_CHALLENGE", "Desafio do Dia", "Regra do dia", "[\"COMUNIDADE\"]", 1, "[\"R\"]", 30, "BAIXO", 1, 1, null},
            {"GRWM", "Arrume-se Comigo", "Vídeo do Vista-me", "[\"SOLO\",\"EQUIPE\",\"DUELO\"]", 7, "[]", 80, "BAIXO", 1, 8, null},
            {"REAL_MIRROR", "Espelho de Verdade", "Look real", "[\"SOLO\",\"EQUIPE\"]", 7, "[\"U\"]", 120, "BAIXO", 1, 6, null},
    };

    private Kit kit;
    private World world;
    private ChallengeService challenges;
    private CurrentUser ana;
    private CurrentUser bia;
    private CurrentUser caio;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        ChallengeTemplateRepository templates = kit.dep(ChallengeTemplateRepository.class);
        for (Object[] r : TEMPLATES) {
            ChallengeTemplate t = new ChallengeTemplate();
            t.setCode((String) r[0]);
            t.setName((String) r[1]);
            t.setRuleText((String) r[2]);
            t.setModesAllowedJson((String) r[3]);
            t.setDurationDays((Integer) r[4]);
            t.setScoreDimensionsJson((String) r[5]);
            t.setRewardPoints((Integer) r[6]);
            t.setEffort((String) r[7]);
            t.setMinParticipants((Integer) r[8]);
            t.setMaxParticipants((Integer) r[9]);
            t.setRoomDecoration((String) r[10]);
            t.setOrigin("OFFICIAL");
            t.setActive(true);
            templates.save(t);
        }
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", String.valueOf(i.getArgument(2, String.class))));
        when(kit.dep(RoomService.class).hasKey(any(), any())).thenReturn(true);
        challenges = kit.build(ChallengeService.class);
        ana = Kit.as(world.me);
        bia = Kit.as(world.rival);
        caio = Kit.as(world.friend);
    }

    private ChallengeService.StartRequest solo(String code, Map<String, Object> params) {
        return new ChallengeService.StartRequest(code, "SOLO", params, null, null, false, true);
    }

    private UUID id(Map<String, Object> detail) {
        return (UUID) detail.get("id");
    }

    private ChallengeInstance instance(UUID id) {
        return kit.dep(ChallengeInstanceRepository.class).findById(id).orElseThrow();
    }

    private List<UUID> pieceIds(User u) {
        return world.piecesOf(u).stream().map(WardrobeItem::getId).toList();
    }

    /** Salva um look novo da pessoa com as peças dadas e avisa os desafios (como o SchemeService faz depois do commit). */
    private Scheme saveLook(User u, WardrobeItem... pieces) {
        Scheme s = world.look(u, "Look novo " + UUID.randomUUID(), pieces);
        challenges.onSchemeSaved(new DomainEvents.SchemeSaved(u.getId(), s.getId(), java.util.Arrays.stream(pieces).map(WardrobeItem::getId).toList(), "CRIAR_LOOK", true));
        return s;
    }

    private void dailyLook(User u, Scheme s, LocalDate day) {
        DailyLook dl = new DailyLook();
        dl.setUser(u);
        dl.setScheme(s);
        dl.setLookDate(day);
        kit.dep(DailyLookRepository.class).save(dl);
        challenges.onDailyLook(new DomainEvents.DailyLookRegistered(u.getId(), s.getId(), day, "MANUAL",
                world.itemsOf(s).stream().map(si -> si.getWardrobeItem().getId()).toList()));
    }

    @Test
    void catalogoMostraOsDesafiosComRegraDoDiaETemaDaSemana() {
        Map<String, Object> c = challenges.catalog(ana);
        List<?> cards = (List<?>) c.get("challenges");
        assertThat(cards).hasSize(TEMPLATES.length);
        assertThat(cards.stream().map(World::map).filter(m -> "DAILY_CHALLENGE".equals(m.get("code"))).findFirst().orElseThrow()).containsKey("todayRule");
        assertThat(cards.stream().map(World::map).filter(m -> "RUNWAY_BATTLE".equals(m.get("code"))).findFirst().orElseThrow()).containsKey("weeklyTheme");
        assertThat(c).containsEntry("activeCount", 0L).containsEntry("maxActive", ChallengeService.MAX_ACTIVE);
    }

    @Test
    void dezPorDezConcluiComDezLooksSoComAsPecasEscolhidas() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        List<String> ten = mine.subList(0, 10).stream().map(w -> w.getId().toString()).toList();
        assertThatThrownBy(() -> challenges.start(ana, solo("TEN_X_TEN", Map.of("piece_ids", ten.subList(0, 5))))).isInstanceOf(ApiException.class);
        List<String> foreign = new ArrayList<>(ten.subList(0, 9));
        foreign.add(world.piecesOf(world.rival).get(0).getId().toString());
        assertThatThrownBy(() -> challenges.start(ana, solo("TEN_X_TEN", Map.of("piece_ids", foreign)))).isInstanceOf(ApiException.class);

        Map<String, Object> d = challenges.start(ana, solo("TEN_X_TEN", Map.of("piece_ids", ten)));
        UUID id = id(d);
        assertThat(d.get("state")).isEqualTo(ChallengeService.ATIVO);
        assertThat(challenges.restriction(world.me.getId())).isPresent();
        for (int i = 0; i < 9; i++) {
            Scheme s = saveLook(world.me, mine.get(i % 4), mine.get(4 + i % 3), mine.get(7 + i % 2));
            s.markCreatedAt(Instant.now().minusSeconds(3 * 86_400));   // passou da janela de 24 h de "sobrevivência"
        }
        // look com peça fora das 10 não conta
        saveLook(world.me, mine.get(0), mine.get(11));
        challenges.onSchemeSaved(new DomainEvents.SchemeSaved(world.me.getId(), UUID.randomUUID(), List.of(), "CRIAR_LOOK", true));
        Map<String, Object> me = map(challenges.detail(ana, id).get("me"));
        assertThat(me.get("value")).isEqualTo(9);
        assertThat(map(challenges.decorations(world.me.getId()).get(0))).containsEntry("type", "quadro_cortica");
        Scheme last = saveLook(world.me, mine.get(1), mine.get(5));
        last.markCreatedAt(Instant.now().minusSeconds(3 * 86_400));
        challenges.conclude(instance(id), kit.dep(ChallengeTemplateRepository.class).findById("TEN_X_TEN").orElseThrow());
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.CONCLUIDO);
        assertThat(challenges.resultCard(ana, id)).containsKeys("fraction", "best", "label", "excludes");
        assertThat((List<?>) challenges.mine(ana).get("history")).hasSize(1);
    }

    @Test
    void limiteDeTresDesafiosAtivos() {
        challenges.start(ana, solo("CHANEL_WEEK", null));
        challenges.start(ana, solo("GRWM", null));
        challenges.start(ana, solo("REAL_MIRROR", null));
        assertThatThrownBy(() -> challenges.start(ana, solo("NO_REPEAT", null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).isNotBlank());
        assertThat(challenges.activeSummary(world.me.getId())).hasSize(3);
        // rascunho não ocupa vaga
        Map<String, Object> draft = challenges.start(ana, new ChallengeService.StartRequest("NO_REPEAT", "SOLO", null, null, null, true, false));
        assertThat(draft.get("state")).isEqualTo(ChallengeService.RASCUNHO);
        assertThatThrownBy(() -> challenges.launchDraft(ana, id(draft), null, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.start(ana, new ChallengeService.StartRequest("DAILY_CHALLENGE", "SOLO", null, null, null, false, false)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.start(ana, solo("NAO_EXISTE", null))).isInstanceOf(ApiException.class);
    }

    @Test
    void equipeConvidaAceitaRecusaSaiECancela() {
        assertThatThrownBy(() -> challenges.start(ana, new ChallengeService.StartRequest("CHANEL_WEEK", "EQUIPE", null, List.of(), null, false, false)))
                .isInstanceOf(ApiException.class);
        Map<String, Object> d = challenges.start(ana, new ChallengeService.StartRequest("CHANEL_WEEK", "EQUIPE", null,
                List.of(world.rival.getId(), world.friend.getId()), null, false, true));
        UUID id = id(d);
        assertThat(d.get("state")).isEqualTo(ChallengeService.AGUARDANDO);
        assertThat((List<?>) challenges.mine(bia).get("invites")).hasSize(1);
        assertThatThrownBy(() -> challenges.startNow(ana, id)).isInstanceOf(ApiException.class);   // ninguém aceitou ainda
        assertThatThrownBy(() -> challenges.startNow(bia, id)).isInstanceOf(ApiException.class);   // não é quem criou

        challenges.accept(bia, id, true);
        assertThatThrownBy(() -> challenges.accept(bia, id, true)).isInstanceOf(ApiException.class);
        challenges.decline(caio, id);   // todos responderam: começa com quem aceitou
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.ATIVO);

        // social: bilhetes prontos, livres e reações
        assertThat(challenges.note(ana, id, null, "Bora, time!")).containsEntry("kind", "FREE");
        assertThat(challenges.note(bia, id, ChallengeService.PRESET_NOTES.get(0), null)).containsEntry("kind", "PRESET");
        assertThatThrownBy(() -> challenges.note(ana, id, "frase inventada", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.note(ana, id, null, "   ")).isInstanceOf(ApiException.class);
        assertThat(challenges.react(bia, id, "🔥")).containsEntry("reaction", "🔥");
        assertThatThrownBy(() -> challenges.react(bia, id, "💩")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.react(caio, id, "🔥")).isInstanceOf(ApiException.class);

        // o espelho registra "tira uma coisa" e o progresso da equipe sobe
        challenges.onMirror(new DomainEvents.MirrorAction(world.me.getId(), "TIRA_UMA_COISA"));
        challenges.onMirror(new DomainEvents.MirrorAction(world.rival.getId(), "TIRA_UMA_COISA"));
        Map<String, Object> detail = challenges.detail(bia, id);
        assertThat((List<?>) detail.get("members")).hasSize(3);
        assertThat((List<?>) detail.get("notes")).hasSize(3);
        assertThat(detail).containsKey("teamFraction");
        assertThatThrownBy(() -> challenges.detail(Kit.as(Kit.user("estranha")), id)).isInstanceOf(ApiException.class);

        challenges.conclude(instance(id), kit.dep(ChallengeTemplateRepository.class).findById("CHANEL_WEEK").orElseThrow());
        assertThat(Json.map(instance(id).getResultJson())).containsKeys("teamFraction", "rewardEach");
    }

    @Test
    void criadorIniciaComOMinimoECancelaVoltandoParaRascunho() {
        UUID id = id(challenges.start(ana, new ChallengeService.StartRequest("GRWM", "EQUIPE", null,
                List.of(world.rival.getId(), world.friend.getId()), null, false, false)));
        challenges.accept(bia, id, false);
        challenges.startNow(ana, id);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.ATIVO);
        assertThatThrownBy(() -> challenges.cancel(bia, id)).isInstanceOf(ApiException.class);
        challenges.cancel(ana, id);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.RASCUNHO);
        assertThatThrownBy(() -> challenges.cancel(ana, id)).isInstanceOf(ApiException.class);
        challenges.launchDraft(ana, id, List.of(world.rival.getId()), null);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.AGUARDANDO);
        assertThatThrownBy(() -> challenges.launchDraft(bia, id, null, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.launchDraft(ana, id, null, null)).isInstanceOf(ApiException.class);

        // convite vencido: o job expira por falta do mínimo
        instance(id).setAcceptDeadline(Instant.now().minusSeconds(60));
        assertThatThrownBy(() -> challenges.accept(bia, id, false)).isInstanceOf(ApiException.class);
        assertThat(challenges.tick()).containsEntry("expired", 1);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.EXPIRADO);
    }

    @Test
    void jobIniciaQuemAtingiuOMinimoEConcluiOsVencidos() {
        UUID team = id(challenges.start(ana, new ChallengeService.StartRequest("REAL_MIRROR", "EQUIPE", null,
                List.of(world.rival.getId(), world.friend.getId()), null, false, true)));
        challenges.accept(bia, team, true);
        instance(team).setAcceptDeadline(Instant.now().minusSeconds(60));
        UUID solo = id(challenges.start(caio, solo("WEAR_WHAT_YOU_HAVE", null)));
        instance(solo).setEndsAt(Instant.now().minusSeconds(60));
        Map<String, Integer> r = challenges.tick();
        assertThat(r).containsEntry("started", 1).containsEntry("concluded", 1);
        assertThat(instance(solo).getState()).isEqualTo(ChallengeService.CONCLUIDO);
        assertThat(challenges.tick()).containsEntry("started", 0);

        // Espelho de Verdade em equipe: fora da janela não aceita foto; a confirmação vem de colega com consentimento
        Map<String, Object> me = map(challenges.detail(ana, team).get("me"));
        assertThat(me).containsKeys("window", "photoConsent", "photos");
        assertThatThrownBy(() -> challenges.confirmRealMirror(ana, team, world.me.getId(), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.confirmRealMirror(ana, team, world.rival.getId(), LocalDate.now())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.confirmRealMirror(ana, solo, world.rival.getId(), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.realMirror(ana, solo, new byte[]{1})).isInstanceOf(ApiException.class);
    }

    @Test
    void duasPessoasSaemEODesafioExpira() {
        UUID id = id(challenges.start(ana, new ChallengeService.StartRequest("CHANEL_WEEK", "EQUIPE", null,
                List.of(world.rival.getId()), null, false, false)));
        challenges.accept(bia, id, false);
        assertThat(challenges.leave(bia, id)).containsEntry("left", true);
        challenges.leave(ana, id);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.EXPIRADO);
        assertThatThrownBy(() -> challenges.leave(ana, id)).isInstanceOf(ApiException.class);
    }

    @Test
    void semRepetirEmDueloContaOsLooksDoDiaSemRepetirComposicao() {
        UUID id = id(challenges.start(ana, new ChallengeService.StartRequest("NO_REPEAT", "DUELO", Map.of("target_days", 2, "duel_days", 3),
                List.of(world.rival.getId()), Map.of(world.rival.getId().toString(), "B"), false, false)));
        challenges.accept(bia, id, false);
        assertThat(instance(id).getState()).isEqualTo(ChallengeService.ATIVO);
        instance(id).setStartsAt(Instant.now().minusSeconds(3 * 86_400));
        List<Scheme> mine = world.looksOf(world.me);
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        dailyLook(world.me, mine.get(0), today.minusDays(2));
        dailyLook(world.me, mine.get(1), today.minusDays(1));
        dailyLook(world.me, mine.get(1), today);   // repetiu a composição: a sequência recomeça
        dailyLook(world.rival, world.looksOf(world.rival).get(0), today);
        Map<String, Object> me = map(challenges.detail(ana, id).get("me"));
        assertThat((Integer) me.get("best")).isGreaterThanOrEqualTo(2);
        assertThat(map(challenges.decorations(world.me.getId()).get(0))).containsEntry("type", "calendario_parede");
        challenges.conclude(instance(id), kit.dep(ChallengeTemplateRepository.class).findById("NO_REPEAT").orElseThrow());
        Map<String, Object> result = Json.map(instance(id).getResultJson());
        assertThat(result).containsKeys("winners", "ranking", "teams");
        challenges.conclude(instance(id), kit.dep(ChallengeTemplateRepository.class).findById("NO_REPEAT").orElseThrow());   // idempotente
    }

    @Test
    void batalhaNaPassarelaVotacaoAsCegasUmVotoPorPessoa() {
        UUID id = id(challenges.start(ana, new ChallengeService.StartRequest("RUNWAY_BATTLE", "DUELO", null,
                List.of(world.rival.getId()), null, false, false)));
        challenges.accept(bia, id, false);
        UUID anaLook = world.lookIds(world.me).get(0);
        UUID biaLook = world.lookIds(world.rival).get(0);
        Map<String, Object> d = challenges.submitEntry(ana, id, anaLook);
        assertThat((List<?>) d.get("entries")).hasSize(1);
        assertThat(map(((List<?>) d.get("entries")).get(0)).get("author")).isNull();   // às cegas
        assertThatThrownBy(() -> challenges.submitEntry(ana, id, world.lookIds(world.me).get(1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.submitEntry(caio, id, world.lookIds(world.friend).get(0))).isInstanceOf(ApiException.class);
        challenges.submitEntry(bia, id, biaLook);

        assertThat(challenges.voteFeed(caio)).hasSize(1);
        assertThat(challenges.vote(caio, id, anaLook)).containsEntry("voted", true);
        assertThatThrownBy(() -> challenges.vote(caio, id, biaLook)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.vote(ana, id, anaLook)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> challenges.vote(Kit.as(Kit.user("x")), id, UUID.randomUUID())).isInstanceOf(ApiException.class);
        challenges.vote(Kit.as(world.person("duda2", 0)), id, anaLook);

        assertThat(map(challenges.decorations(world.me.getId()).get(0))).containsEntry("type", "tema_espelho");
        challenges.conclude(instance(id), kit.dep(ChallengeTemplateRepository.class).findById("RUNWAY_BATTLE").orElseThrow());
        Map<String, Object> result = Json.map(instance(id).getResultJson());
        assertThat(String.valueOf(result.get("winners"))).contains("ana");
        List<?> entries = (List<?>) challenges.detail(ana, id).get("entries");
        assertThat(map(entries.get(0))).containsKeys("votes", "author");
        assertThatThrownBy(() -> challenges.vote(caio, id, anaLook)).isInstanceOf(ApiException.class);   // votação fechada
    }

    @Test
    void desafioDoDiaDaComunidadeComGradeDeEmoji() {
        Map<String, Object> d = challenges.start(ana, new ChallengeService.StartRequest("DAILY_CHALLENGE", "COMUNIDADE", null, null, null, false, false));
        UUID id = id(d);
        // a mesma instância do dia para todo mundo
        assertThat(id(challenges.start(bia, new ChallengeService.StartRequest("DAILY_CHALLENGE", "COMUNIDADE", null, null, null, false, false)))).isEqualTo(id);
        assertThat(id(challenges.start(ana, new ChallengeService.StartRequest("DAILY_CHALLENGE", "COMUNIDADE", null, null, null, false, false)))).isEqualTo(id);
        for (Scheme s : world.looksOf(world.me)) {
            dailyLook(world.me, s, LocalDate.now(FaiPointsService.ZONE));
        }
        Map<String, Object> card = challenges.resultCard(ana, id);
        assertThat(card).containsKeys("text", "grid", "note");
        assertThat(challenges.detail(caio, id)).containsEntry("members", null).containsKey("playing");
    }

    @Test
    void semanaVistaOQueVoceTemNaComunidadeECompraNovaInvalidaODia() {
        UUID id = id(challenges.start(ana, new ChallengeService.StartRequest("WEAR_WHAT_YOU_HAVE", "COMUNIDADE", null, null, null, false, false)));
        dailyLook(world.me, world.looksOf(world.me).get(0), LocalDate.now(FaiPointsService.ZONE));
        WardrobeItem bought = Kit.piece(world.me, "camisa nova", "upper_piece", "shirt", "white");
        bought.setPieceOrigin("COMPRADA");
        kit.dep(WardrobeItemRepository.class).save(bought);
        challenges.onPieceCreated(new DomainEvents.PieceCreated(world.me.getId(), bought.getId(), true));
        challenges.onPieceCreated(new DomainEvents.PieceCreated(world.me.getId(), UUID.randomUUID(), true));
        assertThat(map(challenges.detail(ana, id).get("me")).get("value")).isEqualTo(0);
    }

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
            assertThat(challenges.paletteFamilies(world.me.getId())).isNotEmpty();
        }
        dna.setColorPalette("#ff0000,#0000ff");
        assertThat(challenges.paletteFamilies(world.me.getId())).isNotEmpty();
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
        assertThat(ChallengeService.describe(blocks)).contains("+");
        assertThat(ChallengeService.describe(List.of(Map.of("type", "monochrome"), Map.of("type", "neutral_only"), Map.of("type", "distinct_colors", "value", 3),
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
            assertThat(challenges.evaluate(world.me.getId(), look, ChallengeService.dailyRuleBlocks(today.plusDays(day)), today)).isNotEmpty();
            assertThat(ChallengeService.dailyRuleText(today.plusDays(day))).isNotBlank();
        }
        List<Map<String, Object>> more = new ArrayList<>();
        more.add(new LinkedHashMap<>(Map.of("type", "state", "value", "favorite")));
        more.add(new LinkedHashMap<>(Map.of("type", "state", "value", "available", "quantifier", "all")));
        more.add(new LinkedHashMap<>(Map.of("type", "piece_count", "value", 5)));
        more.add(new LinkedHashMap<>(Map.of("type", "unknown", "value", 1)));
        assertThat(challenges.evaluate(world.me.getId(), look, more, today)).containsExactly(false, true, true, false);
        assertThat(ChallengeService.teamOf(Map.of(world.me.getId().toString(), "b"), world.me.getId(), "DUELO")).isEqualTo("B");
        assertThat(ChallengeService.teamOf(null, world.me.getId(), "SOLO")).isNull();
        assertThat(ChallengeService.windowStart(UUID.randomUUID(), today).getHour()).isBetween(9, 21);
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
