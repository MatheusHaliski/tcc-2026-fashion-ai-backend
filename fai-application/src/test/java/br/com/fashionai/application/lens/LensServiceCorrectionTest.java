package br.com.fashionai.application.lens;

import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** RF54 · Lens: correções que refazem a correspondência, descarte e "Eu tenho"/"Quero". */
class LensServiceCorrectionTest extends LensServiceFixture {
    @Test
    void correcaoGravaFeedbackERefazACorrespondencia() {
        WardrobeItem blazer = piece(me, "upper_piece", "blazer", "red", Visibility.PRIVATE);
        LensViews.ScanView v = scan();
        LensViews.DetectionView jacket = v.detections().get(0);
        // jaqueta jeans × blazer vermelho (subtipo e cor diferentes) fica abaixo do piso
        assertThat(jacket.topMatch()).isNull();
        LensViews.DetectionView fixed = lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, "blazer", null, null, null, null, null));
        assertThat(fixed.status()).isEqualTo("CORRECTED");
        assertThat(fixed.subcategory()).isEqualTo("blazer");
        assertThat(fixed.topMatch()).isNotNull();
        assertThat(fixed.topMatch().pieceId()).isEqualTo(blazer.getId());
        assertThat(fixed.topMatch().similarity()).isGreaterThanOrEqualTo(LensConfig.FLOOR_MY_CLOSET);
        assertThat(lens.matches(meUser, v.id(), jacket.id(), "MY_CLOSET").items()).extracting(LensViews.MatchView::targetId)
                .containsExactly(blazer.getId());
        LensFeedback fb = feedbackRows.values().iterator().next();
        assertThat(fb.getKind()).isEqualTo(LensFeedbackKind.WRONG_CATEGORY);
        assertThat(fb.getBeforeJson()).contains("jacket");
        assertThat(fb.getAfterJson()).contains("blazer");
        assertThat(fb.isTrainingConsent()).isFalse();
        // cor fora da paleta: 400, nada muda
        assertEquals("VALOR_INVALIDO", code(() -> lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, null, "roxo-inventado", null, null, null, null))));
        LensViews.DetectionView recolored = lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, null, "red", null, "striped", List.of("streetwear"), null));
        assertThat(recolored.colors().get(0).name()).isEqualTo("red");
        assertThat(recolored.pattern()).isEqualTo("striped");
        assertThat(recolored.styles()).containsExactly("streetwear");
    }

    @Test
    void descartadaSomeDoScanEDesfazerVolta() {
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(1).id();
        LensViews.DetectionView dismissed = lens.correct(meUser, v.id(), did,
                new LensService.CorrectionCommand(null, null, null, null, null, null, true));
        assertThat(dismissed.status()).isEqualTo("DISMISSED");
        assertThat(lens.get(meUser, v.id()).detections()).extracting(LensViews.DetectionView::id).doesNotContain(did).hasSize(1);
        assertThat(lens.matches(meUser, v.id(), null, "MY_CLOSET").items()).isEmpty();
        assertThat(feedbackRows.values()).extracting(LensFeedback::getKind).contains(LensFeedbackKind.NOT_CLOTHING);
        LensViews.DetectionView back = lens.correct(meUser, v.id(), did,
                new LensService.CorrectionCommand(null, null, null, null, null, null, false));
        assertThat(back.status()).isEqualTo("DETECTED");
        assertThat(lens.get(meUser, v.id()).detections()).hasSize(2);
    }

    @Test
    void euTenhoEQuero() {
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem notMine = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(0).id();
        assertThat(lens.want(meUser, v.id(), did, true).wanted()).isTrue();
        assertThat(lens.history(meUser, null, true, 0, 12).items()).hasSize(1);
        assertThat(lens.want(meUser, v.id(), did, false).wanted()).isFalse();

        LensViews.OwnResult linked = lens.own(meUser, v.id(), did, mine.getId());
        assertThat(linked.detection().ownedItemId()).isEqualTo(mine.getId());
        assertThat(linked.href()).isEqualTo("/pieces/" + mine.getId());
        assertEquals(404, status(() -> lens.own(meUser, v.id(), did, notMine.getId())));

        LensViews.OwnResult draft = lens.own(meUser, v.id(), v.detections().get(1).id(), null);
        assertThat(draft.href()).startsWith("/pieces/new?").contains("category=lower_piece").contains("subcategory=tailored_pants")
                .contains("color=black").contains("from=lens").doesNotContain("image").doesNotContain("restricted");
    }
}
