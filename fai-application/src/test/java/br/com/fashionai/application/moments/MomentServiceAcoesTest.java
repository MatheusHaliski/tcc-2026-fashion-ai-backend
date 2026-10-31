package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentApproach;
import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MomentService: salvar, participar, sair, enviar look (pontos, badge, conclusão), votar, feed, ranking e em alta. */
class MomentServiceAcoesTest extends MomentServiceFixture {

    private static int code(Throwable e, String expected) {
        assertThat(((ApiException) e).code()).isEqualTo(expected);
        return ((ApiException) e).status();
    }

    // ------------------------------------------------------------------ salvar / participar / sair
    @Test
    void salvarCriaInteresseComLembreteELookPreparado() {
        Moment m = active("salvar");
        Scheme look = w.looksOf(w.me).get(0);

        Map<String, Object> out = svc.save(me, "salvar", true, look.getId());

        MomentParticipation p = allParts().get(0);
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.INTERESTED);
        assertThat(p.isRemind()).isTrue();
        assertThat(p.getPreparedSchemeId()).isEqualTo(look.getId());
        assertThat(map(out.get("me")).get("preparedSchemeId")).isEqualTo(look.getId());
        verify(guard).requireOwner(eq(me), eq(w.me.getId()), anyString());

        svc.save(me, "salvar", null, null);
        assertThat(allParts()).hasSize(1);
        assertThatThrownBy(() -> svc.save(me, "salvar", null, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(m.getId()).isNotNull();
    }

    @Test
    void desalvarApagaInteresseMasSoDesligaLembreteDeQuemParticipa() {
        Moment a = active("a");
        Moment b = active("b");
        part(a, w.me, MomentParticipationStatus.INTERESTED);
        MomentParticipation dentro = part(b, w.me, MomentParticipationStatus.JOINED);
        dentro.setRemind(true);

        assertThat(svc.unsave(me, "a")).containsEntry("ok", true);
        assertThat(svc.unsave(me, "b")).containsEntry("ok", true);
        assertThat(svc.unsave(rival, "b")).containsEntry("ok", true);

        assertThat(allParts()).containsExactly(dentro);
        assertThat(dentro.isRemind()).isFalse();
    }

    @Test
    void participarPelaPrimeiraVezContaParticipanteEGuardaAbordagem() {
        Moment m = moment("futuro", NOW.plus(Duration.ofDays(2)), NOW.plus(Duration.ofDays(5)), MomentStatus.SCHEDULED);

        Map<String, Object> out = svc.join(me, "futuro", new MomentService.JoinRequest("discovery", true));

        MomentParticipation p = allParts().get(0);
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.JOINED);
        assertThat(p.getApproach()).isEqualTo(MomentApproach.DISCOVERY);
        assertThat(p.isWardrobeOnly()).isTrue();
        assertThat(p.getJoinedAt()).isEqualTo(NOW);
        assertThat(m.getParticipantCount()).isEqualTo(1);
        assertThat((String) out.get("message")).contains("Começa em");

        svc.leave(me, "futuro");
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.LEFT);
        assertThat(p.getLeftAt()).isEqualTo(NOW);
        Map<String, Object> again = svc.join(me, "futuro", new MomentService.JoinRequest(null, null));
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.JOINED);
        assertThat(p.getJoinCount()).isEqualTo(2);
        assertThat(p.getLeftAt()).isNull();
        assertThat(m.getParticipantCount()).isEqualTo(1);
        assertThat(again.get("nextSteps")).isEqualTo(List.of("CREATE_LOOK", "USE_WARDROBE", "ASK_COPILOT", "SEE_COMMUNITY"));
    }

    @Test
    void participarDeMomentoAtivoEValidacoes() {
        active("ativo");
        assertThat((String) svc.join(me, "ativo", null).get("message")).doesNotContain("Começa em");
        assertThatThrownBy(() -> svc.join(rival, "ativo", new MomentService.JoinRequest("??", null)))
                .satisfies(e -> assertThat(code(e, "VALOR_INVALIDO")).isEqualTo(400));
        moment("velho", NOW.minus(Duration.ofDays(5)), NOW.minus(Duration.ofDays(1)), MomentStatus.ENDED);
        assertThatThrownBy(() -> svc.join(me, "velho", null)).satisfies(e -> assertThat(code(e, "MOMENTO_ENCERRADO")).isEqualTo(409));
    }

    @Test
    void participarDeGrupoSemSerMembroEhNegadoMesmoParaQuemVe() {
        FlairTeam t = team("G", w.friend);
        Moment m = groupMoment("grp", t);
        assertThatThrownBy(() -> svc.join(Kit.admin(w.person("root", 0)), "grp", null)).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        m.setCreatedByUserId(w.me.getId());
        moments.save(m);
        svc.join(me, "grp", null);
        assertThat(allParts()).hasSize(1);
    }

    @Test
    void sairSemParticipacaoDa404EConcluidoNaoSai() {
        Moment m = active("sair");
        assertThatThrownBy(() -> svc.leave(me, "sair")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        part(m, w.me, MomentParticipationStatus.COMPLETED);
        assertThatThrownBy(() -> svc.leave(me, "sair")).satisfies(e -> assertThat(code(e, "MOMENTO_CONCLUIDO")).isEqualTo(409));
    }

    @Test
    void visibilidadeNoPerfil() {
        Moment m = active("perfil");
        MomentParticipation p = part(m, w.me, MomentParticipationStatus.JOINED);
        assertThat(map(svc.setProfileVisibility(me, "perfil", false).get("me")).get("publicOnProfile")).isEqualTo(false);
        assertThat(p.isPublicOnProfile()).isFalse();
        assertThatThrownBy(() -> svc.setProfileVisibility(rival, "perfil", true)).isInstanceOf(ApiException.class);
    }

    @Test
    void desafioDeMontagemContaComoParticipacao() {
        Moment m = active("card");
        svc.recordCardChallenge(m, w.me.getId());
        svc.recordCardChallenge(m, w.me.getId());
        assertThat(allParts()).singleElement().satisfies(p -> {
            assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.JOINED);
            assertThat(p.getJoinedAt()).isEqualTo(NOW);
        });
        assertThat(m.getParticipantCount()).isEqualTo(1);
        MomentParticipation saiu = part(m, w.rival, MomentParticipationStatus.LEFT);
        svc.recordCardChallenge(m, w.rival.getId());
        assertThat(saiu.getStatus()).isEqualTo(MomentParticipationStatus.JOINED);
        assertThat(m.getParticipantCount()).isEqualTo(1);
    }

    // ------------------------------------------------------------------ envio de look
    @Test
    void enviarLookConcluiPagaPontosEConcedeBadge() {
        Moment m = active("halloween");
        m.setBadgeCode("MOMENT_HALLOWEEN");
        m.setType(MomentType.FLAIR_EVENT);
        moments.save(m);
        challenge(m, "STREET");
        Scheme look = w.looksOf(w.me).get(0);

        Map<String, Object> out = svc.submit(me, "halloween", new MomentService.SubmitRequest(look.getId(), null, "minha"));

        assertThat(out.get("completed")).isEqualTo(true);
        assertThat(out.get("badge")).isEqualTo("MOMENT_HALLOWEEN");
        assertThat((Integer) out.get("pointsTotal")).isPositive();
        assertThat(map(out.get("match")).get("score")).isNotNull();
        MomentParticipation p = allParts().get(0);
        assertThat(p.getStatus()).isEqualTo(MomentParticipationStatus.COMPLETED);
        assertThat(p.getCompletedAt()).isEqualTo(NOW);
        assertThat(p.getBestMatch()).isNotNull();
        assertThat(MemoryRepository.<UserAchievement>rows(kit.dep(UserAchievementRepository.class)))
                .extracting(UserAchievement::getAchievementCode).containsExactly("MOMENT_HALLOWEEN");
        verify(points).award(eq(w.me.getId()), eq("MOMENT_FLAIR"), eq("MOMENT"), eq(m.getId().toString()), isNull());
        verify(points).award(eq(w.me.getId()), eq("MOMENT_COMPLETED"), eq("MOMENT"), eq(m.getId().toString()), isNull());
        verify(notifications).notify(eq(w.me.getId()), isNull(), eq(NotificationType.MOMENT_COMPLETED), eq("MOMENT"), eq(m.getId()), any(), any(), any());
        assertThat(MemoryRepository.<MomentSubmission>rows(subs)).singleElement().satisfies(s -> {
            assertThat(s.getSchemeId()).isEqualTo(look.getId());
            assertThat(s.getPointsEarned()).isPositive();
        });

        // mesmo look de novo: conflito; outro look: só SUBMITTED já concluído, sem nova badge
        assertThatThrownBy(() -> svc.submit(me, "halloween", new MomentService.SubmitRequest(look.getId(), null, null)))
                .satisfies(e -> assertThat(code(e, "LOOK_JA_ENVIADO")).isEqualTo(409));
        Map<String, Object> second = svc.submit(me, "halloween", new MomentService.SubmitRequest(w.looksOf(w.me).get(2).getId(), null, null));
        assertThat(second.get("completed")).isEqualTo(false);
        assertThat(second.get("badge")).isNull();
    }

    @Test
    void enviarLookSemRelacaoSoMarcaEnviadoESemPontosQuandoNegados() {
        Moment m = active("azul");
        m.setStyleTags("glam");
        m.setColorTags("purple");
        m.setOccasionTags("gala");
        moments.save(m);
        when(points.award(any(), anyString(), anyString(), anyString(), any())).thenReturn(new FaiPointsService.Award(false, 0, true, null, null, false));
        part(m, w.me, MomentParticipationStatus.JOINED);
        Scheme look = w.looksOf(w.me).get(1);

        Map<String, Object> out = svc.submit(me, "azul", new MomentService.SubmitRequest(look.getId(), null, null));

        assertThat(out.get("completed")).isEqualTo(false);
        assertThat(out.get("pointsTotal")).isEqualTo(0);
        assertThat(allParts().get(0).getStatus()).isEqualTo(MomentParticipationStatus.SUBMITTED);
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void enviarLookEmMomentoSemTagsConclui() {
        Moment m = active("livre");
        m.setStyleTags(null);
        m.setColorTags(null);
        m.setOccasionTags(null);
        m.setNature(MomentNature.RELIGIOUS);
        moments.save(m);
        Map<String, Object> out = svc.submit(me, "livre", new MomentService.SubmitRequest(w.looksOf(w.me).get(0).getId(), null, null));
        assertThat(out.get("match")).isNull();
        assertThat(out.get("completed")).isEqualTo(true);
        verify(points, never()).award(any(), eq("MOMENT_COMPLETED"), anyString(), anyString(), any());
    }

    @Test
    void enviarLookValidaPeriodoLookLimiteEDesafio() {
        moment("futuro", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.SCHEDULED);
        UUID look = w.looksOf(w.me).get(0).getId();
        assertThatThrownBy(() -> svc.submit(me, "futuro", new MomentService.SubmitRequest(look, null, null)))
                .satisfies(e -> assertThat(code(e, "MOMENTO_FORA_DO_PERIODO")).isEqualTo(409));

        Moment m = active("limite");
        m.setSettingsJson("{\"looksPerUser\":1}");
        moments.save(m);
        assertThatThrownBy(() -> svc.submit(me, "limite", new MomentService.SubmitRequest(null, null, null)))
                .satisfies(e -> assertThat(code(e, "LOOK_OBRIGATORIO")).isEqualTo(400));
        assertThatThrownBy(() -> svc.submit(me, "limite", new MomentService.SubmitRequest(look, UUID.randomUUID(), null)))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        svc.submit(me, "limite", new MomentService.SubmitRequest(look, null, null));
        UUID outro = w.looksOf(w.me).get(1).getId();
        assertThatThrownBy(() -> svc.submit(me, "limite", new MomentService.SubmitRequest(outro, null, null)))
                .satisfies(e -> assertThat(code(e, "LIMITE_DE_LOOKS")).isEqualTo(409));

        Scheme vazio = kit.save(SchemeRepository.class, Kit.look(w.me, "Vazio"));
        assertThatThrownBy(() -> svc.submit(me, "limite", new MomentService.SubmitRequest(vazio.getId(), null, null)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void previaCalculaPontosSemGravarEConsideraRedescobertaEHistorico() {
        Moment m = active("previa");
        var redescoberta = challenge(m, "REDESCOBRIR");
        redescoberta.setKind(MomentChallengeKind.REDISCOVERY);
        redescoberta.setParamsJson("{\"idleDays\":1}");
        challenges.save(redescoberta);
        Scheme look = w.looksOf(w.me).get(0);
        Scheme original = w.looksOf(w.rival).get(0);
        original.markCreatedAt(NOW.minus(Duration.ofDays(400)));
        look.setOriginalScheme(original);
        WardrobeItem camiseta = w.piece(w.me, "t_shirt");
        camiseta.setLastWornDate(LocalDate.of(2026, 1, 1));
        PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
        e.setUserId(w.me.getId());
        e.setWardrobeItemId(camiseta.getId());
        e.setUsedOn(LocalDate.of(2025, 6, 1));
        kit.save(PieceUsageDiaryEntryRepository.class, e);
        // um look anterior para existir histórico de estilos
        Scheme anterior = w.looksOf(w.me).get(1);
        anterior.markCreatedAt(NOW.minus(Duration.ofDays(300)));
        anterior.setStyle("classic");
        look.markCreatedAt(NOW.minus(Duration.ofDays(2)));
        look.setStyle("streetwear,grunge");

        Map<String, Object> out = svc.preview(me, "previa", new MomentService.SubmitRequest(look.getId(), redescoberta.getId(), "dark"));

        assertThat(out.get("alreadySubmitted")).isEqualTo(false);
        assertThat(map(out.get("scores")).get("moment")).isNotNull();
        assertThat(map(out.get("scores")).get("rediscovery")).isNotNull();
        assertThat((List<?>) out.get("rediscovered")).isNotEmpty();
        assertThat(String.valueOf(out.get("newStyles"))).contains("grunge");
        assertThat((List<?>) out.get("points")).isNotEmpty();
        assertThat((List<?>) out.get("explanation")).isNotEmpty();
        assertThat(MemoryRepository.<MomentSubmission>rows(subs)).isEmpty();
    }

    // ------------------------------------------------------------------ comunidade
    @Test
    void votarAlternaVotoEAtualizaContagem() {
        Moment m = active("votos");
        MomentSubmission s = submission(m, w.rival, w.looksOf(w.rival).get(0), 0, 50);

        Map<String, Object> first = svc.vote(me, "votos", new MomentService.VoteRequest(s.getId(), "creative"));
        assertThat(first).containsEntry("voted", true).containsEntry("votes", 1).containsEntry("dimension", "CREATIVE");
        assertThat(MemoryRepository.<MomentVote>rows(votes)).hasSize(1);
        Map<String, Object> second = svc.vote(me, "votos", new MomentService.VoteRequest(s.getId(), "CREATIVE"));
        assertThat(second).containsEntry("voted", false).containsEntry("votes", 0);
        assertThat(MemoryRepository.<MomentVote>rows(votes)).isEmpty();
    }

    @Test
    void votoProprioLookPrivadoEDimensaoInvalida() {
        Moment m = active("regras");
        MomentSubmission minha = submission(m, w.me, w.looksOf(w.me).get(0), 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(minha.getId(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "VOTO_PROPRIO")).isEqualTo(409));
        Scheme privado = w.looksOf(w.rival).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        MomentSubmission oculta = submission(m, w.rival, privado, 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(oculta.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        MomentSubmission dela = submission(m, w.rival, w.looksOf(w.rival).get(0), 0, 50);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(dela.getId(), null)))
                .satisfies(e -> assertThat(code(e, "VALOR_INVALIDO")).isEqualTo(400));
        dela.setWithdrawn(true);
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(dela.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        MomentSubmission semLook = submission(m, w.rival, w.looksOf(w.rival).get(2), 0, 50);
        semLook.setSchemeId(UUID.randomUUID());
        assertThatThrownBy(() -> svc.vote(me, "regras", new MomentService.VoteRequest(semLook.getId(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void votoSoEmMomentoCompetitivoAtivoEDeMembro() {
        Moment coop = active("coop");
        coop.setFlairMode(FlairMomentMode.COOPERATIVE);
        moments.save(coop);
        assertThatThrownBy(() -> svc.vote(me, "coop", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "SEM_VOTACAO")).isEqualTo(409));
        moment("depois", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.SCHEDULED);
        assertThatThrownBy(() -> svc.vote(me, "depois", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .satisfies(e -> assertThat(code(e, "MOMENTO_FORA_DO_PERIODO")).isEqualTo(409));
        Moment grupo = groupMoment("grupo", team("Outro", w.friend));
        grupo.setCreatedByUserId(w.me.getId());
        moments.save(grupo);
        assertThatThrownBy(() -> svc.vote(me, "grupo", new MomentService.VoteRequest(UUID.randomUUID(), "CREATIVE")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
    }

    @Test
    void membroDeGrupoVotaEmLookPrivado() {
        FlairTeam t = team("Turma", w.me, w.rival);
        Moment m = groupMoment("turma", t);
        Scheme privado = w.looksOf(w.rival).get(0);
        privado.setVisibility(Visibility.PRIVATE);
        MomentSubmission s = submission(m, w.rival, privado, 0, 50);
        assertThat(svc.vote(me, "turma", new MomentService.VoteRequest(s.getId(), "TREND"))).containsEntry("voted", true);
    }

    @Test
    void feedEscondeLookPrivadoDeOutrosEMarcaMeusVotos() {
        Moment m = active("feed");
        MomentSubmission publica = submission(m, w.rival, w.looksOf(w.rival).get(0), 3, 60);
        Scheme privado = w.looksOf(w.rival).get(1);
        privado.setVisibility(Visibility.PRIVATE);
        submission(m, w.rival, privado, 1, 40);
        MomentSubmission minha = submission(m, w.me, w.looksOf(w.me).get(0), 0, 30);
        MomentSubmission semLook = submission(m, w.friend, w.looksOf(w.friend).get(0), 0, 30);
        semLook.setSchemeId(UUID.randomUUID());
        vote(m, publica, w.me, MomentVoteDimension.CREATIVE);
        hypeOf(publica.getSchemeId(), w.rival.getId(), 70, true);

        Map<String, Object> out = svc.feed(me, "feed");

        List<Map<String, Object>> items = list(out.get("items"));
        assertThat(items).extracting(i -> i.get("id")).containsExactlyInAnyOrder(publica.getId(), minha.getId());
        Map<String, Object> pub = items.stream().filter(i -> i.get("id").equals(publica.getId())).findFirst().orElseThrow();
        assertThat(pub.get("votedByMe")).isEqualTo(true);
        assertThat(pub.get("hype")).isEqualTo(70);
        assertThat(pub.get("contextualHype")).isEqualTo(75);
        assertThat(items.stream().filter(i -> i.get("id").equals(minha.getId())).findFirst().orElseThrow().get("mine")).isEqualTo(true);
        assertThat((List<?>) out.get("dimensions")).hasSize(MomentVoteDimension.values().length);

        Map<String, Object> anon = svc.feed(null, "feed");
        assertThat(list(anon.get("items"))).hasSize(2);
    }

    @Test
    void rankingCompetitivoOrdenaPorVotosEMatch() {
        Moment m = active("rank");
        MomentSubmission a = submission(m, w.rival, w.looksOf(w.rival).get(0), 5, 50);
        MomentSubmission b = submission(m, w.friend, w.looksOf(w.friend).get(0), 5, 90);
        MomentSubmission c = submission(m, w.me, w.looksOf(w.me).get(0), 1, null);
        vote(m, a, w.me, MomentVoteDimension.ELEGANT);

        Map<String, Object> out = svc.leaderboard(me, "rank");

        List<Map<String, Object>> items = list(out.get("items"));
        assertThat(items).extracting(i -> i.get("submissionId")).containsExactly(b.getId(), a.getId(), c.getId());
        assertThat(items.get(1).get("byDimension")).isEqualTo(Map.of("ELEGANT", 1));
        assertThat(items.get(2).get("you")).isEqualTo(true);
        assertThat(items.get(0).get("user")).isNotNull();
        assertThat(out.get("competitive")).isEqualTo(true);
    }

    @Test
    void rankingAnonimoEmMomentoNaoDescobrivelEsconeOutrosNomes() {
        FlairTeam t = team("Anon", w.me, w.rival);
        Moment m = groupMoment("anon", t);
        submission(m, w.rival, w.looksOf(w.rival).get(0), 2, 50);
        submission(m, w.me, w.looksOf(w.me).get(0), 1, 50);
        List<Map<String, Object>> items = list(svc.leaderboard(me, "anon").get("items"));
        assertThat(items.get(0).get("user")).isNull();
        assertThat(items.get(1).get("user")).isNotNull();
    }

    @Test
    void rankingNaoCompetitivoECooperativo() {
        Moment coop = active("coop");
        coop.setFlairMode(FlairMomentMode.COOPERATIVE);
        coop.setCooperativeGoal(5);
        moments.save(coop);
        submission(coop, w.me, w.looksOf(w.me).get(0), 0, 10);
        Map<String, Object> out = svc.leaderboard(me, "coop");
        assertThat(out.get("competitive")).isEqualTo(false);
        assertThat(map(out.get("cooperative"))).containsEntry("goal", 5).containsEntry("looks", 1L);

        coop.setCooperativeGoal(null);
        assertThat(map(svc.leaderboard(me, "coop").get("cooperative"))).containsEntry("goal", 0);

        Moment calmo = active("calmo");
        calmo.setFlairMode(FlairMomentMode.MOMENT);
        moments.save(calmo);
        assertThat(svc.leaderboard(me, "calmo")).doesNotContainKey("cooperative").containsEntry("competitive", false);
    }

    @Test
    void emAltaContaEstilosCoresInterpretacoesELooks() {
        Moment m = active("alta");
        Scheme la = w.looksOf(w.rival).get(0);
        Scheme lb = w.looksOf(w.friend).get(0);
        submission(m, w.rival, la, 4, 50);
        MomentSubmission semInterp = submission(m, w.friend, lb, 4, 50);
        semInterp.setMatchJson(null);
        hypeOf(lb.getId(), w.friend.getId(), 80, true);

        Map<String, Object> out = svc.trending(me, "alta", 3);

        assertThat(out.get("basis")).isEqualTo(2);
        assertThat(list(out.get("styles"))).extracting(s -> s.get("key")).contains("streetwear");
        assertThat(list(out.get("colors"))).isNotEmpty();
        assertThat(list(out.get("interpretations"))).extracting(s -> s.get("key")).containsExactly("dark");
        assertThat(list(out.get("looks"))).extracting(l -> l.get("schemeId")).containsExactly(lb.getId(), la.getId());
    }

    @Test
    void submissaoSemCacheLeOLookEHypeDoRepositorio() {
        Moment m = active("view");
        Scheme s = w.looksOf(w.me).get(0);
        MomentSubmission sub = submission(m, w.me, s, 0, 60);
        hypeOf(s.getId(), w.me.getId(), 40, false);
        Map<String, Object> v = svc.submissionView(sub, me, Map.of(), false);
        assertThat(v.get("hype")).isEqualTo(40);
        assertThat(v.get("scheme")).isNotNull();
        sub.setSchemeId(UUID.randomUUID());
        assertThat(svc.submissionView(sub, null, Map.of(), false)).doesNotContainKey("scheme").containsEntry("mine", false);
    }

    @Test
    void lookPublicamenteListado() {
        Moment m = active("pl");
        Scheme s = w.looksOf(w.me).get(0);
        assertThat(MomentService.publiclyListed(m, null)).isFalse();
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
        s.setVisibility(Visibility.PRIVATE);
        assertThat(MomentService.publiclyListed(m, s)).isFalse();
        m.setVisibility(MomentVisibility.FRIENDS);
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
        m.setVisibility(MomentVisibility.PUBLIC);
        m.setGroupId(UUID.randomUUID());
        assertThat(MomentService.publiclyListed(m, s)).isTrue();
    }

    @Test
    void badgeNaoDuplica() {
        svc.grantBadge(w.me.getId(), "MOMENT_X");
        svc.grantBadge(w.me.getId(), "MOMENT_X");
        assertThat(MemoryRepository.<UserAchievement>rows(kit.dep(UserAchievementRepository.class))).hasSize(1);
    }

    @Test
    void flairPeloTipoOuPeloGrupo() {
        Moment m = active("flair");
        assertThat(svc.isFlair(m)).isFalse();
        m.setType(MomentType.PRIVATE_GROUP);
        assertThat(svc.isFlair(m)).isTrue();
        m.setType(MomentType.COMMUNITY);
        m.setGroupId(UUID.randomUUID());
        assertThat(svc.isFlair(m)).isTrue();
    }
}
