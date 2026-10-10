package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * FLAIR-UT F3 — "Converter para FLAIR" duplica a peça numa carta (D11), uma por temporada (D6), e nunca publica no feed;
 * "Minhas cartas FLAIR" separa por nível e o visitante só vê as cartas de peças que pode abrir.
 */
class FlairCollectionServiceTest {
    private Kit kit;
    private World world;
    private FlairCollectionService service;
    private CurrentUser ana;
    private WardrobeItem piece;
    private Guard guard;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        kit = new Kit();
        kit.with(Kit.mock(HypeScoreCurrentRepository.class));
        world = new World(kit);
        ana = Kit.as(world.me);
        piece = world.piecesOf(world.me).get(0);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        piece.setPrice(new BigDecimal("39.00"));
        when(kit.dep(WardrobeService.class).owned(any(), eq(piece.getId()))).thenReturn(piece);
        when(kit.dep(FlairService.class).cardsOf(any())).thenAnswer(a -> ((List<WardrobeItem>) a.getArgument(0)).stream()
                .map(w -> FlairEngine.card(new FlairEngine.PieceInput(w.getId().toString(), w.getName(), w.getCategory(), w.getSubcategory(),
                        "/media/p.png", "#000000", w.getBrandName(), false, null, List.of("casual"), List.of("work"), "COTTON", 0.7,
                        false, false, false, false, false, FlairEngine.Hype.NONE, 0), "SPRING")).toList());
        guard = kit.dep(Guard.class);
        service = kit.build(FlairCollectionService.class);
    }

    @Test
    void converterDuplicaAPecaNumaCartaENaoMexeNaPeca() {
        Visibility before = piece.getVisibility();
        Map<String, Object> card = service.convertPiece(ana, piece.getId());

        assertThat(card).containsEntry("originType", "PIECE").containsEntry("originId", piece.getId()).containsEntry("name", piece.getName());
        assertThat(card.get("tier")).isIn("BRONZE", "PRATA", "OURO");
        assertThat(card).containsKey("basis").containsEntry("hype", null);                  // sem Hype público: "—", nunca 0
        FlairCardInstance saved = kit.dep(FlairCardInstanceRepository.class).findAll().get(0);
        assertThat(saved.getOwnerId()).isEqualTo(world.me.getId());
        assertThat(saved.getCreatorId()).isEqualTo(world.me.getId());
        assertThat(saved.getAcquiredVia()).isEqualTo("GENERATED");
        // a peça continua no guarda-roupa, com a mesma visibilidade (o card original é o post social)
        assertThat(kit.dep(WardrobeItemRepository.class).findById(piece.getId())).isPresent();
        assertThat(piece.getVisibility()).isEqualTo(before);
        // converter nunca publica: nada no feed (o serviço nem conhece compartilhamento)
        assertThat(kit.dep(ShareRepository.class).findAll()).isEmpty();
        assertThat(Arrays.stream(FlairCollectionService.class.getDeclaredConstructors()[0].getParameterTypes()))
                .doesNotContain(ShareRepository.class, SocialService.class);
    }

    @Test
    void umaCartaPorPecaPorTemporada() {
        Map<String, Object> first = service.convertPiece(ana, piece.getId());
        assertThatThrownBy(() -> service.convertPiece(ana, piece.getId()))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(409);
                    assertThat(e.code()).isEqualTo("CARTA_JA_EXISTE");
                    assertThat(e.details()).containsEntry("cardId", first.get("id"));
                });
        assertThat(kit.dep(FlairCardInstanceRepository.class).findAll()).hasSize(1);
        // a prévia do detalhe já mostra a carta que existe ("Ver carta FLAIR")
        assertThat(service.previewPiece(ana, piece.getId())).containsKey("existing");
    }

    @Test
    @SuppressWarnings("unchecked")
    void minhasCartasPorNivelEVisitanteSoVeCartasDePecasQuePodeAbrir() {
        service.convertPiece(ana, piece.getId());
        Map<String, Object> mine = service.mine(ana, null);
        assertThat((Map<String, Long>) mine.get("counts")).containsKeys("ESPECIAL", "OURO", "PRATA", "BRONZE");
        assertThat(mine).containsEntry("total", 1);
        assertThat(service.mine(ana, piece.getId()).get("cards")).asList().hasSize(1);
        assertThat(service.mine(ana, world.rival.getId()).get("cards")).asList().isEmpty();

        CurrentUser visitor = Kit.as(world.rival);
        world.me.setProfileVisibility(Visibility.PUBLIC);
        piece.setVisibility(Visibility.PRIVATE);
        assertThat(service.ofUser(visitor, world.me.getId()).get("cards")).asList().isEmpty();
        piece.setVisibility(Visibility.PUBLIC);
        when(guard.canView(any(), eq(world.me.getId()), eq(Visibility.PUBLIC))).thenReturn(true);
        List<Map<String, Object>> seen = (List<Map<String, Object>>) service.ofUser(visitor, world.me.getId()).get("cards");
        assertThat(seen).hasSize(1);
        assertThat(seen.get(0)).doesNotContainKey("basis");                                   // o porquê do nível é da dona
    }

    @Test
    void previaDoRascunhoDoCriador() {
        Map<String, Object> p = service.previewDraft(new FlairCollectionService.Draft("upper_piece", "t_shirt", new BigDecimal("39"), null, null, null,
                List.of("casual"), List.of("work"), "black", "COTTON"));
        assertThat(p).containsEntry("tier", "BRONZE").containsEntry("position", "SUP").containsEntry("priceVerified", false);
    }
}
