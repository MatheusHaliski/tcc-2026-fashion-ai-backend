package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.SlotResult;
import br.com.fashionai.application.flair.GlassHype.Band;
import br.com.fashionai.application.flair.GlassPenalties.Code;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GlassPenaltiesTest {
    private static final UUID CARD = UUID.randomUUID();

    private static List<Code> codes(SlotResult r, Band band, Band max) {
        return GlassPenalties.of(r, band, max).stream().map(GlassPenalties.Penalty::code).toList();
    }

    @Test
    void cartaCertaNaoTemErro() {
        SlotResult r = new SlotResult("a", "SUP", CARD, true, true, false, 2);
        assertThat(GlassPenalties.of(r, Band.HOT, Band.VIRAL)).isEmpty();
    }

    @Test
    void cartaForaDaPosicaoESemSintoniaSomaDoisErros() {
        SlotResult r = new SlotResult("a", "SUP", CARD, false, false, false, 0);
        assertThat(codes(r, Band.NICHE, Band.VIRAL)).containsExactly(Code.MISPLACED, Code.NO_SINTONIA);
        assertThat(GlassPenalties.total(GlassPenalties.of(r, Band.NICHE, Band.VIRAL))).isEqualTo(2);
    }

    @Test
    void cartaRecusadaPelaVagaCustaDois() {
        SlotResult r = new SlotResult("a", "SUP", CARD, true, true, true, 3, false, List.of("tier"));
        assertThat(codes(r, Band.NICHE, Band.VIRAL)).containsExactly(Code.REFUSED);
        assertThat(GlassPenalties.total(GlassPenalties.of(r, Band.NICHE, Band.VIRAL))).isEqualTo(2);
    }

    @Test
    void hypeAcimaDoMaximoObrigatorioESuperexposicao() {
        SlotResult r = new SlotResult("a", "SUP", CARD, true, true, false, 2);
        assertThat(codes(r, Band.VIRAL, Band.HOT)).containsExactly(Code.OVEREXPOSED);
        assertThat(codes(r, Band.HOT, Band.HOT)).isEmpty();
    }

    @Test
    void vagaVaziaNaoTemErroEPlacarNuncaFicaNegativo() {
        assertThat(GlassPenalties.of(new SlotResult("a", "SUP", null, false, false, false, 0), Band.NICHE, Band.VIRAL)).isEmpty();
        assertThat(GlassPenalties.score(1, 0, 0, 4)).isZero();
        assertThat(GlassPenalties.score(6, 2, 1, 3)).isEqualTo(6);
    }
}
