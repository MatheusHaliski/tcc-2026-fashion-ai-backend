package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * FLAIR-UT F5 · §14 — Desafios de Montagem dentro dos Momentos: entrega atômica com cartas bloqueadas como memória (D7),
 * janela do Momento e Memória (E1–E2), pontos determinísticos com multiplicador e redescoberta (S3, C3). Comunidade,
 * grupo, Atelier, administração e Momento privado em {@link FlairChallengeServiceCommunityTest} (R82).
 */
class FlairChallengeServiceTest extends FlairChallengeServiceFixture {
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
}
