package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.aura.Flair3dAuraRegrasTest.comHype;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * O decorator da Aura nos jogos de um look: a plateia e o trunfo entram na nota que fecha o look, limitados (até 6 e até
 * 5), com o evento AURA_NA_PARTIDA para a tela; a partida que ainda não fechou o look fica como está.
 */
class Flair3dAuraNaPartidaTest {
    private final PersonagemFilmeNucleo filme = new PersonagemFilmeNucleo();
    private final Flair3dAuraNaPartida comAura = new Flair3dAuraNaPartida(filme);
    private final CbcRules.Card viral = comHype("SUP", 95, "color:black");
    private final CbcRules.Card reserva = comHype("INF", 80);

    private static double regra(Resultado r, String codigo) {
        return r.regras().stream().filter(x -> x.codigo().equals(codigo)).mapToDouble(RegraResultado::pontos).sum();
    }

    @Test
    void aPlateiaSomaNaNotaQueFechaOLook() {
        Contexto ctx = Flair3dFixtures.contexto(7, viral, reserva);
        Entrega e = Flair3dFixtures.vestir(viral);
        Resultado sem = filme.pontuar(e, ctx);
        Resultado com = comAura.pontuar(e, ctx);
        assertThat(regra(com, Flair3dAuraNaPartida.PLATEIA)).isEqualTo(Flair3dAuraRegras.PLATEIA_TETO);
        assertThat(com.pontos()).isEqualTo(Math.min(100, sem.pontos() + Flair3dAuraRegras.PLATEIA_TETO));
        assertThat(com.eventos()).anyMatch(ev -> ev.codigo().equals(Flair3dAuraEvento.CODIGO));
        assertThat(com.regras()).noneMatch(x -> x.codigo().equals(Flair3dAuraNaPartida.TRUNFO));
        // a prévia só avisa: a nota dela continua a do jogo
        Resultado previa = comAura.previa(e, ctx);
        assertThat(previa.eventos()).anyMatch(ev -> ev.codigo().equals(Flair3dAuraEvento.CODIGO));
        assertThat(previa.pontos()).isEqualTo(filme.previa(e, ctx).pontos());
    }

    @Test
    void oTrunfoChamadoEntraComoDestaqueNaFotoFinal() {
        Andamento a = Andamento.INICIO.comHype(new Andamento.TrunfoDeHype(reserva.id(), "p", 0));
        Contexto ctx = Flair3dFixtures.contexto(7, viral, reserva).comAndamento(a);
        Resultado r = comAura.pontuar(Flair3dFixtures.vestir(viral), ctx);
        assertThat(regra(r, Flair3dAuraNaPartida.TRUNFO)).isEqualTo(4);
        @SuppressWarnings("unchecked")
        Map<String, Object> ev = (Map<String, Object>) r.eventos().stream().filter(x -> x.codigo().equals(Flair3dAuraEvento.CODIGO)).findFirst().orElseThrow().valor();
        assertThat((Map<String, Object>) ev.get("trunfo")).containsEntry("faixa", "TRENDING").containsEntry("bonus", 4);
    }

    @Test
    void cincoJogosDeCartasTemAuraNaPartidaENenhumDeZonas() {
        assertThat(Flair3dAuraRegras.JOGOS).hasSize(5).doesNotContain("CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI");
        assertThat(Flair3dAuraRegras.JOGOS).allMatch(j -> Flair3dNucleos.porCodigo(j).isPresent());
        assertThat(List.of(Flair3dNucleos.porCodigo("PASSARELA").orElseThrow().codigo())).containsExactly("PASSARELA");
    }
}
