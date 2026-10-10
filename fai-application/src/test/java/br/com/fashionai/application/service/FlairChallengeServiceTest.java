package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * FLAIR-UT F5 · §14 — Desafios de Montagem dentro dos Momentos: entrega atômica com cartas bloqueadas como memória (D7),
 * janela do Momento e Memória (E1–E2), pontos determinísticos com multiplicador e redescoberta (S3, C3), comunidade só
 * depois de a pessoa se expressar (I1–I2), grupo "Lenda do estilo", validações da administração (R1, P2, A1) e o
 * desafio do Momento privado de grupo.
 */
class FlairChallengeServiceTest {
    static final Instant NOW = Instant.parse("2026-10-25T15:00:00Z");
    static final String READINGS = "[{\"key\":\"dark\",\"label\":{\"pt-BR\":\"Dark\"},\"styleTags\":[\"edgy\",\"grunge\"],\"colorTags\":[\"black\"]},"
            + "{\"key\":\"orange-black\",\"label\":{\"pt-BR\":\"Laranja e preto\"},\"colorTags\":[\"orange\",\"black\"]}]";

    private Kit kit;
    private FlairChallengeService service;
    private MomentService momentService;
    private FaiPointsService points;
    private FlairCollectionService collection;
    private User ana;
    private User bia;
    private CurrentUser anaU;
    private CurrentUser biaU;
    private Moment halloween;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.save(UserRepository.class, Kit.user("ana"));
        bia = kit.save(UserRepository.class, Kit.user("bia"));
        anaU = Kit.as(ana);
        biaU = Kit.as(bia);
        momentService = kit.dep(MomentService.class);
        lenient().when(momentService.canSee(any(), any())).thenReturn(true);
        points = kit.dep(FaiPointsService.class);
        lenient().when(points.award(any(), anyString(), anyString(), anyString(), any())).thenAnswer(i -> {
            Integer p = i.getArgument(4);
            return new FaiPointsService.Award(true, p == null ? 10 : p, false, "", null, false);
        });
        collection = kit.dep(FlairCollectionService.class);
        lenient().when(collection.visible(any(), any())).thenReturn(true);
        Guard guard = kit.dep(Guard.class);
        lenient().when(guard.deny(any(), any(), any())).thenAnswer(i -> ApiException.forbidden(i.getArgument(2)));
        service = kit.build(FlairChallengeService.class);
        service.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
        halloween = moment("halloween-2026", MomentNature.CULTURAL, "2026-10-20T03:00:00Z", "2026-11-01T03:00:00Z", READINGS);
    }

    // ------------------------------------------------------------------ apoio
    Moment moment(String slug, MomentNature nature, String start, String end, String readings) {
        Moment m = new Moment();
        m.setSlug(slug);
        m.setName(slug);
        m.setType(MomentType.CULTURAL);
        m.setNature(nature);
        m.setStatus(MomentStatus.ACTIVE);
        m.setStartAt(Instant.parse(start));
        m.setEndAt(Instant.parse(end));
        m.setPointsEnabled(true);
        m.setPointsMultiplier(new BigDecimal("1.50"));
        m.setInterpretationsJson(readings);
        return kit.save(MomentRepository.class, m);
    }

    FlairChallenge challenge(String slug, Moment m, String slots, String reqs, int pts) {
        FlairChallenge c = new FlairChallenge();
        c.setSlug(slug);
        c.setName(slug);
        c.setScenario("halloween");
        c.setDifficulty(FlairChallengeDifficulty.MEDIUM);
        c.setMomentId(m == null ? null : m.getId());
        c.setSlotsJson(slots);
        c.setRequirementsJson(reqs);
        c.setPoints(pts);
        return kit.save(FlairChallengeRepository.class, c);
    }

    static final String THREE = "[{\"key\":\"rua\",\"position\":\"CAL\"},{\"key\":\"festa\",\"position\":\"SUP\"},{\"key\":\"pista\",\"position\":\"INF\"}]";

    FlairCardInstance card(User owner, String position, String color, String styles, int addedDaysAgo, Integer wornDaysAgo) {
        String category = switch (position) {
            case "CAL" -> "shoes_piece";
            case "INF" -> "lower_piece";
            case "ACE" -> "accessory_piece";
            default -> "upper_piece";
        };
        WardrobeItem w = Kit.piece(owner, "peça " + position + " " + color, category, "t_shirt", color);
        w.markCreatedAt(NOW.minusSeconds(86_400L * addedDaysAgo));
        w.setStyleTags(styles);
        w.setLastWornDate(wornDaysAgo == null ? null : LocalDate.ofInstant(NOW, ZoneOffset.UTC).minusDays(wornDaysAgo));
        kit.save(WardrobeItemRepository.class, w);
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(owner.getId());
        c.setCreatorId(owner.getId());
        c.setOriginType("PIECE");
        c.setOriginId(w.getId());
        c.setSeason("SPRING");
        c.setTier("BRONZE");
        c.setOvr(60);
        c.setPosition(position);
        c.setName(w.getName());
        c.setBrandName("Norte");
        c.setImageUrl("/media/x.png");
        c.setTagsJson(Json.write(FlairCollectionService.tagsOf(w)));
        return kit.save(FlairCardInstanceRepository.class, c);
    }

    static FlairChallengeService.BuildRequest build(String interpretation, Object... slotCard) {
        Map<String, UUID> m = new LinkedHashMap<>();
        for (int i = 0; i < slotCard.length; i += 2) {
            m.put((String) slotCard[i], ((FlairCardInstance) slotCard[i + 1]).getId());
        }
        return new FlairChallengeService.BuildRequest(m, interpretation);
    }

    static String code(Throwable t) {
        return ((ApiException) t).code();
    }

    // ------------------------------------------------------------------ entrega
    @Test
    @SuppressWarnings("unchecked")
    void entregaBloqueiaAsCartasGravaAHistoriaELancaOsPontosComMultiplicador() {
        FlairChallenge c = challenge("noite-de-halloween", halloween, THREE, "[{\"type\":\"theme\",\"count\":2}]", 30);
        FlairCardInstance rua = card(ana, "CAL", "black", "edgy", 200, 5);
        FlairCardInstance festa = card(ana, "SUP", "orange", "basic", 200, 5);
        FlairCardInstance pista = card(ana, "INF", "pink", "romantic", 200, 5);
        FlairChallengeService.BuildRequest req = build("dark", "rua", rua, "festa", festa, "pista", pista);

        Map<String, Object> check = service.check(anaU, c.getSlug(), req);
        assertThat(check).containsEntry("canSubmit", true).containsEntry("status", "OPEN");
        Map<String, Object> pts = (Map<String, Object>) check.get("points");
        assertThat(pts).containsEntry("total", 45);                                   // S3: 30 × 1,5 do Halloween, antes de entregar
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());

        Map<String, Object> out = service.submit(anaU, c.getSlug(), req);

        assertThat(((Map<String, Object>) out.get("evaluation")).get("ok")).isEqualTo(true);
        verify(points).award(ana.getId(), "FLAIR_CBC", "FLAIR_CHALLENGE", c.getId().toString(), 45);
        verify(momentService).recordCardChallenge(halloween, ana.getId());
        // D7: as cartas viram memória — fora de jogo e de troca, a peça continua no guarda-roupa
        FlairCardInstance locked = kit.dep(FlairCardInstanceRepository.class).findById(rua.getId()).orElseThrow();
        assertThat(locked.getState()).isEqualTo("LOCKED_CHALLENGE");
        assertThat(locked.getLockedChallengeId()).isEqualTo(c.getId());
        assertThat(locked.isTradeable()).isFalse();
        assertThat(kit.dep(WardrobeItemRepository.class).findById(rua.getOriginId())).isPresent();
        // D1: a história fica gravada como chaves e variáveis, carta a carta
        String story = kit.dep(FlairChallengeSubmissionRepository.class).findAll().get(0).getStoryJson();
        assertThat(story).contains("cbc.scenario.halloween.rua.story", "cbc.story.reading");
        // uma entrega por pessoa; a carta já entregue não volta a jogar
        assertThatThrownBy(() -> service.submit(anaU, c.getSlug(), req)).satisfies(t -> assertThat(code(t)).isEqualTo("LIMITE_DE_ENTREGAS"));
        FlairChallenge other = challenge("outro", halloween, THREE, "[]", 10);
        assertThatThrownBy(() -> service.check(anaU, other.getSlug(), build(null, "rua", rua)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("CARTA_ENTREGUE"));
    }

    @Test
    void montagemQueNaoCumpreOsRequisitosNaoMexeEmNada() {
        FlairChallenge c = challenge("noite", halloween, THREE, "[{\"type\":\"theme\",\"count\":3}]", 30);
        FlairCardInstance rua = card(ana, "CAL", "black", "edgy", 200, 5);
        FlairCardInstance festa = card(ana, "SUP", "pink", "romantic", 200, 5);
        FlairCardInstance pista = card(ana, "INF", "green", "preppy", 200, 5);

        assertThatThrownBy(() -> service.submit(anaU, c.getSlug(), build(null, "rua", rua, "festa", festa, "pista", pista)))
                .satisfies(t -> {
                    assertThat(code(t)).isEqualTo("MONTAGEM_INCOMPLETA");
                    assertThat(((ApiException) t).details()).containsKey("evaluation");
                });
        assertThat(kit.dep(FlairCardInstanceRepository.class).findAll()).allSatisfy(x -> assertThat(x.getState()).isEqualTo("AVAILABLE"));
        assertThat(kit.dep(FlairChallengeSubmissionRepository.class).findAll()).isEmpty();
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void janelaDoMomentoEmBreveMontaEncerradoViraMemoria() {
        Moment later = moment("carnaval", MomentNature.CULTURAL, "2027-02-05T03:00:00Z", "2027-02-18T03:00:00Z", READINGS);
        Moment past = moment("primavera-2025", MomentNature.SEASONAL, "2025-09-22T03:00:00Z", "2025-12-21T03:00:00Z", READINGS);
        FlairChallenge soon = challenge("carnaval-no-bloco", later, THREE, "[]", 30);
        FlairChallenge gone = challenge("jardim-2025", past, THREE, "[]", 20);
        FlairChallenge always = challenge("ipanema", null, THREE, "[]", 15);
        FlairCardInstance rua = card(ana, "CAL", "black", "edgy", 30, 5);
        FlairCardInstance festa = card(ana, "SUP", "black", "edgy", 30, 5);
        FlairCardInstance pista = card(ana, "INF", "black", "edgy", 30, 5);
        FlairChallengeService.BuildRequest req = build(null, "rua", rua, "festa", festa, "pista", pista);

        // em breve: dá para montar e conferir, a entrega abre com o Momento
        assertThat(service.check(anaU, soon.getSlug(), req)).containsEntry("status", "UPCOMING").containsEntry("canSubmit", false);
        assertThatThrownBy(() -> service.submit(anaU, soon.getSlug(), req)).satisfies(t -> assertThat(code(t)).isEqualTo("DESAFIO_EM_BREVE"));
        // encerrado: não recebe entrega, mas continua visível como Memória (E2)
        assertThatThrownBy(() -> service.submit(anaU, gone.getSlug(), req)).satisfies(t -> assertThat(code(t)).isEqualTo("DESAFIO_ENCERRADO"));
        Map<String, Object> list = service.list(anaU, null);
        assertThat((List<Map<String, Object>>) list.get("upcoming")).extracting(x -> x.get("slug")).contains("carnaval-no-bloco");
        assertThat((List<Map<String, Object>>) list.get("memories")).extracting(x -> x.get("slug")).contains("jardim-2025");
        assertThat((List<Map<String, Object>>) list.get("always")).extracting(x -> x.get("slug")).contains("ipanema");
        // sem Momento ativo não há multiplicador
        assertThat(((Map<String, Object>) service.check(anaU, always.getSlug(), req).get("points"))).containsEntry("total", 15);
    }

    @Test
    void soAsPropriasCartasUmaVezCadaEmVagasDoCenario() {
        FlairChallenge c = challenge("noite", halloween, THREE, "[]", 30);
        FlairCardInstance mine = card(ana, "CAL", "black", "edgy", 30, 5);
        FlairCardInstance hers = card(bia, "SUP", "black", "edgy", 30, 5);

        assertThatThrownBy(() -> service.check(anaU, c.getSlug(), build(null, "rua", mine, "festa", hers))).isInstanceOf(ApiException.class)
                .satisfies(t -> assertThat(((ApiException) t).status()).isEqualTo(404));
        assertThatThrownBy(() -> service.check(anaU, c.getSlug(), build(null, "rua", mine, "festa", mine)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("CARTA_REPETIDA"));
        assertThatThrownBy(() -> service.check(anaU, c.getSlug(), build(null, "camarote", mine)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("VAGA_DESCONHECIDA"));
    }

    @Test
    void redescobertaRendeBonusESemComprasOlhaODiaDeEntrada() {
        FlairChallenge c = challenge("halloween-sem-compras", halloween, THREE, "[{\"type\":\"noBuy\"}]", 40);
        FlairCardInstance rua = card(ana, "CAL", "black", "edgy", 300, 90);       // parada há 90 dias
        FlairCardInstance festa = card(ana, "SUP", "black", "edgy", 300, 5);
        FlairCardInstance nova = card(ana, "INF", "black", "edgy", 2, null);      // entrou depois do início do Halloween

        assertThatThrownBy(() -> service.submit(anaU, c.getSlug(), build(null, "rua", rua, "festa", festa, "pista", nova)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("MONTAGEM_INCOMPLETA"));
        // comprada antes de entrar no app: vale a data da compra (C2 olha a compra, não o cadastro)
        WardrobeItem w = kit.dep(WardrobeItemRepository.class).findById(nova.getOriginId()).orElseThrow();
        w.setPurchaseDate(LocalDate.of(2024, 5, 1));
        service.submit(anaU, c.getSlug(), build(null, "rua", rua, "festa", festa, "pista", nova));
        verify(points).award(ana.getId(), "FLAIR_CBC_REDISCOVERY", "FLAIR_CHALLENGE", c.getId().toString(), 10);
        verify(points).award(ana.getId(), "FLAIR_CBC", "FLAIR_CHALLENGE", c.getId().toString(), 60);
    }

    // ------------------------------------------------------------------ comunidade e memória (I1, I2)
    @Test
    @SuppressWarnings("unchecked")
    void comunidadeSoDepoisDeSeExpressarECartasPrivadasFicamOcultas() {
        FlairChallenge c = challenge("noite", halloween, THREE, "[]", 30);
        FlairCardInstance b1 = card(bia, "CAL", "orange", "basic", 30, 5);
        FlairCardInstance b2 = card(bia, "SUP", "black", "edgy", 30, 5);
        FlairCardInstance b3 = card(bia, "INF", "black", "edgy", 30, 5);
        service.submit(biaU, c.getSlug(), build("orange-black", "rua", b1, "festa", b2, "pista", b3));
        when(collection.visible(any(), eq(b1))).thenReturn(false);                 // peça privada da Bia

        Map<String, Object> before = service.detail(anaU, c.getSlug());
        assertThat(before).containsEntry("communityOpen", false);
        assertThat((List<?>) before.get("community")).isEmpty();
        assertThat(((Map<String, Object>) before.get("memory"))).containsEntry("builds", 1).containsEntry("readings", null);

        FlairCardInstance a1 = card(ana, "CAL", "black", "grunge", 30, 5);
        FlairCardInstance a2 = card(ana, "SUP", "black", "grunge", 30, 5);
        FlairCardInstance a3 = card(ana, "INF", "black", "grunge", 30, 5);
        service.submit(anaU, c.getSlug(), build("dark", "rua", a1, "festa", a2, "pista", a3));

        Map<String, Object> after = service.detail(anaU, c.getSlug());
        assertThat(after).containsEntry("communityOpen", true);
        List<Map<String, Object>> community = (List<Map<String, Object>>) after.get("community");
        assertThat(community).hasSize(1);
        Map<String, Object> hers = community.get(0);
        assertThat(hers.get("user")).isNull();                                        // perfil privado: sem nome
        assertThat(hers.get("points")).isNull();
        List<Map<String, Object>> cards = (List<Map<String, Object>>) hers.get("cards");
        assertThat(cards.get(0)).containsEntry("hidden", true).doesNotContainKey("name").doesNotContainKey("imageUrl");
        assertThat(cards.get(1)).containsEntry("name", b2.getName());
        assertThat((List<Map<String, Object>>) hers.get("story")).anySatisfy(l -> assertThat(l).containsEntry("key", "cbc.story.hidden_card"));
        // I2: a variedade de leituras, com "rara" para as pouco usadas
        List<Map<String, Object>> readings = (List<Map<String, Object>>) ((Map<String, Object>) after.get("memory")).get("readings");
        assertThat(readings).extracting(r -> r.get("key")).containsExactlyInAnyOrder("dark", "orange-black");
        assertThat(readings).allSatisfy(r -> assertThat(r.get("pct")).isEqualTo(50));

        bia.setProfileVisibility(Visibility.PUBLIC);
        assertThat(((List<Map<String, Object>>) service.detail(anaU, c.getSlug()).get("community")).get(0).get("user"))
                .isEqualTo(Map.of("id", bia.getId(), "username", "bia"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void grupoCompletoDaPontosEInsigniaUmaVez() {
        FlairChallengeGroup g = new FlairChallengeGroup();
        g.setCode("lenda-do-estilo");
        g.setName("Lenda do estilo");
        g.setPoints(150);
        g.setBadgeCode("CBC_LENDA_DO_ESTILO");
        kit.save(FlairChallengeGroupRepository.class, g);
        FlairChallenge paris = challenge("viagem-a-paris", null, THREE, "[]", 30);
        FlairChallenge gala = challenge("noite-de-gala", null, THREE, "[]", 50);
        paris.setGroupCode(g.getCode());
        gala.setGroupCode(g.getCode());

        Map<String, Object> first = service.submit(anaU, paris.getSlug(), build(null, "rua", card(ana, "CAL", "black", "edgy", 30, 5),
                "festa", card(ana, "SUP", "black", "edgy", 30, 5), "pista", card(ana, "INF", "black", "edgy", 30, 5)));
        assertThat((Map<String, Object>) first.get("group")).containsEntry("completed", false).containsEntry("done", 1).containsEntry("total", 2);
        Map<String, Object> second = service.submit(anaU, gala.getSlug(), build(null, "rua", card(ana, "CAL", "black", "edgy", 30, 5),
                "festa", card(ana, "SUP", "black", "edgy", 30, 5), "pista", card(ana, "INF", "black", "edgy", 30, 5)));

        assertThat((Map<String, Object>) second.get("group")).containsEntry("completed", true);
        verify(points).award(ana.getId(), "FLAIR_CBC_GROUP", "FLAIR_CHALLENGE_GROUP", "group:lenda-do-estilo", 150);
        assertThat(kit.dep(UserAchievementRepository.class).existsByUserIdAndAchievementCode(ana.getId(), "CBC_LENDA_DO_ESTILO")).isTrue();
        assertThat((Integer) ((Map<String, Object>) second.get("points")).get("total")).isEqualTo(200);
    }

    // ------------------------------------------------------------------ administração (R1, P2, A1)
    @Test
    void administracaoValidaAsRegrasDoLivro() {
        CurrentUser admin = Kit.admin(kit.save(UserRepository.class, Kit.user("adm")));
        Moment natal = moment("festas-2026", MomentNature.RELIGIOUS, "2026-12-15T03:00:00Z", "2026-12-26T03:00:00Z", READINGS);
        Moment semLeituras = moment("verao-2027", MomentNature.SEASONAL, "2026-12-21T03:00:00Z", "2027-03-21T03:00:00Z", null);
        List<Map<String, Object>> slots = List.of(Map.of("key", "rua", "position", "CAL"), Map.of("key", "festa", "position", "SUP"),
                Map.of("key", "pista", "position", "INF"));

        assertThatThrownBy(() -> service.adminSave(admin, null, req("ceia", "festas-2026", slots, List.of())))
                .satisfies(t -> assertThat(code(t)).isEqualTo("DESAFIO_EM_MOMENTO_RELIGIOSO"));            // R1
        assertThatThrownBy(() -> service.adminSave(admin, null, req("praia", "verao-2027", slots, List.of(Map.of("type", "theme", "count", 2)))))
                .satisfies(t -> assertThat(code(t)).isEqualTo("TEMA_SEM_LEITURAS"));                       // P2
        List<Map<String, Object>> gold = List.of(Map.of("type", "tier", "min", "OURO", "count", 2));
        assertThatThrownBy(() -> service.adminSave(admin, null, req("gala-de-halloween", "halloween-2026", slots, gold)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("MOMENTO_SEM_DESAFIO_ABERTO"));              // A1
        service.adminSave(admin, null, req("noite-aberta", "halloween-2026", slots, List.of(Map.of("type", "theme", "count", 2))));
        assertThat(service.adminSave(admin, null, req("gala-de-halloween", "halloween-2026", slots, gold))).containsEntry("levelOpen", false);
        assertThatThrownBy(() -> service.adminSave(admin, null, req("x", null, slots, List.of(Map.of("type", "fantasia")))))
                .satisfies(t -> assertThat(code(t)).isEqualTo("DESAFIO_INVALIDO"));
        assertThat(natal.getId()).isNotNull();
        assertThat(semLeituras.getId()).isNotNull();
    }

    static FlairChallengeService.AdminChallengeRequest req(String slug, String moment, List<Map<String, Object>> slots, List<Map<String, Object>> reqs) {
        return new FlairChallengeService.AdminChallengeRequest(slug, slug, null, null, null, "halloween", "MEDIUM", "ACTIVE", moment, null, null,
                slots, reqs, null, 20, 1, null, true, 10);
    }

    // ------------------------------------------------------------------ Momento privado de grupo
    @Test
    void momentoPrivadoDoGrupoUsaModeloSemConsumirCartas() {
        Moment privado = moment("halloween-turma-si", MomentNature.PRIVATE, "2026-10-24T03:00:00Z", "2026-11-01T03:00:00Z", null);
        privado.setGroupId(UUID.randomUUID());
        privado.setVisibility(MomentVisibility.GROUP);
        privado.setCreatedByUserId(ana.getId());
        FlairChallenge modelo = challenge("loja-pop-up", null, THREE, "[{\"type\":\"theme\",\"count\":2},{\"type\":\"sintonia\",\"min\":4}]", 45);

        Map<String, Object> out = service.addToPrivateMoment(anaU, privado.getId(), new FlairChallengeService.PrivateChallengeRequest(modelo.getSlug()));

        FlairChallenge copy = kit.dep(FlairChallengeRepository.class).findBySlug(String.valueOf(out.get("slug"))).orElseThrow();
        assertThat(copy.getMomentId()).isEqualTo(privado.getId());
        assertThat(copy.getPoints()).isEqualTo(15);
        assertThat(copy.isLocksCards()).isFalse();
        assertThat(copy.isOfficial()).isFalse();
        assertThat(copy.getRequirementsJson()).doesNotContain("theme").contains("sintonia");     // sem leituras no Momento, sem tema (P2)
        assertThatThrownBy(() -> service.addToPrivateMoment(biaU, privado.getId(), new FlairChallengeService.PrivateChallengeRequest(modelo.getSlug())))
                .isInstanceOf(ApiException.class);
        service.addToPrivateMoment(anaU, privado.getId(), new FlairChallengeService.PrivateChallengeRequest(modelo.getSlug()));
        service.addToPrivateMoment(anaU, privado.getId(), new FlairChallengeService.PrivateChallengeRequest(modelo.getSlug()));
        assertThatThrownBy(() -> service.addToPrivateMoment(anaU, privado.getId(), new FlairChallengeService.PrivateChallengeRequest(modelo.getSlug())))
                .satisfies(t -> assertThat(code(t)).isEqualTo("LIMITE_DE_DESAFIOS"));
    }
}
