package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 2 (P1-08/P2-14) — prévia do look no editor ({@code POST /api/schemes/scores}) e números das composições da
 * IA: os seis números de RecommendationScoring a partir das peças do rascunho, com o Hype = média do v2 das peças (Hype
 * pessoal do dono). Nada é gravado, nenhum sinal de Hype é emitido, "sem dados" fica nulo (nunca 0) e peça de outra
 * pessoa não entra (o Hype privado dela nunca vaza por esta rota).
 */
@SuppressWarnings("unchecked")
class LookPreviewServiceTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private SchemeItemRepository schemeItems;
    private StyleDnaRepository dnas;
    private HypeQueryService hype;
    private LookPreviewService service;
    private final List<WardrobeItem> closet = new ArrayList<>();
    private final Map<UUID, HypeScoreCurrent> scores = new HashMap<>();

    private WardrobeItem piece(UUID owner, String name, String category, String style, String occasion, int wears, int daysSinceWorn) {
        User u = new User();
        u.assignId(owner);
        u.setProfileType(ProfileType.PESSOAL);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory(category);
        w.setColor("black");
        w.setStyleTags(style);
        w.setOccasionTags(occasion);
        w.setWearCount(wears);
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE).minusDays(daysSinceWorn));
        w.markCreatedAt(Instant.now().minusSeconds(300L * 86400));
        w.setVisibility(Visibility.PRIVATE);
        closet.add(w);
        return w;
    }

    private void hypeOf(WardrobeItem w, Double score, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setStatus(score == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setDimensions(new HypeDimensions());
        c.setPublicEligible(publicEligible);
        scores.put(w.getId(), c);
    }

    @BeforeEach
    void setUp() {
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        schemeItems = mock(SchemeItemRepository.class);
        dnas = mock(StyleDnaRepository.class);
        hype = mock(HypeQueryService.class);
        service = new LookPreviewService(pieces, schemes, schemeItems, dnas, hype);
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> closet.stream().filter(w -> ((Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            ((Collection<UUID>) inv.getArgument(1)).forEach(id -> { if (scores.containsKey(id)) out.put(id, scores.get(id)); });
            return out;
        });
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("formal");
        dna.setColorPalette("black");
        dna.setOccasionKeywords("work");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));
        when(schemes.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of());
    }

    private static LookPreviewService.PreviewRequest req(List<UUID> ids) {
        return new LookPreviewService.PreviewRequest(ids, List.of(), List.of(), null);
    }

    @Test
    void sixNumbersForTheDraftWithHypeAsTheAverageOfTheOwnersPieces() {
        WardrobeItem top = piece(uid, "Camisa", "upper_piece", "casual", "casual", 8, 90);
        WardrobeItem bottom = piece(uid, "Calça", "lower_piece", "casual", "casual", 0, 120);
        WardrobeItem shoes = piece(uid, "Tênis", "shoes_piece", "casual", "casual", 4, 3);
        hypeOf(top, 80.0, false);   // peça privada: Hype pessoal, conta para o dono
        hypeOf(bottom, 61.0, true);
        hypeOf(shoes, null, true);  // dados insuficientes: fora da média, nunca 0

        Map<String, Object> out = service.scores(me, req(List.of(top.getId(), bottom.getId(), shoes.getId())));

        Map<String, Object> s = (Map<String, Object>) out.get("scores");
        assertThat(s).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
        assertThat(s.get("hype")).as("média de 80 e 61, a peça sem dados fica de fora").isEqualTo(71);
        assertThat(s.get("novelty")).as("nenhum par já combinado").isEqualTo(100);
        assertThat(s.get("compatibility")).isNotNull();
        assertThat(s.get("usage")).isNotNull();
        assertThat(out.get("persisted")).isEqualTo(false);
        assertThat((Map<String, Object>) out.get("hype")).containsEntry("basis", "PIECES_AVERAGE").containsEntry("withData", 2L).containsEntry("total", 3);
    }

    @Test
    void piecesWithoutHypeLeaveTheHypeNumberEmptyNeverZero() {
        WardrobeItem a = piece(uid, "A", "upper_piece", "casual", "casual", 1, 1);
        WardrobeItem b = piece(uid, "B", "lower_piece", "casual", "casual", 1, 1);
        hypeOf(a, null, true);
        Map<String, Object> out = service.scores(me, req(List.of(a.getId(), b.getId())));
        assertThat(((Map<String, Object>) out.get("scores")).get("hype")).isNull();
        assertThat((Map<String, Object>) out.get("hype")).containsEntry("withData", 0L);
    }

    @Test
    void declaredStyleAndOccasionUseTheSameRuleAsTheSavedLook() {
        WardrobeItem a = piece(uid, "A", "upper_piece", "casual", "casual", 1, 1);
        WardrobeItem b = piece(uid, "B", "lower_piece", "casual", "casual", 1, 1);
        List<UUID> ids = List.of(a.getId(), b.getId());
        Integer piecesOnly = (Integer) ((Map<String, Object>) service.scores(me, req(ids)).get("scores")).get("compatibility");
        Integer declared = (Integer) ((Map<String, Object>) service.scores(me,
                new LookPreviewService.PreviewRequest(ids, List.of("work"), List.of("formal"), null)).get("scores")).get("compatibility");
        // DNA formal/preto/trabalho; peças casuais pretas: só a cor bate (30). Declarando formal + trabalho, tudo bate (100)
        assertThat(piecesOnly).isEqualTo(30);
        assertThat(declared).isEqualTo(100);
    }

    @Test
    void editingALookDoesNotCountItsOwnPairsAsAlreadyCombined() {
        WardrobeItem a = piece(uid, "A", "upper_piece", "casual", "casual", 1, 1);
        WardrobeItem b = piece(uid, "B", "lower_piece", "casual", "casual", 1, 1);
        Scheme editing = new Scheme();
        editing.assignId(UUID.randomUUID());
        when(schemes.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of(editing));
        List<SchemeItem> items = List.of(item(editing, a), item(editing, b));
        when(schemeItems.findBySchemeIdIn(anyCollection())).thenAnswer(inv -> ((Collection<UUID>) inv.getArgument(0)).contains(editing.getId()) ? items : List.of());
        List<UUID> ids = List.of(a.getId(), b.getId());

        Object fresh = ((Map<String, Object>) service.scores(me, new LookPreviewService.PreviewRequest(ids, null, null, editing.getId())).get("scores")).get("novelty");
        Object seen = ((Map<String, Object>) service.scores(me, req(ids)).get("scores")).get("novelty");
        assertThat(fresh).as("editando o próprio look").isEqualTo(100);
        assertThat(seen).as("rascunho novo com o mesmo par de um look salvo").isEqualTo(0);
    }

    @Test
    void onlyTheOwnersPiecesAndNothingIsSavedOrEmitted() {
        WardrobeItem mine = piece(uid, "Minha", "upper_piece", "casual", "casual", 1, 1);
        WardrobeItem theirs = piece(UUID.randomUUID(), "Privada de outra pessoa", "lower_piece", "casual", "casual", 1, 1);
        hypeOf(theirs, 95.0, false);
        assertThatThrownBy(() -> service.scores(me, req(List.of(mine.getId(), theirs.getId()))))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("PECA_DE_OUTRO_USUARIO"));
        verifyNoInteractions(hype);   // o Hype privado de terceiros nem chega a ser lido

        service.scores(me, req(List.of(mine.getId())));
        verify(pieces, never()).save(any());
        verify(schemes, never()).save(any());
        verify(schemeItems, never()).save(any());
        verify(hype).currentOf(eq(HypeEntityType.PIECE), anyCollection());
        verifyNoMoreInteractions(hype);   // só leitura do estado gravado: nenhum recálculo, nenhum sinal
    }

    @Test
    void validatesTheRequest() {
        assertThatThrownBy(() -> service.scores(null, req(List.of(UUID.randomUUID()))))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(401));
        assertThatThrownBy(() -> service.scores(me, req(List.of())))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("SEM_PECAS"));
        assertThatThrownBy(() -> service.scores(me, null))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("SEM_PECAS"));
        List<UUID> many = IntStream.range(0, LookPreviewService.MAX_PIECES + 1).mapToObj(i -> UUID.randomUUID()).toList();
        assertThatThrownBy(() -> service.scores(me, req(many)))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("PECAS_DEMAIS"));
        assertThatThrownBy(() -> service.scores(me, req(List.of(UUID.randomUUID()))))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
    }

    @Test
    void aiCompositionsGetScoresInTheSameOrder() {
        WardrobeItem a = piece(uid, "A", "upper_piece", "casual", "casual", 1, 1);
        WardrobeItem b = piece(uid, "B", "lower_piece", "casual", "casual", 1, 1);
        WardrobeItem c = piece(uid, "C", "shoes_piece", "casual", "casual", 1, 1);
        WardrobeItem stranger = piece(UUID.randomUUID(), "X", "shoes_piece", "casual", "casual", 1, 1);
        hypeOf(a, 50.0, true);
        hypeOf(c, 90.0, true);
        hypeOf(stranger, 10.0, true);
        List<LocalSchemeComposer.Composition> list = List.of(composition(a, b), composition(a, c, stranger), composition(stranger));

        List<Map<String, Object>> out = service.compositions(me, list);

        assertThat(out).hasSize(3);
        assertThat(out.get(0).get("hype")).isEqualTo(50);
        assertThat(out.get(1).get("hype")).as("peça de outra pessoa fica fora da conta").isEqualTo(70);
        assertThat(out.get(2)).as("sem peças do dono: tudo sem base").containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability")
                .allSatisfy((k, v) -> assertThat(v).isNull());
        assertThat(service.compositions(null, list)).isEmpty();
        assertThat(service.compositions(me, List.of())).isEmpty();
    }

    private static SchemeItem item(Scheme s, WardrobeItem w) {
        SchemeItem si = new SchemeItem();
        si.setScheme(s);
        si.setWardrobeItem(w);
        return si;
    }

    private static LocalSchemeComposer.Composition composition(WardrobeItem... list) {
        List<LocalSchemeComposer.Pick> picks = java.util.Arrays.stream(list).map(w -> new LocalSchemeComposer.Pick(w.getId(), SchemeSlot.TOP)).toList();
        return new LocalSchemeComposer.Composition("Look", picks, List.of(), List.of(), null, "ELEGANT", List.of(), BigDecimal.ZERO, 1, "");
    }
}
