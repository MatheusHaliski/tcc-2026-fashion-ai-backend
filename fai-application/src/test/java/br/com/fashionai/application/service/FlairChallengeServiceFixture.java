package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Base dos testes dos Desafios de Montagem (FLAIR-UT F5 · §14): pessoas, dublês do Momento, dos pontos e da coleção,
 * o serviço com relógio fixo e os atalhos para criar Momento, desafio, carta e montagem.
 * Separada de {@code FlairChallengeServiceTest} por tema no lote R82, sem mudar nenhum teste.
 */
abstract class FlairChallengeServiceFixture {
    static final Instant NOW = Instant.parse("2026-10-25T15:00:00Z");
    static final String READINGS = "[{\"key\":\"dark\",\"label\":{\"pt-BR\":\"Dark\"},\"styleTags\":[\"edgy\",\"grunge\"],\"colorTags\":[\"black\"]},"
            + "{\"key\":\"orange-black\",\"label\":{\"pt-BR\":\"Laranja e preto\"},\"colorTags\":[\"orange\",\"black\"]}]";

    Kit kit;
    FlairChallengeService service;
    MomentService momentService;
    FaiPointsService points;
    FlairCollectionService collection;
    User ana;
    User bia;
    CurrentUser anaU;
    CurrentUser biaU;
    Moment halloween;

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
        kit.atelier();
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
}
