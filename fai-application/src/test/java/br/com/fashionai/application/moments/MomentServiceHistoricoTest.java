package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MomentService: Meus Momentos, linha do tempo, Replay, contexto/Hype contextual, resumo do Copilot e listas (separado de MomentServiceConsultasTest por tema). */
class MomentServiceHistoricoTest extends MomentServiceFixture {
    @Test
    void meusMomentosSeparaSalvosAtivosEConcluidosComBadges() {
        Moment salvo = active("salvo");
        Moment emCurso = active("em-curso");
        Moment saiu = active("saiu");
        Moment acabou = moment("acabou", NOW.minus(Duration.ofDays(5)), NOW.minus(Duration.ofDays(1)), MomentStatus.ENDED);
        part(salvo, w.me, MomentParticipationStatus.INTERESTED);
        part(emCurso, w.me, MomentParticipationStatus.JOINED);
        part(saiu, w.me, MomentParticipationStatus.LEFT);
        MomentParticipation fim = part(acabou, w.me, MomentParticipationStatus.COMPLETED);
        fim.setPointsEarned(30);
        parts.save(fim);
        MomentParticipation orfa = new MomentParticipation();
        orfa.setMomentId(UUID.randomUUID());
        orfa.setUserId(w.me.getId());
        parts.save(orfa);
        UserAchievement a = new UserAchievement();
        a.setUserId(w.me.getId());
        a.setAchievementCode("MOMENT_HALLOWEEN");
        a.setGrantedAt(NOW);
        kit.save(UserAchievementRepository.class, a);
        UserAchievement outra = new UserAchievement();
        outra.setUserId(w.me.getId());
        outra.setAchievementCode("FIRST_LOOK");
        outra.setGrantedAt(NOW);
        kit.save(UserAchievementRepository.class, outra);

        Map<String, Object> out = svc.mine(me);

        assertThat(list(out.get("saved"))).extracting(c -> c.get("slug")).containsExactly("salvo");
        assertThat(list(out.get("active"))).extracting(c -> c.get("slug")).containsExactly("em-curso");
        assertThat(list(out.get("completed"))).extracting(c -> c.get("slug")).containsExactly("acabou");
        assertThat(list(out.get("badges"))).extracting(b -> b.get("code")).containsExactly("MOMENT_HALLOWEEN");
        Map<String, Object> summary = map(out.get("summary"));
        assertThat(summary.get("saved")).isEqualTo(2L);
        assertThat(summary.get("completed")).isEqualTo(1L);
        assertThat(summary.get("points")).isEqualTo(30);
    }

    @Test
    void linhaDoTempoDoDonoMostraTudoComPontos() {
        Moment publico = active("publico");
        Moment privado = active("privado");
        privado.setVisibility(MomentVisibility.PRIVATE);
        moments.save(privado);
        MomentParticipation vencedor = part(publico, w.me, MomentParticipationStatus.COMPLETED);
        vencedor.setRanking(1);
        parts.save(vencedor);
        MomentParticipation oculto = part(privado, w.me, MomentParticipationStatus.JOINED);
        oculto.setPublicOnProfile(false);
        parts.save(oculto);
        part(active("interesse"), w.me, MomentParticipationStatus.INTERESTED);

        Map<String, Object> out = svc.timeline(me, w.me.getId());

        assertThat(out.get("visible")).isEqualTo(true);
        List<Map<String, Object>> anos = list(out.get("years"));
        assertThat(anos).hasSize(1);
        List<Map<String, Object>> itens = list(anos.get(0).get("items"));
        assertThat(itens).hasSize(2);
        assertThat(itens).allSatisfy(i -> assertThat(i).containsKey("pointsEarned"));
        assertThat(itens).extracting(i -> i.get("outcome")).contains("WINNER", "PARTICIPATED");
    }

    @Test
    void linhaDoTempoDeOutraPessoaSoMostraParticipacoesPublicasEmMomentosPublicos() {
        w.me.setProfileVisibility(Visibility.PUBLIC);
        Moment publico = active("publico");
        Moment privado = active("privado");
        privado.setVisibility(MomentVisibility.PRIVATE);
        moments.save(privado);
        part(publico, w.me, MomentParticipationStatus.SUBMITTED);
        part(privado, w.me, MomentParticipationStatus.JOINED);

        Map<String, Object> out = svc.timeline(rival, w.me.getId());

        List<Map<String, Object>> itens = list(list(out.get("years")).get(0).get("items"));
        assertThat(itens).extracting(i -> i.get("slug")).containsExactly("publico");
        assertThat(itens.get(0)).doesNotContainKey("pointsEarned");
    }

    @Test
    void linhaDoTempoDePerfilPrivadoFicaInvisivel() {
        w.me.setProfileVisibility(null);
        Map<String, Object> out = svc.timeline(rival, w.me.getId());
        assertThat(out.get("visible")).isEqualTo(false);
        assertThatThrownBy(() -> svc.timeline(rival, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void desfechoDaParticipacao() {
        MomentParticipation p = new MomentParticipation();
        assertThat(MomentService.outcome(p)).isEqualTo("PARTICIPATED");
        p.setStatus(MomentParticipationStatus.COMPLETED);
        assertThat(MomentService.outcome(p)).isEqualTo("COMPLETED");
        p.setRanking(2);
        p.setPercentile(10);
        assertThat(MomentService.outcome(p)).isEqualTo("TOP_10");
        p.setPercentile(50);
        assertThat(MomentService.outcome(p)).isEqualTo("COMPLETED");
        p.setRanking(1);
        assertThat(MomentService.outcome(p)).isEqualTo("WINNER");
    }

    @Test
    void replayDoAnoContaMomentosLooksEstilosEPicoDeHype() {
        Moment m = active("replay");
        m.setNamesJson("{\"pt-BR\":\"Replay BR\"}");
        moments.save(m);
        MomentParticipation p = part(m, w.me, MomentParticipationStatus.COMPLETED);
        p.setPointsEarned(50);
        parts.save(p);
        MomentParticipation antiga = part(active("antigo"), w.me, MomentParticipationStatus.JOINED);
        antiga.setJoinedAt(java.time.Instant.parse("2020-01-01T00:00:00Z"));
        parts.save(antiga);
        Scheme look = w.looksOf(w.me).get(0);
        MomentSubmission s = submission(m, w.me, look, 1, 80);
        s.setMatchJson("{\"reasons\":[\"style:streetwear,basic\",\"color:white\"]}");
        subs.save(s);
        MomentSubmission semHype = submission(m, w.me, w.looksOf(w.me).get(1), 0, 50);
        semHype.setHypeAtSubmission(null);
        subs.save(semHype);

        Map<String, Object> out = svc.replay(me, 2026);

        assertThat(out.get("moments")).isEqualTo(1);
        assertThat(out.get("completed")).isEqualTo(1L);
        assertThat(out.get("looks")).isEqualTo(2);
        assertThat(out.get("stylesTried")).isEqualTo(2);
        assertThat(out.get("rediscoveredPieces")).isEqualTo(2);
        assertThat(out.get("points")).isEqualTo(50);
        assertThat(out.get("bestMonth")).isEqualTo(10);
        assertThat(out.get("favoriteMoment")).isEqualTo("Replay BR");
        assertThat(map(out.get("peakHype")).get("hype")).isEqualTo(41);
        assertThat(map(out.get("peakHype")).get("moment")).isEqualTo("Replay BR");
    }

    @Test
    void replayDeAnoVazio() {
        Map<String, Object> out = svc.replay(me, 2019);
        assertThat(out.get("bestMonth")).isNull();
        assertThat(out.get("favoriteMoment")).isNull();
        assertThat(out.get("peakHype")).isNull();
    }

    @Test
    void contextoDeUmaPecaNosMomentosAtivos() {
        active("ativo");
        moment("futuro", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.SCHEDULED);
        WardrobeItem peca = w.piece(w.me, "hoodie");

        Map<String, Object> out = svc.contextFor(me, HypeEntityType.PIECE, peca.getId());

        assertThat(out.get("type")).isEqualTo("PIECE");
        assertThat(out.get("globalHype")).isNull();
        assertThat(list(out.get("moments"))).hasSize(1);
        assertThat(list(out.get("moments")).get(0).get("match")).isNotNull();
        assertThat(list(out.get("moments")).get(0).get("contextualHype")).isNull();
    }

    @Test
    void contextoDeUmLookComHypeCalculaHypeContextual() {
        active("ativo");
        Scheme look = w.looksOf(w.me).get(0);
        hypeOf(look.getId(), w.me.getId(), 60, false);

        Map<String, Object> out = svc.contextFor(me, HypeEntityType.SCHEME, look.getId());

        assertThat(out.get("globalHype")).isEqualTo(60L);
        assertThat(list(out.get("moments")).get(0).get("contextualHype")).isNotNull();
    }

    @Test
    void contextoDeLookPrivadoDeOutraPessoaEhNegadoEInexistenteDa404() {
        Scheme look = w.looksOf(w.rival).get(0);
        look.setVisibility(Visibility.PRIVATE);
        assertThatThrownBy(() -> svc.contextFor(me, HypeEntityType.SCHEME, look.getId())).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        assertThatThrownBy(() -> svc.contextFor(me, HypeEntityType.PIECE, UUID.randomUUID())).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> svc.contextFor(me, HypeEntityType.SCHEME, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void hypeContextualLimitadoEntreZeroECem() {
        assertThat(MomentService.contextualHype(null, 50)).isNull();
        assertThat(MomentService.contextualHype(50.0, null)).isNull();
        assertThat(MomentService.contextualHype(50.0, 70)).isEqualTo(60);
        assertThat(MomentService.contextualHype(99.0, 100)).isEqualTo(100);
        assertThat(MomentService.contextualHype(2.0, 0)).isZero();
    }

    @Test
    void hypeDeOutroSoQuandoElegivelEDoDonoSempre() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        hypeOf(a, w.me.getId(), 10, false);
        hypeOf(b, w.rival.getId(), 20, true);
        hypeOf(c, w.rival.getId(), 30, false);
        hypeRows.get(c).setScore(null);
        assertThat(svc.hypeScores(HypeEntityType.SCHEME, List.of(a, b, c), w.me.getId())).containsOnlyKeys(a, b);
        assertThat(svc.hypeScores(HypeEntityType.SCHEME, List.of(a, b), null)).containsOnlyKeys(b);
        assertThat(svc.hypeScores(HypeEntityType.SCHEME, List.of(), null)).isEmpty();
        assertThat(svc.hypeScores(HypeEntityType.SCHEME, null, null)).isEmpty();
        assertThat(svc.hypeScore(HypeEntityType.SCHEME, null, null)).isNull();
        assertThat(MomentService.rounded(null)).isNull();
        assertThat(MomentService.rounded(2.6)).isEqualTo(3);
    }

    @Test
    void resumoAtivoParaOCopilot() {
        Moment m = active("copilot");
        m.setPointsMultiplier(null);
        moments.save(m);
        moment("futuro", NOW.plus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(2)), MomentStatus.SCHEDULED);

        List<Map<String, Object>> out = svc.activeSummary(w.me.getId());
        assertThat(out).hasSize(1);
        assertThat(out.get(0).get("pointsMultiplier")).isEqualTo(1.0);
        assertThat(out.get(0).get("styleTags")).isEqualTo(List.of("streetwear", "basic"));
        assertThat(svc.activeSummary(null)).hasSize(1);
        assertThat(svc.activeSummary(UUID.randomUUID())).hasSize(1);
    }

    @Test
    void listaPublicaFiltraPorStatusEAno() {
        active("ativo");
        moment("velho", java.time.Instant.parse("2024-03-01T12:00:00Z"), java.time.Instant.parse("2024-03-05T12:00:00Z"), MomentStatus.ENDED);

        assertThat(list(svc.list(me, null, null).get("items"))).hasSize(2);
        assertThat(list(svc.list(me, "ended", null).get("items"))).extracting(c -> c.get("slug")).containsExactly("velho");
        assertThat(list(svc.list(null, null, 2026).get("items"))).extracting(c -> c.get("slug")).containsExactly("ativo");
        assertThatThrownBy(() -> svc.list(me, "xyz", null)).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo("VALOR_INVALIDO");
    }

    @Test
    void looksCandidatosMarcamOsJaEnviados() {
        Moment m = active("cand");
        Scheme enviado = w.looksOf(w.me).get(0);
        submission(m, w.me, enviado, 0, 10);
        List<Map<String, Object>> out = svc.candidateLooks(me, "cand");
        assertThat(out).hasSize(6);
        assertThat(out).filteredOn(v -> Boolean.TRUE.equals(v.get("sent"))).extracting(v -> v.get("id")).containsExactly(enviado.getId());
    }

    @Test
    void escopoPorPais() {
        Moment m = active("pais");
        assertThat(svc.inScope(m, "US")).isTrue();
        m.setScope(MomentScope.REGION);
        m.setCountry("br");
        assertThat(svc.inScope(m, "BR")).isTrue();
        assertThat(svc.inScope(m, "US")).isFalse();
        assertThat(svc.inScope(m, null)).isTrue();
        m.setCountry(null);
        assertThat(svc.inScope(m, "US")).isTrue();
        w.me.setCountry(" ");
        assertThat(svc.countryOf(me)).isNull();
        assertThat(svc.countryOf(null)).isNull();
        kit.dep(UserRepository.class).save(w.me);
    }

    @Test
    void auxiliaresEstaticos() {
        assertThat(MomentService.strings(List.of(1, "a"))).containsExactly("1", "a");
        assertThat(MomentService.strings("x")).isEmpty();
        assertThat(MomentService.nz(null)).isZero();
        assertThat(MomentService.nz(4)).isEqualTo(4);
        assertThat(MomentService.nonNull(null)).isEmpty();
        assertThat(MomentService.nonNull(List.of(1))).containsExactly(1);
        assertThat(MomentService.index(List.of("aa", "b", "cc"), String::length)).containsEntry(2, "aa").containsEntry(1, "b");
        assertThat(MomentService.top(Map.of("a", 3, "b", 5, "c", 1), 2)).extracting(e -> e.get("key")).containsExactly("b", "a");
        assertThat(MomentService.explain(null)).isEmpty();
        assertThat(MomentService.explain(new MomentMatch.Result(50, Map.of(), null, List.of("style:a,b", "solto"))))
                .extracting(e -> e.get("kind")).containsExactly("style", "solto");
    }
}
