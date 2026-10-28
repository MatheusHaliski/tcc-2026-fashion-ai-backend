package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.application.testkit.MemoryRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MomentService: Momentos de grupo FLAIR, administração (salvar/transições) e o job de status/Memória. */
class MomentServiceGrupoAdminTest extends MomentServiceFixture {

    private static String code(Throwable e) {
        return ((ApiException) e).code();
    }

    private static MomentService.GroupMomentRequest req(String name, String start, String end, String visibility, String mode, Integer goal, UUID base) {
        return new MomentService.GroupMomentRequest(name, " Desc ", "terror", start, end, "America/Sao_Paulo", visibility, mode, null, null, null,
                null, null, null, null, List.of(200, -5, 50, 10), goal, null, null, null, "sem regras", base);
    }

    private CurrentUser admin() {
        return Kit.admin(w.person("root", 0));
    }

    private static MomentService.AdminMomentRequest adminReq(String slug, String name, String type, String start, String end, String sourceUrl,
                                                             String sponsor, String nature, List<MomentService.AdminChallengeRequest> cs) {
        return new MomentService.AdminMomentRequest(slug, name, Map.of("en", "Name"), "desc", Map.of("en", "d"), type, nature, null, start, end,
                "America/Sao_Paulo", "country", "public", "br", " ", "pt-BR", "summer", Map.of("icon", "x"), "", "http://b", true, null, sponsor,
                sourceUrl, null, true, 500, 9.0, Map.of("rule", 1), List.of("glam"), List.of("gala"), List.of("gold"),
                List.of(Map.of("key", "k")), List.of("dress"), List.of("heels"), Map.of("text", "r"), Map.of("looksPerUser", 2), "moment x!", cs);
    }

    // ------------------------------------------------------------------ grupo
    @Test
    void criarMomentoDeGrupoAvisaMembrosEJaColocaOCriadorDentro() {
        FlairTeam t = team("Turma", w.me, w.rival, w.friend);

        Map<String, Object> out = svc.createGroupMoment(me, t.getId(), req("Noite de Terror", "2026-10-24T10:00", "2026-10-30", "public", null, null, null));

        Moment m = MemoryRepository.<Moment>rows(moments).get(0);
        assertThat(m.getVisibility()).isEqualTo(MomentVisibility.GROUP);
        assertThat(m.getType()).isEqualTo(MomentType.PRIVATE_GROUP);
        assertThat(m.getStatus()).isEqualTo(MomentStatus.ACTIVE);
        assertThat(m.getFlairMode()).isEqualTo(FlairMomentMode.MOMENT);
        assertThat(m.getCooperativeGoal()).isNull();
        assertThat(m.getSlug()).startsWith("noite-de-terror-t5-");
        assertThat(m.getDescription()).isEqualTo("Desc");
        assertThat(Json.map(m.getThemeJson())).containsEntry("accent", "#123456");
        Map<String, Object> settings = Json.map(m.getSettingsJson());
        assertThat(settings.get("prizes")).isEqualTo(List.of(150, 0, 50));
        assertThat(settings.get("looksPerUser")).isEqualTo(1);
        assertThat(out.get("isCreator")).isEqualTo(true);
        assertThat(allParts()).singleElement().extracting(MomentParticipation::getUserId).isEqualTo(w.me.getId());
        verify(notifications, times(2)).notify(any(), eq(w.me.getId()), eq(NotificationType.MOMENT_GROUP_CREATED), eq("MOMENT"), eq(m.getId()), any(), any(), any());
    }

    @Test
    void criarMomentoCooperativoBaseadoEmOutroHerdaTagsETema() {
        FlairTeam t = team("Coop", w.me);
        t.setColor(null);
        Moment base = active("base");
        base.setThemeJson("{\"icon\":\"🎃\"}");
        base.setInterpretationsJson("[{\"key\":\"dark\"}]");
        moments.save(base);

        svc.createGroupMoment(me, t.getId(), req("Coop", "2026-11-01T10:00:00Z", "2026-11-05T10:00:00Z", "friends", "cooperative", 0, base.getId()));

        Moment m = MemoryRepository.<Moment>rows(moments).stream().filter(x -> x.getGroupId() != null).findFirst().orElseThrow();
        assertThat(m.getType()).isEqualTo(MomentType.FLAIR_EVENT);
        assertThat(m.getStatus()).isEqualTo(MomentStatus.SCHEDULED);
        assertThat(m.getVisibility()).isEqualTo(MomentVisibility.FRIENDS);
        assertThat(m.getCooperativeGoal()).isEqualTo(10);
        assertThat(m.getStyleTags()).isEqualTo("streetwear,basic");
        assertThat(m.getThemeJson()).contains("🎃");
        assertThat(m.getInterpretationsJson()).contains("dark");
    }

    @Test
    void criarMomentoDeGrupoValida() {
        FlairTeam t = team("V", w.me);
        FlairTeam alheio = team("Alheio", w.rival);
        assertThatThrownBy(() -> svc.createGroupMoment(me, UUID.randomUUID(), null)).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> svc.createGroupMoment(me, alheio.getId(), null)).extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), null)).extracting(MomentServiceGrupoAdminTest::code).isEqualTo("NOME_OBRIGATORIO");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req(" ", "2026-11-01", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("NOME_OBRIGATORIO");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req("X", "2026-11-03", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("PERIODO_INVALIDO");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req("X", "2026-01-01", "2026-01-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("PERIODO_INVALIDO");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req("X", null, "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("DATA_OBRIGATORIA");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req("X", "amanhã", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("DATA_INVALIDA");
        assertThatThrownBy(() -> svc.createGroupMoment(me, t.getId(), req("X", "2026-11-01", "2026-11-02", "nada", null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("VALOR_INVALIDO");
    }

    @Test
    void lerDataComOffsetHoraDeParedeOuSoData() {
        ZoneId sp = ZoneId.of("America/Sao_Paulo");
        assertThat(MomentService.parseInstant("2026-11-09T18:30:00Z", "x", sp)).isEqualTo(java.time.Instant.parse("2026-11-09T18:30:00Z"));
        assertThat(MomentService.parseInstant(" 2026-11-09T18:30 ", "x", sp)).isEqualTo(java.time.Instant.parse("2026-11-09T21:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09", "x", sp)).isEqualTo(java.time.Instant.parse("2026-11-09T03:00:00Z"));
        assertThatThrownBy(() -> MomentService.parseInstant(" ", "x", sp)).isInstanceOf(ApiException.class);
    }

    @Test
    void slugRepetidoGanhaSufixoENomeLongoEhCortado() {
        String s1 = svc.slugFor("Ação É Já", null);
        assertThat(s1).startsWith("acao-e-ja-g-");
        Moment m = active(s1);
        String s2 = svc.slugFor("Ação É Já", null);
        assertThat(s2).isEqualTo("acao-e-ja-1");
        assertThat(svc.slugFor("a".repeat(60), "XY")).startsWith("a".repeat(40) + "-xy-");
        assertThat(m.getId()).isNotNull();
    }

    @Test
    void calendarioDoGrupoSeparaProximosAtivosEHistorico() {
        FlairTeam t = team("Cal", w.me);
        Moment ativo = groupMoment("ativo", t);
        Moment proximo = groupMoment("proximo", t);
        proximo.setStartAt(NOW.plus(Duration.ofDays(3)));
        proximo.setEndAt(NOW.plus(Duration.ofDays(4)));
        proximo.setStatus(MomentStatus.SCHEDULED);
        Moment rascunho = groupMoment("rascunho", t);
        rascunho.setStatus(MomentStatus.DRAFT);
        Moment passado = groupMoment("passado", t);
        passado.setEndAt(NOW.minus(Duration.ofHours(1)));
        passado.setStatus(MomentStatus.ENDED);
        passado.setMemoryJson("{\"looks\":1}");
        Moment cancelado = groupMoment("cancelado", t);
        cancelado.setStatus(MomentStatus.CANCELLED);
        part(ativo, w.me, MomentParticipationStatus.JOINED);

        Map<String, Object> out = svc.groupMoments(me, t.getId());

        assertThat(list(out.get("upcoming"))).extracting(c -> c.get("slug")).containsExactlyInAnyOrder("proximo", "rascunho");
        assertThat(list(out.get("active"))).extracting(c -> c.get("slug")).containsExactly("ativo");
        assertThat(list(out.get("history"))).extracting(c -> c.get("slug")).containsExactly("passado");
        assertThat(map(list(out.get("history")).get(0).get("memory"))).containsEntry("looks", 1);
        assertThat(out.get("members")).isEqualTo(1L);
        assertThat(out.get("activeCount")).isEqualTo(1L);
        assertThat(out.get("upcomingCount")).isEqualTo(1L);
        assertThat(map(list(out.get("active")).get(0).get("me"))).containsEntry("status", "JOINED");
    }

    @Test
    void calendarioDoGrupoSoParaMembrosOuAdmin() {
        FlairTeam t = team("Fechado", w.rival);
        assertThatThrownBy(() -> svc.groupMoments(me, t.getId())).extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        assertThatThrownBy(() -> svc.groupMoments(me, UUID.randomUUID())).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThat(svc.groupMoments(admin(), t.getId()).get("name")).isEqualTo("Fechado");
    }

    // ------------------------------------------------------------------ administração
    @Test
    void adminCriaMomentoOficialComDesafiosEDepoisEditaDesativandoOsQueSairam() {
        CurrentUser adm = admin();
        List<MomentService.AdminChallengeRequest> cs = List.of(
                new MomentService.AdminChallengeRequest("rediscover me", "Redescobrir", Map.of("en", "R"), "d", "rediscovery", 500,
                        List.of("glam"), List.of("gold"), List.of("gala"), Map.of("idleDays", 30), null),
                new MomentService.AdminChallengeRequest("style", null, null, null, null, null, null, null, null, null, false),
                new MomentService.AdminChallengeRequest(" ", null, null, null, null, null, null, null, null, null, null));

        Map<String, Object> out = svc.adminSave(adm, null, adminReq("Gala 2026!", " Gala ", "seasonal", "2026-11-01", "2026-11-05", null, null, "cultural", cs));

        Moment m = MemoryRepository.<Moment>rows(moments).get(0);
        assertThat(m.isOfficial()).isTrue();
        assertThat(m.getStatus()).isEqualTo(MomentStatus.DRAFT);
        assertThat(m.getSlug()).isEqualTo("gala-2026-");
        assertThat(m.getName()).isEqualTo("Gala");
        assertThat(m.getCountry()).isEqualTo("BR");
        assertThat(m.getRegion()).isNull();
        assertThat(m.getSeason()).isEqualTo(Season.SUMMER);
        assertThat(m.getCoverUrl()).isNull();
        assertThat(m.getBasePoints()).isEqualTo(100);
        assertThat(m.getPointsMultiplier()).isEqualByComparingTo(BigDecimal.valueOf(3.0));
        assertThat(m.getBadgeCode()).isEqualTo("MOMENT_X_");
        assertThat(list(out.get("challenges"))).hasSize(2);
        List<MomentChallenge> saved = MemoryRepository.rows(challenges);
        assertThat(saved).extracting(MomentChallenge::getCode).containsExactly("REDISCOVER_ME", "STYLE");
        assertThat(saved.get(0).getPoints()).isEqualTo(100);
        assertThat(saved.get(0).getKind()).isEqualTo(MomentChallengeKind.REDISCOVERY);
        assertThat(saved.get(1).getName()).isEqualTo("STYLE");
        assertThat(saved.get(1).getPoints()).isEqualTo(15);
        assertThat(saved.get(1).isActive()).isFalse();

        svc.adminSave(adm, m.getId(), adminReq(null, null, null, null, null, null, null, null,
                List.of(new MomentService.AdminChallengeRequest("STYLE", "Estilo", null, null, null, 20, null, null, null, null, true))));
        assertThat(saved.get(0).isActive()).isFalse();
        assertThat(saved.get(1).isActive()).isTrue();
        assertThat(saved.get(1).getPoints()).isEqualTo(20);
        verify(guard, times(4)).requireAdmin(adm);
    }

    @Test
    void adminValidaNomeSlugPeriodoMarcaEFonte() {
        CurrentUser adm = admin();
        assertThatThrownBy(() -> svc.adminSave(adm, null, adminReq(null, null, null, "2026-11-01", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("NOME_OBRIGATORIO");
        assertThatThrownBy(() -> svc.adminSave(adm, null, adminReq(null, "N", null, null, null, null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("PERIODO_INVALIDO");
        active("usado");
        assertThatThrownBy(() -> svc.adminSave(adm, null, adminReq("USADO", "N", null, "2026-11-01", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("SLUG_EM_USO");
        assertThatThrownBy(() -> svc.adminSave(adm, null, adminReq(null, "N", "brand_event", "2026-11-01", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("PATROCINADOR_OBRIGATORIO");
        assertThatThrownBy(() -> svc.adminSave(adm, null, adminReq(null, "N", "fashion_event", "2026-11-01", "2026-11-02", null, null, null, null)))
                .extracting(MomentServiceGrupoAdminTest::code).isEqualTo("FONTE_OBRIGATORIA");
        assertThatThrownBy(() -> svc.adminSave(adm, UUID.randomUUID(), adminReq(null, "N", null, null, null, null, null, null, null)))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        svc.adminSave(adm, null, adminReq(null, "Marca", "brand_event", "2026-11-01", "2026-11-02", null, "Acme", "religious", null));
        Moment marca = MemoryRepository.<Moment>rows(moments).stream().filter(x -> "Marca".equals(x.getName())).findFirst().orElseThrow();
        assertThat(marca.isSponsored()).isTrue();
        assertThat(marca.isPointsEnabled()).isFalse();
        assertThat(marca.getSlug()).startsWith("marca-fai-");
        svc.adminSave(adm, null, adminReq(null, "Evento", "event", "2026-11-01", "2026-11-02", "http://fonte", null, null, null));
        assertThat(MemoryRepository.<Moment>rows(moments)).extracting(Moment::getName).contains("Evento");
    }

    @Test
    void adminListaSoOficiaisEDetalha() {
        CurrentUser adm = admin();
        Moment oficial = active("oficial");
        challenge(oficial, "C");
        groupMoment("grupo", team("G", w.me));
        List<Map<String, Object>> lista = svc.adminList(adm);
        assertThat(lista).extracting(c -> c.get("slug")).containsExactly("oficial");
        assertThat(lista.get(0).get("challenges")).isEqualTo(1);
        Map<String, Object> d = svc.adminDetail(adm, oficial.getId());
        assertThat(d.get("storedStatus")).isEqualTo("ACTIVE");
        assertThat(list(d.get("challenges"))).hasSize(1);
        assertThatThrownBy(() -> svc.adminDetail(adm, UUID.randomUUID())).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void adminTransicoes() {
        CurrentUser adm = admin();
        Moment m = moment("t", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.DRAFT);
        svc.adminTransition(adm, m.getId(), "SCHEDULE");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.SCHEDULED);
        svc.adminTransition(adm, m.getId(), "feature");
        assertThat(m.isFeatured()).isTrue();
        svc.adminTransition(adm, m.getId(), "unfeature");
        assertThat(m.isFeatured()).isFalse();
        svc.adminTransition(adm, m.getId(), "cancel");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.CANCELLED);
        svc.adminTransition(adm, m.getId(), "archive");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.ARCHIVED);
        svc.adminTransition(adm, m.getId(), "draft");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.DRAFT);
        svc.adminTransition(adm, m.getId(), "end");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(m.getMemoryJson()).isNotNull();
        assertThatThrownBy(() -> svc.adminTransition(adm, m.getId(), null)).extracting(MomentServiceGrupoAdminTest::code).isEqualTo("ACAO_INVALIDA");
        assertThatThrownBy(() -> svc.adminTransition(adm, UUID.randomUUID(), "end")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);

        Moment velho = moment("velho", NOW.minus(Duration.ofDays(3)), NOW.minus(Duration.ofDays(1)), MomentStatus.DRAFT);
        svc.adminTransition(adm, velho.getId(), "schedule");
        assertThat(velho.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(velho.getMemoryJson()).isNotNull();
    }

    // ------------------------------------------------------------------ job
    @Test
    void tickIniciaEncerraLembraEAvisaPrazo() {
        Moment comecou = moment("comecou", NOW.minus(Duration.ofHours(1)), NOW.plus(Duration.ofDays(1)), MomentStatus.SCHEDULED);
        Moment acabou = moment("acabou", NOW.minus(Duration.ofDays(3)), NOW.minus(Duration.ofHours(1)), MomentStatus.ACTIVE);
        Moment semana = moment("semana", NOW.plus(Duration.ofDays(3)), NOW.plus(Duration.ofDays(6)), MomentStatus.SCHEDULED);
        MomentParticipation lembrar = part(semana, w.me, MomentParticipationStatus.INTERESTED);
        lembrar.setRemind(true);
        MomentParticipation jaLembrado = part(semana, w.rival, MomentParticipationStatus.INTERESTED);
        jaLembrado.setRemind(true);
        jaLembrado.setRemindSent(true);
        MomentParticipation prazo = part(comecou, w.me, MomentParticipationStatus.JOINED);
        MomentParticipation jaAvisado = part(comecou, w.rival, MomentParticipationStatus.JOINED);
        jaAvisado.setDeadlineNotified(true);

        Map<String, Integer> out = svc.tick();

        assertThat(out).containsEntry("started", 1).containsEntry("ended", 1).containsEntry("reminded", 1).containsEntry("deadlines", 1);
        assertThat(comecou.getStatus()).isEqualTo(MomentStatus.ACTIVE);
        assertThat(acabou.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(lembrar.isRemindSent()).isTrue();
        assertThat(prazo.isDeadlineNotified()).isTrue();
        verify(notifications).notify(eq(w.me.getId()), any(), eq(NotificationType.MOMENT_STARTING), any(), eq(semana.getId()), any(), any(), any());
        verify(notifications).notify(eq(w.me.getId()), any(), eq(NotificationType.MOMENT_DEADLINE), any(), eq(comecou.getId()), any(), any(), any());
    }

    @Test
    void encerrarMomentoCompetitivoDaRankingPremiosEMemoria() {
        Moment m = active("final");
        m.setSettingsJson("{\"prizes\":[100,50,0]}");
        moments.save(m);
        var pa = part(m, w.me, MomentParticipationStatus.COMPLETED);
        var pb = part(m, w.rival, MomentParticipationStatus.SUBMITTED);
        var pc = part(m, w.friend, MomentParticipationStatus.SUBMITTED);
        MomentSubmission a = submission(m, w.me, w.looksOf(w.me).get(0), 5, 80);
        submission(m, w.me, w.looksOf(w.me).get(1), 1, 99);
        MomentSubmission b = submission(m, w.rival, w.looksOf(w.rival).get(0), 3, 70);
        MomentSubmission b2 = submission(m, w.rival, w.looksOf(w.rival).get(1), 3, 90);
        MomentSubmission c = submission(m, w.friend, w.looksOf(w.friend).get(0), 1, null);
        var privado = w.looksOf(w.friend).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        submission(m, w.friend, privado, 9, 99);
        var semDono = w.person("zeca", 1);
        submission(m, semDono, w.looksOf(semDono).get(0), 0, 10);
        vote(m, a, w.rival, MomentVoteDimension.CREATIVE);
        vote(m, a, w.friend, MomentVoteDimension.CREATIVE);
        vote(m, b2, w.me, MomentVoteDimension.ELEGANT);

        svc.end(m);

        assertThat(m.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(pa.getRanking()).isEqualTo(1);
        assertThat(pb.getRanking()).isEqualTo(2);
        assertThat(pc.getRanking()).isEqualTo(3);
        assertThat(pa.getPercentile()).isEqualTo(25);
        assertThat(pa.getPointsEarned()).isEqualTo(10);
        verify(points).award(eq(w.me.getId()), eq("MOMENT_PRIZE"), eq("MOMENT"), eq(m.getId() + ":prize"), eq(100));
        verify(points).award(eq(w.rival.getId()), eq("MOMENT_PRIZE"), eq("MOMENT"), eq(m.getId() + ":prize"), eq(50));
        Map<String, Object> memory = Json.map(m.getMemoryJson());
        assertThat(map(memory.get("winner"))).containsEntry("submissionId", a.getId().toString());
        assertThat(map(memory.get("mostCreative"))).containsEntry("submissionId", a.getId().toString());
        assertThat(map(memory.get("mostElegant"))).containsEntry("submissionId", b2.getId().toString());
        assertThat(memory.get("mostTrend")).isNull();
        assertThat(memory.get("looks")).isEqualTo(7);
        assertThat(memory.get("goalReached")).isEqualTo(false);
        assertThat(b.getId()).isNotNull();
        assertThat(c.getId()).isNotNull();
    }

    @Test
    void encerrarMomentoCooperativoPagaMetaAEngajados() {
        FlairTeam t = team("Coop", w.me, w.rival);
        Moment m = groupMoment("coop", t);
        m.setFlairMode(FlairMomentMode.COOPERATIVE);
        m.setCooperativeGoal(1);
        m.setSettingsJson("{\"coopPoints\":500}");
        moments.save(m);
        var dentro = part(m, w.me, MomentParticipationStatus.SUBMITTED);
        part(m, w.rival, MomentParticipationStatus.INTERESTED);
        submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);

        svc.end(m);

        Map<String, Object> memory = Json.map(m.getMemoryJson());
        assertThat(memory.get("goalReached")).isEqualTo(true);
        assertThat(memory.get("winner")).isNull();
        assertThat(dentro.getRanking()).isNull();
        assertThat(dentro.getPointsEarned()).isEqualTo(10);
        verify(points).award(eq(w.me.getId()), eq("MOMENT_COOP_GOAL"), eq("MOMENT"), eq(m.getId() + ":coop"), eq(150));
        verify(points, never()).award(eq(w.rival.getId()), anyString(), anyString(), anyString(), any());
    }

    @Test
    void encerrarSemPontosNaoPagaPremioNemMeta() {
        Moment m = active("sem");
        m.setPointsEnabled(false);
        m.setFlairMode(FlairMomentMode.COOPERATIVE);
        m.setCooperativeGoal(0);
        moments.save(m);
        when(points.award(any(), anyString(), anyString(), anyString(), any())).thenReturn(new FaiPointsService.Award(false, 0, false, null, null, false));
        submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);
        svc.end(m);
        assertThat(Json.map(m.getMemoryJson())).containsEntry("goalReached", true);
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void lookDaMemoriaSoMostraAutorEmMomentoPublicoOuDeGrupo() {
        Moment m = active("mem");
        MomentSubmission s = submission(m, w.me, w.looksOf(w.me).get(0), 1, 10);
        assertThat(svc.memoryLook(s, m).get("user")).isNotNull();
        m.setVisibility(MomentVisibility.INVITE_ONLY);
        assertThat(svc.memoryLook(s, m)).containsKey("title").containsEntry("user", null);
        s.setSchemeId(UUID.randomUUID());
        assertThat(svc.memoryLook(s, m)).doesNotContainKey("title");
    }

    @Test
    void naturezaSensivelNaoCompeteNoEncerramento() {
        Moment m = active("religioso");
        m.setNature(MomentNature.RELIGIOUS);
        moments.save(m);
        var p = part(m, w.me, MomentParticipationStatus.SUBMITTED);
        submission(m, w.me, w.looksOf(w.me).get(0), 1, 10);
        svc.end(m);
        assertThat(p.getRanking()).isNull();
        assertThat(Json.map(m.getMemoryJson())).containsEntry("winner", null);
    }
}
