package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import org.junit.jupiter.api.BeforeEach;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Base dos testes de desafios (RF36): catálogo oficial semeado na V5, pessoas do {@link World}, o serviço montado pelo
 * {@link Kit} e os atalhos para salvar looks e registrar Looks do Dia como os serviços fazem depois do commit.
 * Separada de {@code ChallengeServiceTest} por tema no lote R82, sem mudar nenhum teste.
 */
abstract class ChallengeServiceFixture {
    /** Linhas de challenge_templates da V5 (code, nome, regra, modos, duração, dimensões, pontos, esforço, mín, máx, decoração). */
    static final Object[][] TEMPLATES = {
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

    Kit kit;
    World world;
    ChallengeService challenges;
    CurrentUser ana;
    CurrentUser bia;
    CurrentUser caio;

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

    ChallengeService.StartRequest solo(String code, Map<String, Object> params) {
        return new ChallengeService.StartRequest(code, "SOLO", params, null, null, false, true);
    }

    UUID id(Map<String, Object> detail) {
        return (UUID) detail.get("id");
    }

    ChallengeInstance instance(UUID id) {
        return kit.dep(ChallengeInstanceRepository.class).findById(id).orElseThrow();
    }

    List<UUID> pieceIds(User u) {
        return world.piecesOf(u).stream().map(WardrobeItem::getId).toList();
    }

    /** Salva um look novo da pessoa com as peças dadas e avisa os desafios (como o SchemeService faz depois do commit). */
    Scheme saveLook(User u, WardrobeItem... pieces) {
        Scheme s = world.look(u, "Look novo " + UUID.randomUUID(), pieces);
        challenges.onSchemeSaved(new DomainEvents.SchemeSaved(u.getId(), s.getId(), java.util.Arrays.stream(pieces).map(WardrobeItem::getId).toList(), "CRIAR_LOOK", true));
        return s;
    }

    void dailyLook(User u, Scheme s, LocalDate day) {
        DailyLook dl = new DailyLook();
        dl.setUser(u);
        dl.setScheme(s);
        dl.setLookDate(day);
        kit.dep(DailyLookRepository.class).save(dl);
        challenges.onDailyLook(new DomainEvents.DailyLookRegistered(u.getId(), s.getId(), day, "MANUAL",
                world.itemsOf(s).stream().map(si -> si.getWardrobeItem().getId()).toList()));
    }

    /** Avaliador dos blocos de regra com os mesmos repositórios do serviço (colaborador do Facade, R82). */
    ChallengeRuleEvaluator evaluator() {
        return new ChallengeRuleEvaluator(kit.dep(StyleDnaRepository.class), kit.dep(PieceUsageDiaryEntryRepository.class));
    }
}
