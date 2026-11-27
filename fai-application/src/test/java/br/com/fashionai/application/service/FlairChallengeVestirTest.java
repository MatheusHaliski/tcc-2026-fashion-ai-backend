package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * Desafios de Montagem "vestir a cena" (V127): o desafio retirado (DRAFT) some da lista, do detalhe e do seu grupo, mas a
 * entrega antiga continua gravada; no desafio novo, /check diz por vaga se a carta é a roupa do personagem (`accepted`),
 * que é o que faz o front vestir o personagem.
 */
class FlairChallengeVestirTest {
    static final Instant NOW = Instant.parse("2026-11-26T15:00:00Z");
    static final String VAGAS = "[{\"key\":\"creme\",\"position\":\"VES\",\"accepts\":{\"subcategory\":[\"dress\"],\"color\":[\"cream\"]}},"
            + "{\"key\":\"cobre\",\"position\":\"VES\",\"accepts\":{\"subcategory\":[\"dress\"],\"color\":[\"orange\",\"rust\"]}},"
            + "{\"key\":\"noite\",\"position\":\"VES\",\"accepts\":{\"subcategory\":[\"dress\"],\"color\":[\"black\"]}},"
            + "{\"key\":\"petroleo\",\"position\":\"VES\",\"accepts\":{\"subcategory\":[\"dress\"],\"color\":[\"teal\",\"blue\"]}}]";

    private Kit kit;
    private FlairChallengeService service;
    private User ana;
    private CurrentUser anaU;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.save(UserRepository.class, Kit.user("ana"));
        anaU = Kit.as(ana);
        lenient().when(kit.dep(MomentService.class).canSee(any(), any())).thenReturn(true);
        lenient().when(kit.dep(FlairCollectionService.class).visible(any(), any())).thenReturn(true);
        kit.atelier();
        service = kit.build(FlairChallengeService.class);
        service.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    FlairChallenge challenge(String slug, String scenario, String slots, FlairChallengeStatus status, String group) {
        FlairChallenge c = new FlairChallenge();
        c.setSlug(slug);
        c.setName(slug);
        c.setScenario(scenario);
        c.setDifficulty(FlairChallengeDifficulty.MEDIUM);
        c.setStatus(status);
        c.setSlotsJson(slots);
        c.setRequirementsJson("[]");
        c.setPoints(30);
        c.setGroupCode(group);
        return kit.save(FlairChallengeRepository.class, c);
    }

    FlairCardInstance carta(String category, String subcategory, String color) {
        WardrobeItem w = kit.save(WardrobeItemRepository.class, Kit.piece(ana, subcategory + " " + color, category, subcategory, color));
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(ana.getId());
        c.setCreatorId(ana.getId());
        c.setOriginType("PIECE");
        c.setOriginId(w.getId());
        c.setSeason("SPRING");
        c.setTier("PRATA");
        c.setOvr(70);
        c.setPosition("VES");
        c.setName(w.getName());
        c.setCategory(category);
        c.setSubcategory(subcategory);
        c.setTagsJson(Json.write(FlairCollectionService.tagsOf(w)));
        return kit.save(FlairCardInstanceRepository.class, c);
    }

    @Test
    @SuppressWarnings("unchecked")
    void desafioRetiradoSomeDaListaEDoGrupoMasAEntregaFica() {
        FlairChallengeGroup g = new FlairChallengeGroup();
        g.setCode("lenda-do-estilo");
        g.setName("Lenda do estilo");
        kit.save(FlairChallengeGroupRepository.class, g);
        FlairChallenge antigo = challenge("noite-de-gala", "gala", "[{\"key\":\"a\",\"position\":\"ANY\"},{\"key\":\"b\",\"position\":\"ANY\"},{\"key\":\"c\",\"position\":\"ANY\"}]",
                FlairChallengeStatus.DRAFT, g.getCode());
        FlairChallengeSubmission entrega = new FlairChallengeSubmission();
        entrega.setChallengeId(antigo.getId());
        entrega.setUserId(ana.getId());
        entrega.setCardsJson("[]");
        kit.save(FlairChallengeSubmissionRepository.class, entrega);
        challenge("gala-na-piscina", "vestir-piscina", VAGAS, FlairChallengeStatus.ACTIVE, null);

        Map<String, Object> list = service.list(anaU, null);

        assertThat((List<Map<String, Object>>) list.get("always")).extracting(c -> c.get("slug")).containsExactly("gala-na-piscina");
        assertThat((List<Object>) list.get("memories")).isEmpty();
        assertThat((List<Object>) list.get("groups")).isEmpty();
        assertThatThrownBy(() -> service.detail(anaU, "noite-de-gala")).isInstanceOf(ApiException.class)
                .satisfies(t -> assertThat(((ApiException) t).status()).isEqualTo(404));
        assertThat(kit.dep(FlairChallengeSubmissionRepository.class).findById(entrega.getId())).isPresent();
    }

    @Test
    @SuppressWarnings("unchecked")
    void checkAceitaSoARoupaDeCadaPersonagem() {
        challenge("gala-na-piscina", "vestir-piscina", VAGAS, FlairChallengeStatus.ACTIVE, null);
        Map<String, UUID> mesa = new LinkedHashMap<>();
        mesa.put("creme", carta("full_body_piece", "dress", "off_white").getId());
        mesa.put("cobre", carta("upper_piece", "t_shirt", "orange").getId());
        mesa.put("noite", carta("full_body_piece", "dress", "black").getId());
        mesa.put("petroleo", carta("full_body_piece", "dress", "navy").getId());

        Map<String, Object> ev = (Map<String, Object>) service.check(anaU, "gala-na-piscina", new FlairChallengeService.BuildRequest(mesa, null)).get("evaluation");

        List<Map<String, Object>> vagas = (List<Map<String, Object>>) ev.get("slots");
        assertThat(vagas).extracting(v -> v.get("accepted")).containsExactly(true, false, true, true);
        assertThat(vagas.get(1).get("misses")).isEqualTo(List.of("subcategory"));
        assertThat(ev).containsEntry("complete", true).containsEntry("ok", false);

        mesa.put("cobre", carta("full_body_piece", "dress", "rust").getId());
        Map<String, Object> certo = (Map<String, Object>) service.check(anaU, "gala-na-piscina", new FlairChallengeService.BuildRequest(mesa, null)).get("evaluation");
        assertThat(certo).containsEntry("ok", true);
    }
}
