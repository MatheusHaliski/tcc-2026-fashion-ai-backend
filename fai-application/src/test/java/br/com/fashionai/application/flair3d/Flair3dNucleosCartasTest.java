package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.AroundTheWorldNucleo;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksNucleo;
import br.com.fashionai.application.flair3d.nucleos.Boutique3dNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressTheStarNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import br.com.fashionai.application.flair3d.nucleos.PassarelaNucleo;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;
import org.junit.jupiter.api.Test;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.comMaquiagem;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR 3D — pontuação dos 11 núcleos de cartas: um caso que cumpre o objetivo e um que falha, por núcleo. */
class Flair3dNucleosCartasTest {

    static Resultado jogar(Flair3dNucleo n, Entrega e, CbcRules.Card... cartas) {
        return n.pontuar(e, contexto(7L, cartas));
    }

    /** A partida em etapas jogada até o fim, sem acionar nada (as etapas estão em Flair3dEtapasTest). */
    static Resultado ateOFim(Flair3dNucleo n, int acionamentos, CbcRules.Card... cartas) {
        Acionamento[] nada = new Acionamento[acionamentos];
        java.util.Arrays.fill(nada, Acionamento.NENHUM);
        return n.pontuar(vestir(cartas), contexto(7L, cartas).comAndamento(Andamento.de(nada)));
    }

    static Resultado jogar(Flair3dNucleo n, CbcRules.Card... cartas) {
        return jogar(n, vestir(cartas), cartas);
    }

    @Test
    void passarelaSomaMarcasBrasileirasENormalizaOs70() {
        CbcRules.Card[] br = {card("SUP", "brand:Farm"), card("INF", "brand:Osklen"), card("CAL", "brand:Farm"),
                card("ACE", "brand:Farm"), card("VES", "brand:Osklen")};
        Resultado tudo = jogar(new PassarelaNucleo(), br);
        assertThat(tudo.pontos()).isEqualTo(100);
        assertThat(tudo.estrelas()).isEqualTo(3);
        Resultado tres = jogar(new PassarelaNucleo(), br[0], br[1], br[2]);
        assertThat(tres.pontos()).isEqualTo(71);
        Resultado misto = jogar(new PassarelaNucleo(), card("SUP", "brand:Farm"), card("INF", "brand:Gucci"));
        assertThat(misto.pontos()).isEqualTo(14);
        assertThat(misto.regras()).extracting(Resultado.RegraResultado::codigo, Resultado.RegraResultado::ok)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("MARCA_BR", true), org.assertj.core.groups.Tuple.tuple("TODAS_BR", false));
        assertThat(misto.resultado()).isEqualTo("REPROVADO");
    }

    @Test
    void dressFighterVenceComAtributosDasPecasEPerdeComSalto() {
        Resultado vence = ateOFim(new DressFighterNucleo(), 2, card("SUP", "material:leather"), card("INF", "material:denim"),
                card("CAL", "sub:casual_sneakers"), card("ACE", "material:metal"));
        assertThat(vence.pontos()).isEqualTo(100);
        assertThat(vence.resultado()).isEqualTo("VITORIA");
        assertThat(vence.eventos()).hasSize(3).allMatch(e -> e.codigo().equals("ROUND"));
        Resultado umRound = ateOFim(new DressFighterNucleo(), 2, card("SUP"), card("INF"), card("CAL", "sub:casual_sneakers"), card("ACE"));
        assertThat(umRound.pontos()).isEqualTo(50);
        Resultado perde = ateOFim(new DressFighterNucleo(), 2, card("SUP"), card("INF"), card("CAL", "sub:heels"), card("ACE"));
        assertThat(perde.pontos()).isZero();
        assertThat(perde.resultado()).isEqualTo("DERROTA");
    }

    @Test
    void dressTheStarPontua25PorPecaDeEstiloOuCor() {
        Resultado estrela = jogar(new DressTheStarNucleo(), card("SUP", "style:y2k"), card("INF", "color:pink"),
                card("CAL", "color:silver"), card("ACE", "style:glam"));
        assertThat(estrela.pontos()).isEqualTo(100);
        Resultado falha = jogar(new DressTheStarNucleo(), card("SUP", "style:classic", "color:black"), card("INF", "color:hot_pink"));
        assertThat(falha.pontos()).isEqualTo(25);
        assertThat(falha.estrelas()).isZero();
    }

    @Test
    void personagemFilmeSomaTituloEFigurino() {
        CbcRules.Card[] noir = {card("SUP", "sub:coat"), card("INF", "color:black"), card("CAL", "color:beige"), card("ACE", "color:gray")};
        Entrega certa = new Entrega(vestir(noir).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        assertThat(jogar(new PersonagemFilmeNucleo(), certa, noir).pontos()).isEqualTo(100);
        CbcRules.Card colorida = card("INF", "color:yellow");
        Entrega errada = new Entrega(vestir(noir[0], colorida).cartas(), null, null, "FILME_VERAO_EM_NEON");
        Resultado r = jogar(new PersonagemFilmeNucleo(), errada, noir[0], colorida);
        assertThat(r.pontos()).isEqualTo(13);
        assertThat(r.regras().get(0).ok()).isFalse();
    }

    @Test
    void roadToGloryConfereOcasiaoMaterialEBatom() {
        CbcRules.Card sup = card("SUP", "occasion:casual", "material:linen");
        CbcRules.Card inf = card("INF", "occasion:beach", "material:cotton");
        Entrega e = comMaquiagem(vestir(sup, inf), "LABIOS", "coral", "GLOSS");
        assertThat(jogar(new RoadToGloryNucleo(), e, sup, inf).pontos()).isEqualTo(100);
        CbcRules.Card festa = card("SUP", "occasion:party", "material:leather");
        Entrega falha = comMaquiagem(vestir(festa), "LABIOS", "VERMELHO", "FOSCO");
        assertThat(jogar(new RoadToGloryNucleo(), falha, festa).pontos()).isZero();
    }

    @Test
    void fashionDetectiveFavoravelParcialEDesfavoravel() {
        Resultado favoravel = jogar(new FashionDetectiveNucleo(), card("SUP", "occasion:formal", "material:leather"),
                card("INF", "occasion:party", "material:wool"));
        assertThat(favoravel.pontos()).isEqualTo(100);
        assertThat(favoravel.resultado()).isEqualTo("FAVORAVEL");
        Resultado parcial = jogar(new FashionDetectiveNucleo(), card("SUP", "occasion:formal"), card("INF", "occasion:party"));
        assertThat(parcial.pontos()).isEqualTo(50);
        assertThat(parcial.resultado()).isEqualTo("PARCIAL");
        Resultado nada = jogar(new FashionDetectiveNucleo(), card("SUP", "occasion:casual"));
        assertThat(nada.resultado()).isEqualTo("DESFAVORAVEL");
        assertThat(nada.pontos()).isZero();
    }

    @Test
    void boutiqueDa100ComAsTresPecasDeFestaEmPreto() {
        Resultado tudo = jogar(new Boutique3dNucleo(), card("SUP", "occasion:party", "color:black"),
                card("INF", "occasion:night_out", "color:charcoal"), card("CAL", "occasion:party", "color:black"));
        assertThat(tudo.pontos()).isEqualTo(100);
        Resultado duas = jogar(new Boutique3dNucleo(), card("SUP", "occasion:party", "color:black"),
                card("INF", "occasion:party", "color:black"), card("CAL", "occasion:party", "color:white"));
        assertThat(duas.pontos()).isEqualTo(66);
        assertThat(jogar(new Boutique3dNucleo(), card("SUP", "occasion:work", "color:black")).pontos()).isZero();
    }

    @Test
    void labirintoAbreComTresDaMesmaFamiliaEDizQuantasFaltam() {
        Resultado abre = jogar(new LabirintoNucleo(), card("SUP", "color:navy"), card("INF", "color:blue"), card("CAL", "color:cobalt"));
        assertThat(abre.pontos()).isEqualTo(100);
        assertThat(abre.resultado()).isEqualTo("ABRE");
        Resultado fechado = jogar(new LabirintoNucleo(), card("SUP", "color:navy"), card("INF", "color:blue"), card("CAL", "color:red"));
        assertThat(fechado.pontos()).isZero();
        assertThat(fechado.eventos()).contains(new Resultado.Evento("FALTAM_PECAS", 1), new Resultado.Evento("FAMILIA", "FAMILIA_AZUL"));
    }

    @Test
    void aroundTheWorldPedeLevezaCorQuenteEMarcaBrasileira() {
        Resultado rio = jogar(new AroundTheWorldNucleo(), card("SUP", "material:linen", "color:red", "brand:Farm"),
                card("INF", "material:cotton"));
        assertThat(rio.pontos()).isEqualTo(100);
        Resultado frio = jogar(new AroundTheWorldNucleo(), card("SUP", "material:leather", "color:blue", "brand:Gucci"),
                card("INF", "material:denim", "color:navy"));
        assertThat(frio.pontos()).isZero();
    }

    @Test
    void fashionSportsVenceComUniformeForteEPerdeComFracoDeFormaDeterministica() {
        CbcRules.Card[] forte = {card("SUP", "ovr:90", "material:linen", "material:leather"), card("INF", "ovr:90", "material:denim"),
                card("CAL", "ovr:90", "sub:casual_sneakers")};
        Resultado vitoria = ateOFim(new FashionSportsNucleo(), 1, forte);
        assertThat(vitoria.pontos()).isEqualTo(100);
        assertThat(vitoria.resultado()).isEqualTo("VITORIA");
        assertThat(vitoria.eventos()).contains(new Resultado.Evento("COESAO", 100));
        assertThat(ateOFim(new FashionSportsNucleo(), 1, forte)).isEqualTo(vitoria);
        Resultado derrota = ateOFim(new FashionSportsNucleo(), 1, card("SUP", "ovr:10"), card("INF", "ovr:10"), card("CAL", "ovr:10"));
        assertThat(derrota.pontos()).isZero();
        assertThat(derrota.resultado()).isEqualTo("DERROTA");
    }

    @Test
    void batalhaLooksVenceSoComMaisDe75() {
        Resultado vence = jogar(new BatalhaLooksNucleo(), card("SUP", "color:blue"), card("INF", "color:navy"), card("CAL", "color:denim"),
                card("ACE", "color:light_blue"));
        assertThat(vence.pontos()).isEqualTo(100);
        assertThat(vence.resultado()).isEqualTo("VITORIA");
        Resultado empata = jogar(new BatalhaLooksNucleo(), card("SUP", "color:blue"), card("INF", "color:navy"), card("CAL", "color:denim"),
                card("ACE", "color:red"));
        assertThat(empata.pontos()).isEqualTo(75);
        assertThat(empata.resultado()).isEqualTo("DERROTA");
    }

    @Test
    void efeitosDasCartasSaoOsSelosDaTelaDoDeck() {
        CbcRules.Card farm = card("SUP", "brand:Farm", "color:blue");
        Contexto ctx = contexto(1L, farm);
        assertThat(new PassarelaNucleo().efeitos(farm, ctx)).containsExactly(new Efeito("MARCA_BR", 10));
        assertThat(new BatalhaLooksNucleo().efeitos(farm, ctx)).containsExactly(new Efeito("FAMILIA_AZUL", 25));
        assertThat(new DressFighterNucleo().efeitos(card("CAL", "sub:running_shoes"), ctx)).first().isEqualTo(new Efeito("VELOCIDADE", 26));
        assertThat(new LabirintoNucleo().efeitos(farm, ctx)).containsExactly(new Efeito("FAMILIA_AZUL", 1));
    }
}
