package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair3d.nucleos.ClubeCoracaoNucleo;
import br.com.fashionai.application.flair3d.nucleos.FavoriteSingerNucleo;
import br.com.fashionai.application.flair3d.nucleos.PilotoFavoritoNucleo;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;
import br.com.fashionai.application.flair3d.nucleos.SuperHeroiNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.zonas;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — as rodadas de criação do Grupo Ateliê 3D (zonas pintadas, 25 por regra) e as rodadas do Road to Glory, que
 * são os briefs do MAKE UP. Clubes, bandas, equipes e heróis são inventados; a lista de emblemas só tem emblemas próprios.
 */
class Flair3dRodadasZonasTest {
    static final String PRETO = "#151515";
    static final String BRANCO = "#F5F4F0";
    static final String AZUL = "#1E4FBF";
    static final String AMARELO = "#F2C230";
    static final String ROXO = "#7A3FC4";
    static final String VERMELHO = "#C8283A";
    static final String PRATA = "#B9BEC6";
    static final String DOURADO = "#C9A227";

    static Contexto rodada(String codigo) {
        return new Contexto(Map.of(), null, null).naRodada(codigo);
    }

    static List<String> cumpridas(Resultado r) {
        return r.regras().stream().filter(Resultado.RegraResultado::ok).map(Resultado.RegraResultado::codigo).toList();
    }

    @Test
    void clubeAuroraTemNotaPelasZonasEPelasCoresEOUniformeDeEsportsTambem() {
        ClubeCoracaoNucleo n = new ClubeCoracaoNucleo();
        Entrega aurora = zonas(null, "FRENTE=" + VERMELHO, "COSTAS=" + VERMELHO, "MANGAS=" + PRETO, "GOLA=" + PRETO);
        Resultado r = n.pontuar(aurora, rodada("CLUBE_AURORA"));
        assertThat(r.resultado()).isEqualTo("CONCLUIDO");
        assertThat(r.pontos()).isEqualTo(100);
        Resultado noAtlantico = n.pontuar(aurora, rodada(null));
        assertThat(noAtlantico.resultado()).isEqualTo("INCOMPLETO");
        assertThat(noAtlantico.pontos()).isEqualTo(50);
        assertThat(n.definicao().naRodada("CLUBE_AURORA").objetivo().regras()).allMatch(x -> x.pontos() == ClubeCoracaoNucleo.POR_REGRA);

        Entrega time = zonas(null, "FRENTE=" + ROXO, "COSTAS=" + ROXO, "MANGAS=" + PRETO, "GOLA=" + AMARELO);
        Resultado esports = n.pontuar(time, rodada("UNIFORME_ESPORTS"));
        assertThat(esports.pontos()).isEqualTo(100);
        assertThat(esports.estrelas()).isEqualTo(3);
        Entrega brilho = zonas(null, "FRENTE=" + ROXO + "/BRILHANTE", "COSTAS=" + PRETO, "MANGAS=" + PRETO, "GOLA=" + AZUL);
        assertThat(cumpridas(n.pontuar(brilho, rodada("UNIFORME_ESPORTS")))).containsExactly("CORES_DO_TIME");
    }

    @Test
    void eraAcusticaEJaquetaDaBandaConferemCorDominanteEFerragens() {
        FavoriteSingerNucleo n = new FavoriteSingerNucleo();
        Entrega acustica = zonas(null, "FRENTE=" + BRANCO, "COSTAS=" + BRANCO, "MANGAS=" + BRANCO, "GOLA=" + DOURADO);
        assertThat(n.pontuar(acustica, rodada("ERA_ACUSTICA")).pontos()).isEqualTo(100);
        assertThat(n.definicao().naRodada("JAQUETA_DA_BANDA").zonas()).containsExactly("CORPO", "MANGAS", "FERRAGENS", "GOLA");
        Entrega jaqueta = zonas(null, "CORPO=" + PRETO, "MANGAS=" + VERMELHO, "FERRAGENS=" + VERMELHO + "/METALICO", "GOLA=" + PRETO);
        assertThat(n.pontuar(jaqueta, rodada("JAQUETA_DA_BANDA")).pontos()).isEqualTo(100);
        Entrega tresCores = zonas(null, "CORPO=" + PRETO + "/BRILHANTE", "MANGAS=" + BRANCO, "FERRAGENS=" + PRATA, "GOLA=" + AZUL);
        assertThat(n.pontuar(tresCores, rodada("JAQUETA_DA_BANDA")).pontos()).isZero();
    }

    @Test
    void macacaoETenisDosSonhosUsamAsZonasDaRodada() {
        PilotoFavoritoNucleo n = new PilotoFavoritoNucleo();
        assertThat(n.definicao().naRodada("TENIS_DOS_SONHOS").zonas()).containsExactly("CABEDAL", "SOLA", "CADARCO");
        Entrega tenis = zonas(null, "CABEDAL=" + AZUL + "/ESPELHADO", "SOLA=" + BRANCO, "CADARCO=" + BRANCO);
        assertThat(n.pontuar(tenis, rodada("TENIS_DOS_SONHOS")).pontos()).isEqualTo(100);
        Entrega escuro = zonas(null, "CABEDAL=" + PRETO, "SOLA=" + PRETO, "CADARCO=" + PRETO);
        assertThat(cumpridas(n.pontuar(escuro, rodada("TENIS_DOS_SONHOS")))).containsExactly("ATE_2_CORES");
        Entrega macacao = zonas(null, "TRONCO=" + AZUL, "MANGAS=" + BRANCO, "PERNAS=" + BRANCO, "GOLA=" + BRANCO, "CINTO=" + VERMELHO);
        assertThat(n.pontuar(macacao, rodada("MACACAO_BOREAL")).pontos()).isEqualTo(100);
        assertThat(n.pontuar(macacao, rodada(null)).pontos()).isZero();
    }

    @Test
    void arquetiposDoHeroiEListaDeEmblemasSoComEmblemasProprios() {
        SuperHeroiNucleo n = new SuperHeroiNucleo();
        assertThat(n.definicao().opcoes()).containsExactly("EMBLEMA_ESTRELA", "EMBLEMA_RAIO", "EMBLEMA_ASA");
        assertThat(n.definicao().opcoes()).noneMatch(SuperHeroiNucleo.PROTEGIDOS::contains);
        Entrega traje = zonas(null, "PEITO=" + VERMELHO, "CAPA=" + AZUL, "BRACOS=" + AZUL, "PERNAS=" + AZUL);
        assertThat(n.pontuar(traje, rodada("TRAJE_COLANTE")).pontos()).isEqualTo(100);
        Entrega vigilante = zonas(null, "PEITO=" + PRETO, "CAPA=" + PRETO, "BRACOS=" + PRETO, "PERNAS=" + AMARELO);
        assertThat(n.pontuar(vigilante, rodada("VIGILANTE_DA_NOITE")).pontos()).isEqualTo(100);
        Entrega metal = zonas(null, "PEITO=" + AMARELO + "/METALICO", "CAPA=" + VERMELHO, "BRACOS=" + AZUL, "PERNAS=" + BRANCO);
        assertThat(n.pontuar(metal, rodada("VIGILANTE_DA_NOITE")).pontos()).isZero();
    }

    @Test
    void roadToGloryOfereceOsBriefsDoMakeUpComoRodadas() {
        RoadToGloryNucleo n = new RoadToGloryNucleo();
        assertThat(n.definicao().rodadas()).extracting(Definicao.Rodada::codigo).startsWith("ENSAIO_VERAO", "ENTREVISTA", "PRIMEIRO_ENCONTRO");
        Entrega nude = Flair3dFixtures.comMaquiagem(new Entrega(null, null, null, null), "LABIOS", "NUDE", "FOSCO");
        Resultado entrevista = n.previa(nude, rodada("ENTREVISTA"));
        assertThat(cumpridas(entrevista)).containsExactly("LABIOS_NUDE_OU_ROSA", "ACABAMENTO_FOSCO");
        assertThat(entrevista.pontos()).isEqualTo(50);
        assertThat(n.previa(nude, rodada(null)).pontos()).isZero();
    }
}
