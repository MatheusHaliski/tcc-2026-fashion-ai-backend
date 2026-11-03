package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.AtelierRewardGrant;
import br.com.fashionai.domain.model.AtelierRewardGrant.Category;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * FLAIR-UT F5 · §14 — comunidade só depois de a pessoa se expressar (I1–I2), grupo "Lenda do estilo", capítulo do
 * Atelier para carta reutilizada, validações da administração (R1, P2, A1) e o desafio do Momento privado de grupo.
 * Separado de {@code FlairChallengeServiceTest} no lote R82, sem mudar nenhuma asserção.
 */
class FlairChallengeServiceCommunityTest extends FlairChallengeServiceFixture {
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
        // Atelier: o grupo concluído vira um Troféu habitável (cartas novas em cada desafio: nenhum capítulo de memória)
        assertThat(kit.atelierGrants()).singleElement().satisfies(r -> {
            assertThat(r.getCategory()).isEqualTo(Category.habitableTrofeus);
            assertThat(r.getRewardCode()).isEqualTo("CBC_GROUP");
            assertThat(r.getSourceType()).isEqualTo("SEASON");
            assertThat(r.getSourceReference()).isEqualTo("cbc-group:lenda-do-estilo");
        });
    }

    @Test
    void cartaReutilizadaEmOutroDesafioGanhaCapituloNaMemoriaDaPeca() {
        FlairChallenge paris = challenge("viagem-a-paris", null, THREE, "[]", 30);
        FlairChallenge gala = challenge("noite-de-gala", null, THREE, "[]", 50);
        paris.setLocksCards(false);
        gala.setLocksCards(false);
        FlairCardInstance rua = card(ana, "CAL", "black", "edgy", 30, 5);
        FlairCardInstance festa = card(ana, "SUP", "black", "edgy", 30, 5);
        service.submit(anaU, paris.getSlug(), build(null, "rua", rua, "festa", festa, "pista", card(ana, "INF", "black", "edgy", 30, 5)));
        assertThat(kit.atelierGrants()).isEmpty();   // a primeira participação ainda não é reutilização

        service.submit(anaU, gala.getSlug(), build(null, "rua", rua, "festa", festa, "pista", card(ana, "INF", "black", "edgy", 30, 5)));
        List<AtelierRewardGrant> chapters = kit.atelierGrants();
        assertThat(chapters).extracting(AtelierRewardGrant::getReferenceId)
                .containsExactlyInAnyOrder(rua.getOriginId().toString(), festa.getOriginId().toString());
        assertThat(chapters).allSatisfy(r -> {
            assertThat(r.getOwnerId()).isEqualTo(ana.getId());
            assertThat(r.getCategory()).isEqualTo(Category.garmentMemory);
            assertThat(r.getSourceReference()).startsWith("challenge:" + gala.getId() + ":card:");
        });
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
