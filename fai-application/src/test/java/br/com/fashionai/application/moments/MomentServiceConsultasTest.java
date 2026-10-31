package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MomentService: home, banner, calendário, detalhe, rascunho/grupo visíveis e natureza competitiva. */
class MomentServiceConsultasTest extends MomentServiceFixture {
    @Test
    void homeSeparaAtivosEProximosEMostraResumoEGrupo() {
        Moment ativo = active("ativo");
        Moment destaque = active("destaque");
        destaque.setFeatured(true);
        moments.save(destaque);
        Moment breve = moment("breve", NOW.plus(Duration.ofDays(5)), NOW.plus(Duration.ofDays(8)), MomentStatus.SCHEDULED);
        moment("longe", NOW.plus(Duration.ofDays(90)), NOW.plus(Duration.ofDays(95)), MomentStatus.SCHEDULED);
        Moment outroPais = active("outro-pais");
        outroPais.setScope(MomentScope.COUNTRY);
        outroPais.setCountry("US");
        moments.save(outroPais);
        part(ativo, w.me, MomentParticipationStatus.JOINED);
        team("Time", w.me);

        Map<String, Object> home = svc.home(me);

        assertThat(list(home.get("active"))).extracting(c -> c.get("slug")).containsExactly("destaque", "ativo");
        assertThat(list(home.get("upcoming"))).extracting(c -> c.get("slug")).containsExactly("breve");
        assertThat(map(home.get("featured")).get("slug")).isEqualTo("destaque");
        assertThat(home.get("country")).isEqualTo("BR");
        assertThat(map(list(home.get("active")).get(1).get("me")).get("status")).isEqualTo("JOINED");
        assertThat(map(home.get("mine")).get("participated")).isEqualTo(1L);
        assertThat(map(home.get("group")).get("name")).isEqualTo("Time");
        assertThat(breve.getId()).isNotNull();
    }

    @Test
    void homeAnonimaSemDestaqueUsaOPrimeiroAtivoEMarcaRegional() {
        Moment regional = active("regional");
        regional.setScope(MomentScope.COUNTRY);
        regional.setCountry("BR");
        moments.save(regional);

        Map<String, Object> home = svc.home(null);

        assertThat(home).doesNotContainKey("mine");
        assertThat(map(home.get("featured")).get("slug")).isEqualTo("regional");
        assertThat(list(home.get("active")).get(0).get("regional")).isEqualTo(true);
        assertThat(svc.home(null).get("principle")).isNotNull();
    }

    @Test
    void homeSemMomentosNaoTemDestaque() {
        Map<String, Object> home = svc.home(me);
        assertThat(home.get("featured")).isNull();
        assertThat(home.get("group")).isNull();
    }

    @Test
    void bannerEscolheODestaqueAtivoPublicoEIncluiMinhaParticipacao() {
        Moment comum = active("comum");
        Moment destaque = active("destaque");
        destaque.setFeatured(true);
        moments.save(destaque);
        part(destaque, w.me, MomentParticipationStatus.INTERESTED);

        Map<String, Object> out = svc.nowBanner(me);
        assertThat(map(out.get("moment")).get("slug")).isEqualTo("destaque");
        assertThat(map(map(out.get("moment")).get("me")).get("status")).isEqualTo("INTERESTED");

        Map<String, Object> anon = svc.nowBanner(null);
        assertThat(map(anon.get("moment"))).doesNotContainKey("me");
        assertThat(comum.getId()).isNotNull();
    }

    @Test
    void bannerSemMomentoAtivoDevolveNulo() {
        moment("futuro", NOW.plus(Duration.ofDays(2)), NOW.plus(Duration.ofDays(4)), MomentStatus.SCHEDULED);
        assertThat(svc.nowBanner(me).get("moment")).isNull();
    }

    @Test
    void calendarioDoAnoTemDozeMesesEODoMesSoUm() {
        active("outubro");
        Moment regional = moment("dezembro", java.time.Instant.parse("2026-12-20T12:00:00Z"), java.time.Instant.parse("2026-12-26T12:00:00Z"), MomentStatus.SCHEDULED);
        regional.setScope(MomentScope.COUNTRY);
        regional.setCountry("BR");
        moments.save(regional);

        Map<String, Object> ano = svc.calendar(null, 2026, null, "America/Sao_Paulo");
        assertThat(list(ano.get("months"))).hasSize(12);
        Map<String, Object> dez = list(ano.get("months")).get(11);
        assertThat(list(dez.get("items"))).extracting(c -> c.get("slug")).containsExactly("dezembro");
        assertThat(list(dez.get("items")).get(0).get("regional")).isEqualTo(true);

        Map<String, Object> mes = svc.calendar(me, 2026, 10, null);
        assertThat(list(mes.get("months"))).hasSize(1);
        assertThat(list(list(mes.get("months")).get(0).get("items"))).extracting(c -> c.get("slug")).containsExactly("outubro");
        assertThat(mes.get("timezone")).isEqualTo("America/Sao_Paulo");
    }

    @Test
    void detalhePublicoTrazEstatisticasDesafiosEMinhaParticipacao() {
        Moment m = active("detalhe");
        m.setCooperativeGoal(4);
        m.setFlairMode(FlairMomentMode.COOPERATIVE);
        moments.save(m);
        challenge(m, "C1");
        var inativo = challenge(m, "C2");
        inativo.setActive(false);
        challenges.save(inativo);
        part(m, w.me, MomentParticipationStatus.SUBMITTED);
        Scheme look = w.looksOf(w.me).get(0);
        submission(m, w.me, look, 2, 70);

        Map<String, Object> d = svc.detail(me, "DETALHE");

        assertThat(list(d.get("challenges"))).hasSize(1);
        assertThat(map(d.get("stats")).get("participants")).isEqualTo(1L);
        assertThat(map(d.get("stats")).get("looks")).isEqualTo(1L);
        assertThat(map(d.get("stats")).get("goalFraction")).isEqualTo(0.25);
        assertThat(d.get("cooperative")).isEqualTo(true);
        assertThat(d.get("competitive")).isEqualTo(false);
        assertThat(d.get("isMember")).isEqualTo(false);
        assertThat(map(d.get("me")).get("status")).isEqualTo("SUBMITTED");
        assertThat(list(d.get("mySubmissions"))).hasSize(1);
        assertThat(map(d.get("settings")).get("allowVoting")).isEqualTo(true);
        assertThat(d).doesNotContainKey("memory");
    }

    @Test
    void detalheDeGrupoParaMembroMostraGrupoEParticipantesEMemoriaQuandoTerminou() {
        FlairTeam t = team("Equipe", w.me, w.friend);
        Moment m = groupMoment("grupo", t);
        m.setEndAt(NOW.minus(Duration.ofHours(1)));
        m.setStatus(MomentStatus.ENDED);
        m.setMemoryJson("{\"looks\":3}");
        moments.save(m);
        part(m, w.friend, MomentParticipationStatus.JOINED);

        Map<String, Object> d = svc.detail(me, m.getId().toString());

        assertThat(d.get("isMember")).isEqualTo(true);
        assertThat(map(d.get("group")).get("name")).isEqualTo("Equipe");
        assertThat(list(d.get("participants"))).hasSize(1);
        assertThat(map(d.get("memory")).get("looks")).isEqualTo(3);
    }

    @Test
    void detalheDeGrupoParaAnonimoEhNegado() {
        Moment m = groupMoment("secreto", team("Fechado", w.friend));
        assertThatThrownBy(() -> svc.detail(null, "secreto")).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        assertThatThrownBy(() -> svc.detail(me, "secreto")).isInstanceOf(ApiException.class);
        assertThat(svc.detail(Kit_admin(), "secreto").get("isMember")).isEqualTo(true);
        assertThat(m.getId()).isNotNull();
    }

    private br.com.fashionai.application.security.CurrentUser Kit_admin() {
        return br.com.fashionai.application.testkit.Kit.admin(w.person("root", 0));
    }

    @Test
    void momentoInexistenteDa404() {
        assertThatThrownBy(() -> svc.detail(me, "nao-existe")).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        assertThatThrownBy(() -> svc.detail(me, UUID.randomUUID().toString())).isInstanceOf(ApiException.class);
    }

    @Test
    void rascunhoSoParaCriadorOuAdmin() {
        Moment m = active("rascunho");
        m.setStatus(MomentStatus.DRAFT);
        m.setCreatedByUserId(w.me.getId());
        moments.save(m);
        assertThat(svc.canSee(me, m)).isTrue();
        assertThat(svc.canSee(rival, m)).isFalse();
        assertThat(svc.canSee(null, m)).isFalse();
        m.setStatus(MomentStatus.CANCELLED);
        assertThat(svc.canSee(Kit_admin(), m)).isTrue();
    }

    @Test
    void canSeeMomentoPrivadoParaCriadorENaoParaEstranho() {
        Moment m = active("privado");
        m.setVisibility(MomentVisibility.PRIVATE);
        m.setCreatedByUserId(w.me.getId());
        assertThat(svc.canSee(me, m)).isTrue();
        assertThat(svc.canSee(rival, m)).isFalse();
        assertThat(svc.canSee(null, m)).isFalse();
    }

    @Test
    void competitivoDependeDaNaturezaDoModoEDaConfiguracao() {
        Moment m = active("comp");
        assertThat(svc.competitive(m)).isTrue();
        m.setSettingsJson("{\"allowVoting\":false}");
        assertThat(svc.competitive(m)).isFalse();
        m.setFlairMode(FlairMomentMode.BATTLE);
        assertThat(svc.competitive(m)).isTrue();
        m.setNature(MomentNature.RELIGIOUS);
        assertThat(svc.competitive(m)).isFalse();
    }
}
