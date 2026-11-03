package br.com.fashionai.application.lens;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** RF54 · Lens: camada viva — comunidade sem peças próprias nem privadas, Hype do grupo e plano Recriar. */
class LensServiceLiveLayerTest extends LensServiceFixture {
    @Test
    void comunidadeNuncaTrazPecaPropriaNemNaoPublica() {
        WardrobeItem publicOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        WardrobeItem privateOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem mineToo = piece(me, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        WardrobeItem archived = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        archived.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        WardrobeItem notEligible = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        publicHype(publicOther, 50);
        publicHype(privateOther, 50);            // linha velha do Hype: a leitura confere a visibilidade de novo
        publicHype(mineToo, 50);
        publicHype(archived, 50);
        LensViews.ScanView v = scan();
        UUID jacket = v.detections().get(0).id();
        List<LensViews.MatchView> community = lens.matches(meUser, v.id(), jacket, "COMMUNITY").items();
        assertThat(community).extracting(LensViews.MatchView::targetId).containsExactly(publicOther.getId());
        assertThat(community.get(0).scope()).isEqualTo("COMMUNITY");
        assertThat(community.get(0).targetType()).isEqualTo("PIECE");
        assertThat(community.get(0).similarity()).isGreaterThanOrEqualTo(LensConfig.FLOOR_COMMUNITY);
        assertThat(community.get(0).components().visual()).isNull();              // sem embedding do lado da peça
        assertThat(community.get(0).reasons()).contains("SAME_SUBCATEGORY");
        assertThat(notEligible.getId()).isNotIn(community.stream().map(LensViews.MatchView::targetId).toList());
        // o guarda-roupa só traz as minhas
        assertThat(lens.matches(meUser, v.id(), jacket, "MY_CLOSET").items()).extracting(LensViews.MatchView::targetId)
                .containsExactly(mineToo.getId());
        assertEquals("VALOR_INVALIDO", code(() -> lens.matches(meUser, v.id(), jacket, "EVERYONE")));
    }

    @Test
    void hypeDoGrupoComCincoPecasPublicas() {
        for (int i = 0; i < 5; i++) {
            publicHype(piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC), 60 + i);
        }
        LensViews.ReadingView r = lens.reading(meUser, scan().id(), null);
        assertThat(r.trend().status()).isEqualTo("AVAILABLE");
        assertThat(r.trend().key()).isEqualTo("cc:upper_piece|denim");
        assertThat(r.trend().items()).isEqualTo(5);
        assertThat(r.trend().score()).isEqualTo(62);
        assertThat(r.trend().direction()).isEqualTo("UP");
        assertThat(r.fit()).isNull();                                               // sem DNA: não inventa número
        assertThat(r.styles().stream().mapToInt(LensViews.StyleShare::share).sum()).isEqualTo(100);
    }

    @Test
    void recriarMontaSlotsComPecaPropriaAlternativaELacuna() {
        WardrobeItem myJacket = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem otherJacket = piece(me, "upper_piece", "jacket", "black", Visibility.PRIVATE);
        WardrobeItem myShorts = piece(me, "lower_piece", "shorts", "white", Visibility.PRIVATE);
        LensViews.ScanView v = scan();
        LensViews.RecreatePlan plan = lens.recreate(meUser, v.id(), new LensService.RecreateCommand("SAFE", null, null));
        assertThat(plan.mode()).isEqualTo("SAFE");
        assertThat(plan.slots()).extracting(LensViews.SlotView::slot).containsExactly("TOP", "BOTTOM");
        LensViews.SlotView top = plan.slots().get(0);
        assertThat(top.state()).isEqualTo("own");
        assertThat(top.piece().id()).isEqualTo(myJacket.getId());
        assertThat(top.alternatives()).extracting(Views.PieceView::id).containsExactly(otherJacket.getId());
        LensViews.SlotView bottom = plan.slots().get(1);
        assertThat(bottom.state()).isEqualTo("gap");                                // calça preta × shorts branco
        assertThat(bottom.piece()).isNull();
        assertThat(bottom.alternatives()).extracting(Views.PieceView::id).containsExactly(myShorts.getId());
        assertThat(plan.pieceIds()).containsExactly(myJacket.getId());
        assertThat(plan.createHref()).isEqualTo("/schemes/new?pieces=" + myJacket.getId());
        assertThat(plan.scores().usage()).isNotNull();
        assertThat(plan.scores().sustainability()).isNotNull();

        // slot fixado: fica com a peça escolhida, em qualquer modo
        LensViews.RecreatePlan locked = lens.recreate(meUser, v.id(),
                new LensService.RecreateCommand("EXPERIMENTAL", v.detections().get(1).id(), Map.of("TOP", otherJacket.getId().toString())));
        assertThat(locked.slots().get(0).slot()).isEqualTo("BOTTOM");              // foco vem primeiro
        LensViews.SlotView lockedTop = locked.slots().stream().filter(s -> s.slot().equals("TOP")).findFirst().orElseThrow();
        assertThat(lockedTop.piece().id()).isEqualTo(otherJacket.getId());
        assertThat(lockedTop.state()).isEqualTo("own");
        // peça de outra pessoa não pode ser fixada; modo inválido é 400
        WardrobeItem notMine = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        assertEquals(404, status(() -> lens.recreate(meUser, v.id(), new LensService.RecreateCommand("SAFE", null,
                Map.of("TOP", notMine.getId().toString())))));
        assertEquals("MODO_INVALIDO", code(() -> lens.recreate(meUser, v.id(), new LensService.RecreateCommand("YOLO", null, null))));
    }
}
