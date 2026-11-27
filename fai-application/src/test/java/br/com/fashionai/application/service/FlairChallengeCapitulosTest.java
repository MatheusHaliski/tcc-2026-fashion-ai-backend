package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * Os capítulos antigos (linhas de flair_challenges com série, da V98) saíram do app com a Cidade de Vidro: as rotas do
 * CBC não os aceitam mais, nem pelo slug nem pelo id, e respondem o mesmo 404 de um desafio que não existe. Um desafio
 * do CBC comum continua abrindo.
 */
class FlairChallengeCapitulosTest {
    static final Instant NOW = Instant.parse("2026-11-15T15:00:00Z");
    static final String SLOTS = "[{\"key\":\"rua\",\"position\":\"CAL\"},{\"key\":\"festa\",\"position\":\"SUP\"},{\"key\":\"pista\",\"position\":\"INF\"}]";

    private Kit kit;
    private FlairChallengeService service;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        User u = kit.save(UserRepository.class, Kit.user("ana"));
        ana = Kit.as(u);
        MomentService moments = kit.dep(MomentService.class);
        lenient().when(moments.canSee(any(), any())).thenReturn(true);
        FlairCollectionService collection = kit.dep(FlairCollectionService.class);
        lenient().when(collection.visible(any(), any())).thenReturn(true);
        kit.atelier();
        service = kit.build(FlairChallengeService.class);
        service.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    FlairChallenge challenge(String slug, String series) {
        FlairChallenge c = new FlairChallenge();
        c.setSlug(slug);
        c.setName(slug);
        c.setScenario("livre");
        c.setDifficulty(FlairChallengeDifficulty.MEDIUM);
        c.setSlotsJson(SLOTS);
        c.setRequirementsJson("[]");
        c.setPoints(20);
        c.setSeries(series);
        return kit.save(FlairChallengeRepository.class, c);
    }

    static void notFound(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOf(ApiException.class)
                .satisfies(t -> assertThat(((ApiException) t).status()).isEqualTo(404));
    }

    @Test
    void capituloNaoAbreNemConfereNemEntregaPeloCbc() {
        FlairChallenge capitulo = challenge("a01-espelho-partido", "A");
        FlairChallengeService.BuildRequest body = new FlairChallengeService.BuildRequest(Map.of("rua", UUID.randomUUID()), null);

        notFound(() -> service.detail(ana, "a01-espelho-partido"));
        notFound(() -> service.detail(ana, capitulo.getId().toString()));
        notFound(() -> service.check(ana, "a01-espelho-partido", body));
        notFound(() -> service.submit(ana, "a01-espelho-partido", body));
        notFound(() -> service.submit(ana, capitulo.getId().toString(), body));
    }

    @Test
    void desafioDoCbcContinuaAbrindo() {
        challenge("ipanema", null);

        assertThat(service.detail(ana, "ipanema")).containsEntry("slug", "ipanema");
    }
}
