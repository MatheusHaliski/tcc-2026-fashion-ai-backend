package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Desafios de Montagem: janela de cada desafio, lista por seção, administração (validações e gravação) e apoio. */
class FlairChallengeServiceAdminTest {
    static final Instant NOW = Instant.parse("2026-10-25T15:00:00Z");
    static final String READINGS = "[{\"key\":\"dark\",\"styleTags\":[\"edgy\"],\"colorTags\":[\"black\"]},{\"key\":\"orange\",\"colorTags\":[\"orange\"]}]";
    static final List<Map<String, Object>> SLOTS = List.of(Map.of("key", "rua", "position", "CAL"), Map.of("key", "festa", "position", "SUP"),
            Map.of("key", "pista", "position", "INF"));

    private Kit kit;
    private FlairChallengeService service;
    private MomentService momentService;
    private CurrentUser admin;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        User u = kit.save(UserRepository.class, Kit.user("ana"));
        ana = Kit.as(u);
        admin = Kit.admin(kit.save(UserRepository.class, Kit.user("adm")));
        momentService = kit.dep(MomentService.class);
        lenient().when(momentService.canSee(any(), any())).thenReturn(true);
        lenient().when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> ApiException.forbidden(i.getArgument(2)));
        kit.atelier();
        service = kit.build(FlairChallengeService.class);
        service.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    Moment moment(String slug, MomentNature nature, MomentStatus status, String start, String end, String readings) {
        Moment m = new Moment();
        m.setSlug(slug);
        m.setName(slug);
        m.setType(MomentType.CULTURAL);
        m.setNature(nature);
        m.setStatus(status);
        m.setStartAt(Instant.parse(start));
        m.setEndAt(Instant.parse(end));
        m.setInterpretationsJson(readings);
        return kit.save(MomentRepository.class, m);
    }

    FlairChallenge challenge(String slug, Moment m, FlairChallengeStatus status, String start, String end) {
        FlairChallenge c = new FlairChallenge();
        c.setSlug(slug);
        c.setName(slug);
        c.setScenario("halloween");
        c.setStatus(status);
        c.setMomentId(m == null ? null : m.getId());
        c.setStartAt(start == null ? null : Instant.parse(start));
        c.setEndAt(end == null ? null : Instant.parse(end));
        c.setSlotsJson("[{\"key\":\"rua\",\"position\":\"CAL\"},{\"key\":\"festa\",\"position\":\"SUP\"},{\"key\":\"pista\",\"position\":\"INF\"}]");
        c.setRequirementsJson("[]");
        c.setGroupCode("LENDA");
        return kit.save(FlairChallengeRepository.class, c);
    }

    static FlairChallengeService.AdminChallengeRequest req(String slug, String name, String scenario, String moment, List<Map<String, Object>> slots,
                                                           List<Map<String, Object>> reqs, Integer points, Integer repeat) {
        return new FlairChallengeService.AdminChallengeRequest(slug, name, null, null, null, scenario, null, null, moment, null, null,
                slots, reqs, null, points, repeat, null, null, null);
    }

    @SuppressWarnings("unchecked")
    static List<String> errors(Throwable t) {
        ApiException e = (ApiException) t;
        assertThat(e.code()).isEqualTo("DESAFIO_INVALIDO");
        return (List<String>) e.details().get("errors");
    }

    // ------------------------------------------------------------------ janela
    @Test
    void janelaDeDesafioLigadoAMomento() {
        FlairChallenge c = challenge("c", null, FlairChallengeStatus.ACTIVE, null, null);
        Moment ativo = moment("ativo", MomentNature.CULTURAL, MomentStatus.ACTIVE, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        Moment breve = moment("breve", MomentNature.CULTURAL, MomentStatus.SCHEDULED, "2026-11-20T00:00:00Z", "2026-12-01T00:00:00Z", READINGS);
        Moment fim = moment("fim", MomentNature.CULTURAL, MomentStatus.ENDED, "2026-09-20T00:00:00Z", "2026-10-01T00:00:00Z", READINGS);
        Moment cancelado = moment("cancel", MomentNature.CULTURAL, MomentStatus.CANCELLED, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        assertThat(service.window(c, ativo, NOW).status()).isEqualTo(FlairChallengeService.OPEN);
        assertThat(service.window(c, breve, NOW).status()).isEqualTo(FlairChallengeService.UPCOMING);
        assertThat(service.window(c, fim, NOW).status()).isEqualTo(FlairChallengeService.ENDED);
        assertThat(service.window(c, cancelado, NOW).status()).isEqualTo("HIDDEN");
        c.setStatus(FlairChallengeStatus.ARCHIVED);
        assertThat(service.window(c, ativo, NOW).status()).isEqualTo(FlairChallengeService.ENDED);
        c.setStatus(FlairChallengeStatus.DRAFT);
        assertThat(service.window(c, ativo, NOW).status()).isEqualTo("HIDDEN");
    }

    @Test
    void janelaPropriaSemMomento() {
        FlairChallenge sempre = challenge("sempre", null, FlairChallengeStatus.ACTIVE, null, null);
        var w = service.window(sempre, null, NOW);
        assertThat(w.status()).isEqualTo(FlairChallengeService.OPEN);
        assertThat(w.time()).containsEntry("always", true).containsEntry("daysLeft", null);
        FlairChallenge aberto = challenge("aberto", null, FlairChallengeStatus.ACTIVE, "2026-10-01T00:00:00Z", "2026-10-27T15:00:00Z");
        assertThat(service.window(aberto, null, NOW).time()).containsEntry("daysLeft", 2).containsEntry("endsInSeconds", 172800L);
        FlairChallenge futuro = challenge("futuro", null, FlairChallengeStatus.ACTIVE, "2026-10-26T15:00:00Z", null);
        assertThat(service.window(futuro, null, NOW).time()).containsEntry("status", "UPCOMING").containsEntry("startsInSeconds", 86400L);
        FlairChallenge passado = challenge("passado", null, FlairChallengeStatus.ACTIVE, null, "2026-10-25T15:00:00Z");
        assertThat(service.window(passado, null, NOW).status()).isEqualTo(FlairChallengeService.ENDED);
        FlairChallenge arquivado = challenge("arq", null, FlairChallengeStatus.ARCHIVED, null, null);
        assertThat(service.window(arquivado, null, NOW).status()).isEqualTo(FlairChallengeService.ENDED);
    }

    @Test
    void listaSeparaAgoraEmBreveSempreEMemoriasEEscondeRascunhos() {
        Moment ativo = moment("halloween", MomentNature.CULTURAL, MomentStatus.ACTIVE, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        challenge("no-momento", ativo, FlairChallengeStatus.ACTIVE, null, null);
        challenge("sempre", null, FlairChallengeStatus.ACTIVE, null, null);
        challenge("com-prazo", null, FlairChallengeStatus.ACTIVE, null, "2026-12-01T00:00:00Z");
        challenge("futuro", null, FlairChallengeStatus.ACTIVE, "2026-12-01T00:00:00Z", null);
        challenge("antigo", null, FlairChallengeStatus.ARCHIVED, null, null);
        challenge("rascunho", null, FlairChallengeStatus.DRAFT, null, null);
        FlairChallenge orfao = challenge("orfao", null, FlairChallengeStatus.ACTIVE, null, null);
        orfao.setMomentId(UUID.randomUUID());
        FlairChallengeGroup g = new FlairChallengeGroup();
        g.setCode("LENDA");
        g.setName("Lenda");
        g.setPoints(50);
        g.setBadgeCode("FLAIR_LENDA");
        kit.save(FlairChallengeGroupRepository.class, g);

        Map<String, Object> out = service.list(ana, null);

        assertThat(slugs(out.get("now"))).containsExactlyInAnyOrder("no-momento", "com-prazo");
        assertThat(slugs(out.get("always"))).containsExactly("sempre");
        assertThat(slugs(out.get("upcoming"))).containsExactly("futuro");
        assertThat(slugs(out.get("memories"))).containsExactly("antigo");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> groups = (List<Map<String, Object>>) out.get("groups");
        assertThat(groups).singleElement().satisfies(v -> {
            assertThat(v.get("total")).isEqualTo(6);
            assertThat(v.get("done")).isEqualTo(0);
            assertThat(v.get("completed")).isEqualTo(false);
        });
        assertThat(slugs(service.list(null, "HALLOWEEN").get("now"))).containsExactly("no-momento");
        assertThat(service.list(null, "halloween").get("groups")).isEqualTo(List.of());
        assertThat(slugs(service.list(null, " ").get("always"))).containsExactly("sempre");
        assertThatThrownBy(() -> service.list(ana, "nao-existe")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThat(slugs(service.list(admin, null).get("always"))).containsExactly("sempre");
    }

    @SuppressWarnings("unchecked")
    private static List<Object> slugs(Object rows) {
        return ((List<Map<String, Object>>) rows).stream().map(r -> r.get("slug")).toList();
    }

    @Test
    void detalheEscondeRascunhoOrfaoOuMomentoInvisivel() {
        FlairChallenge rascunho = challenge("rascunho", null, FlairChallengeStatus.DRAFT, null, null);
        assertThatThrownBy(() -> service.detail(ana, "rascunho")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> service.detail(null, rascunho.getId().toString())).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        FlairChallenge orfao = challenge("orfao", null, FlairChallengeStatus.ACTIVE, null, null);
        orfao.setMomentId(UUID.randomUUID());
        assertThatThrownBy(() -> service.detail(ana, "orfao")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> service.detail(ana, UUID.randomUUID().toString())).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        Moment privado = moment("privado", MomentNature.PRIVATE, MomentStatus.ACTIVE, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        challenge("do-grupo", privado, FlairChallengeStatus.ACTIVE, null, null);
        when(momentService.canSee(ana, privado)).thenReturn(false);
        assertThatThrownBy(() -> service.detail(ana, "do-grupo")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    // ------------------------------------------------------------------ administração
    @Test
    void adminListaTodosComCamposDeEdicao() {
        Moment m = moment("halloween", MomentNature.CULTURAL, MomentStatus.ACTIVE, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        challenge("a", m, FlairChallengeStatus.DRAFT, null, null);
        FlairChallenge b = challenge("b", null, FlairChallengeStatus.ACTIVE, null, null);
        b.setThemeTags("dark,edgy");
        List<Map<String, Object>> out = service.adminList(admin);
        assertThat(out).extracting(v -> v.get("adminStatus")).containsExactly("DRAFT", "ACTIVE");
        assertThat(out.get(1).get("themeTags")).isEqualTo(List.of("dark", "edgy"));
        assertThat((List<?>) out.get(0).get("slots")).hasSize(3);
    }

    @Test
    void adminAcumulaErrosDeFormaDeUmaVez() {
        assertThatThrownBy(() -> service.adminSave(admin, null, req(null, null, null, null, null, null, -1, 0)))
                .satisfies(t -> assertThat(errors(t)).containsExactly("slug", "name", "scenario", "slots.count", "points", "repeatLimit"));
        assertThatThrownBy(() -> service.adminSave(admin, null, req("OK slug!", " ", "X", "nao-existe", SLOTS, null, 201, 11)))
                .satisfies(t -> assertThat(errors(t)).containsExactly("slug", "name", "scenario", "points", "repeatLimit", "moment"));
        assertThatThrownBy(() -> service.adminSave(admin, null, req("bom-slug", "x".repeat(121), "halloween", UUID.randomUUID().toString(), SLOTS, null, null, null)))
                .satisfies(t -> assertThat(errors(t)).containsExactly("name", "moment"));
        challenge("tomado", null, FlairChallengeStatus.ACTIVE, null, null);
        assertThatThrownBy(() -> service.adminSave(admin, null, req("tomado", "N", "halloween", null, SLOTS, null, null, null)))
                .satisfies(t -> assertThat(errors(t)).containsExactly("slug.taken"));
        List<Map<String, Object>> livresSemTexto = List.of(Map.of("key", "a", "label", Map.of("pt-BR", "A"), "story", Map.of("pt-BR", "s")),
                Map.of("key", "b", "label", "texto"), Map.of("key", "c"));
        assertThatThrownBy(() -> service.adminSave(admin, null, req("livre-x", "N", "livre", null, livresSemTexto, null, null, null)))
                .satisfies(t -> assertThat(errors(t)).containsExactly("slots.free_texts"));
        assertThatThrownBy(() -> service.adminSave(admin, null, req("tema-x", "N", "halloween", null, SLOTS, List.of(Map.of("type", "theme")), null, null)))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("TEMA_SEM_LEITURAS"));
        assertThatThrownBy(() -> service.adminSave(admin, UUID.randomUUID(), req("x-x-x", "N", "halloween", null, SLOTS, null, null, null)))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> service.adminSave(admin, null, new FlairChallengeService.AdminChallengeRequest("st-x", "N", null, null, null, "halloween",
                "hard", "nada", null, null, null, SLOTS, null, null, null, null, null, null, null)))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("VALOR_INVALIDO"));
    }

    @Test
    void adminGravaDesafioAvulsoComJanelaPropriaETodosOsCampos() {
        List<Map<String, Object>> slots = List.of(Map.of("key", "a", "position", "sup", "accepts", Map.of("tier", "OURO")), new HashMap<>(Map.of("key", "b")),
                Map.of("key", "c", "position", "ANY"));
        var r = new FlairChallengeService.AdminChallengeRequest(" Avulso-1 ", " Avulso ", Map.of("en", "Loose"), "d", Map.of("en", "dd"), "halloween",
                "legendary", "draft", " ", "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z", slots, List.of(Map.of("type", "theme")), List.of("dark"),
                50, 3, "LENDA", false, 7);

        Map<String, Object> out = service.adminSave(admin, null, r);

        FlairChallenge c = MemoryRepository.<FlairChallenge>rows(kit.dep(FlairChallengeRepository.class)).get(0);
        assertThat(c.getSlug()).isEqualTo("avulso-1");
        assertThat(c.getName()).isEqualTo("Avulso");
        assertThat(c.getDifficulty()).isEqualTo(FlairChallengeDifficulty.LEGENDARY);
        assertThat(c.getStatus()).isEqualTo(FlairChallengeStatus.DRAFT);
        assertThat(c.getStartAt()).isEqualTo(Instant.parse("2026-11-01T00:00:00Z"));
        assertThat(c.getNamesJson()).contains("Loose");
        assertThat(c.getThemeTags()).isEqualTo("dark");
        assertThat(c.getRepeatLimit()).isEqualTo(3);
        assertThat(c.isLocksCards()).isFalse();
        assertThat(c.getSortOrder()).isEqualTo(7);
        assertThat(c.getGroupCode()).isEqualTo("LENDA");
        assertThat(c.getCreatedByUserId()).isEqualTo(admin.id());
        assertThat(out.get("slug")).isEqualTo("avulso-1");

        // edição: campos opcionais vazios voltam ao padrão
        var r2 = new FlairChallengeService.AdminChallengeRequest("avulso-1", "Avulso 2", Map.of(), null, Map.of(), "halloween", null, null, null, null, null,
                SLOTS, null, null, null, null, " ", null, null);
        service.adminSave(admin, c.getId(), r2);
        assertThat(c.getNamesJson()).isNull();
        assertThat(c.getDescriptionsJson()).isNull();
        assertThat(c.getDifficulty()).isEqualTo(FlairChallengeDifficulty.EASY);
        assertThat(c.getStatus()).isEqualTo(FlairChallengeStatus.ACTIVE);
        assertThat(c.getGroupCode()).isNull();
        assertThat(c.isLocksCards()).isTrue();
        assertThat(c.getSortOrder()).isEqualTo(7);
        assertThat(c.getStartAt()).isNull();

        assertThatThrownBy(() -> service.adminSave(admin, null, new FlairChallengeService.AdminChallengeRequest("data-x", "N", null, null, null, "halloween",
                null, null, null, "ontem", null, SLOTS, null, null, null, null, null, null, null)))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("DATA_INVALIDA"));
    }

    @Test
    void adminLigaAoMomentoPorIdEExigeDesafioAbertoMesmoNaEdicao() {
        Moment m = moment("halloween", MomentNature.CULTURAL, MomentStatus.ACTIVE, "2026-10-20T00:00:00Z", "2026-11-01T00:00:00Z", READINGS);
        List<Map<String, Object>> gold = List.of(Map.of("type", "tier", "min", "OURO"));
        service.adminSave(admin, null, new FlairChallengeService.AdminChallengeRequest("gala-rascunho", "N", null, null, null,
                "halloween", null, "draft", m.getId().toString(), null, null, SLOTS, gold, null, null, null, null, null, null));
        FlairChallenge rascunho = MemoryRepository.<FlairChallenge>rows(kit.dep(FlairChallengeRepository.class)).get(0);
        assertThat(rascunho.getMomentId()).isEqualTo(m.getId());
        assertThat(rascunho.getStartAt()).isNull();
        assertThatThrownBy(() -> service.adminSave(admin, rascunho.getId(), req("gala-rascunho", "N", "halloween", "halloween", SLOTS, gold, null, null)))
                .satisfies(t -> assertThat(((ApiException) t).code()).isEqualTo("MOMENTO_SEM_DESAFIO_ABERTO"));
    }

    // ------------------------------------------------------------------ apoio
    @Test
    void apoioDeConversao() {
        assertThat(FlairChallengeService.position(null)).isEqualTo("ANY");
        assertThat(FlairChallengeService.position("sup")).isEqualTo("SUP");
        assertThat(FlairChallengeService.uuid(null)).isNull();
        assertThat(FlairChallengeService.uuid("x")).isNull();
        UUID id = UUID.randomUUID();
        assertThat(FlairChallengeService.uuid(id.toString())).isEqualTo(id);
        assertThat(FlairChallengeService.strings(List.of("a", 1))).containsExactly("a", "1");
        assertThat(FlairChallengeService.strings("b")).containsExactly("b");
        assertThat(FlairChallengeService.strings(" ")).isEmpty();
        assertThat(FlairChallengeService.strings(3)).isEmpty();
        assertThat(FlairChallengeService.instant(null, "f")).isNull();
        assertThat(FlairChallengeService.instant(" ", "f")).isNull();
        assertThat(FlairChallengeService.accepts(Map.of("accepts", "x"))).isEmpty();
        assertThat(FlairChallengeService.accepts(Map.of("accepts", Map.of("tier", "OURO")))).containsEntry("tier", "OURO");
    }
}
