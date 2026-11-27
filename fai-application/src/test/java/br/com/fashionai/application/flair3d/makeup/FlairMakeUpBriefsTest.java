package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.makeup.briefs.EnsaioVeraoBrief;
import br.com.fashionai.application.flair3d.makeup.briefs.EntrevistaBrief;
import br.com.fashionai.application.flair3d.makeup.briefs.PrimeiroEncontroBrief;
import org.junit.jupiter.api.Test;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.comMaquiagem;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR 3D MAKE UP — nota dos três briefs (25 por regra) e a curva de Prestígio da carreira. */
class FlairMakeUpBriefsTest {

    static Resultado jogar(FlairMakeUpBrief b, Entrega e, CbcRules.Card... cartas) {
        return b.pontuar(e, contexto(0L, cartas));
    }

    @Test
    void ensaioVeraoReusaAsRegrasDoRoadToGlory() {
        CbcRules.Card sup = card("SUP", "occasion:beach", "material:linen");
        Entrega e = comMaquiagem(vestir(sup), "LABIOS", "CORAL", "CETIM");
        assertThat(jogar(new EnsaioVeraoBrief(), e, sup).pontos()).isEqualTo(100);
        Entrega fosco = comMaquiagem(vestir(sup), "LABIOS", "CORAL", "FOSCO");
        Resultado r = jogar(new EnsaioVeraoBrief(), fosco, sup);
        assertThat(r.pontos()).isEqualTo(75);
        assertThat(r.estrelas()).isEqualTo(1);
    }

    @Test
    void entrevistaPedeTrabalhoCalcadoFechadoENudeFosco() {
        CbcRules.Card sup = card("SUP", "occasion:work");
        CbcRules.Card cal = card("CAL", "occasion:formal", "sub:oxford_shoes");
        Entrega e = comMaquiagem(vestir(sup, cal), "LABIOS", "NUDE", "FOSCO");
        assertThat(jogar(new EntrevistaBrief(), e, sup, cal).pontos()).isEqualTo(100);
        CbcRules.Card sandalia = card("CAL", "occasion:beach", "sub:sandals");
        Entrega falha = comMaquiagem(vestir(sup, sandalia), "LABIOS", "VERMELHO", "GLOSS");
        assertThat(jogar(new EntrevistaBrief(), falha, sup, sandalia).pontos()).isZero();
    }

    @Test
    void primeiroEncontroPedeFestaAcessorioBatomVermelhoEBochechasRosa() {
        CbcRules.Card sup = card("SUP", "occasion:date");
        CbcRules.Card ace = card("ACE", "occasion:party");
        Entrega e = comMaquiagem(comMaquiagem(vestir(sup, ace), "LABIOS", "VINHO", "GLOSS"), "BOCHECHAS", "ROSA", "CETIM");
        assertThat(jogar(new PrimeiroEncontroBrief(), e, sup, ace).pontos()).isEqualTo(100);
        CbcRules.Card trabalho = card("SUP", "occasion:work");
        Entrega falha = comMaquiagem(vestir(trabalho), "BOCHECHAS", "BRONZE", "FOSCO");
        assertThat(jogar(new PrimeiroEncontroBrief(), falha, trabalho).pontos()).isZero();
    }

    @Test
    void curvaDePrestigioSegueOPlano() {
        assertThat(FlairMakeUpCarreira.custo(1)).isEqualTo(60);
        assertThat(FlairMakeUpCarreira.custo(5)).isEqualTo(180);
        assertThat(FlairMakeUpCarreira.custo(6)).isEqualTo(220);
        assertThat(FlairMakeUpCarreira.acumulado(3)).isEqualTo(150);
        assertThat(FlairMakeUpCarreira.acumulado(5)).isEqualTo(420);
        assertThat(FlairMakeUpCarreira.acumulado(10)).isEqualTo(1842);
        assertThat(FlairMakeUpCarreira.acumulado(11)).isEqualTo(2316);
        assertThat(FlairMakeUpCarreira.acumulado(16)).isEqualTo(5847);
        assertThat(FlairMakeUpCarreira.acumulado(30)).isEqualTo(28532);
        assertThat(FlairMakeUpCarreira.de(0)).isEqualTo(new FlairMakeUpCarreira(1, 0, 60));
        assertThat(FlairMakeUpCarreira.de(59)).isEqualTo(new FlairMakeUpCarreira(1, 59, 1));
        assertThat(FlairMakeUpCarreira.de(150)).isEqualTo(new FlairMakeUpCarreira(3, 150, 120));
        assertThat(FlairMakeUpCarreira.de(1842).nivel()).isEqualTo(10);
        assertThat(FlairMakeUpCarreira.de(1_000_000)).isEqualTo(new FlairMakeUpCarreira(30, 1_000_000, 0));
    }

    @Test
    void soEstrelasNovasRendemPrestigio() {
        assertThat(FlairMakeUpCarreira.POR_ESTRELA).isEqualTo(20);
        assertThat(FlairMakeUpCarreira.ganho(0, 3)).isEqualTo(60);
        assertThat(FlairMakeUpCarreira.ganho(1, 3)).isEqualTo(40);
        assertThat(FlairMakeUpCarreira.ganho(3, 3)).isZero();
        assertThat(FlairMakeUpCarreira.ganho(3, 1)).isZero();
    }
}
