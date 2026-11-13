package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair3d.nucleos.ClubeCoracaoNucleo;
import br.com.fashionai.application.flair3d.nucleos.FavoriteSingerNucleo;
import br.com.fashionai.application.flair3d.nucleos.PilotoFavoritoNucleo;
import br.com.fashionai.application.flair3d.nucleos.SuperHeroiNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.zonas;
import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR 3D — os 4 núcleos do editor (zonas com cor e acabamento) e a definição pública dos 15 núcleos. */
class Flair3dNucleosZonasTest {

    static Resultado jogar(Flair3dNucleo n, Entrega e) {
        return n.pontuar(e, contexto(3L));
    }

    @Test
    void clubeCoracaoConcluiSoComTodasAsZonasNasCoresDoClubeESemPlacar() {
        Resultado ok = jogar(new ClubeCoracaoNucleo(), zonas(null, "FRENTE=#2A5FA8", "COSTAS=#FFFFFF", "MANGAS=#2A5FA8", "GOLA=#FFFFFF"));
        assertThat(ok.resultado()).isEqualTo("CONCLUIDO");
        assertThat(ok.pontos()).isZero();
        assertThat(ok.estrelas()).isZero();
        Resultado vermelha = jogar(new ClubeCoracaoNucleo(), zonas(null, "FRENTE=#2A5FA8", "COSTAS=#FFFFFF", "MANGAS=#2A5FA8", "GOLA=#C62B28"));
        assertThat(vermelha.resultado()).isEqualTo("INCOMPLETO");
        Resultado faltando = jogar(new ClubeCoracaoNucleo(), zonas(null, "FRENTE=#2A5FA8", "COSTAS=#FFFFFF"));
        assertThat(faltando.resultado()).isEqualTo("INCOMPLETO");
    }

    @Test
    void favoriteSingerPedeRosaDominanteRoxoMetalEPoucasCores() {
        Resultado neon = jogar(new FavoriteSingerNucleo(),
                zonas(null, "FRENTE=#EFA8BC", "COSTAS=#EFA8BC", "MANGAS=#6B3F9E", "GOLA=#EFA8BC/METALICO"));
        assertThat(neon.pontos()).isEqualTo(100);
        assertThat(neon.estrelas()).isEqualTo(3);
        Resultado azul = jogar(new FavoriteSingerNucleo(), zonas(null, "FRENTE=#2A5FA8", "COSTAS=#2A5FA8"));
        assertThat(azul.pontos()).isEqualTo(25);
    }

    @Test
    void pilotoFavoritoConfereCadaZonaDoCapacete() {
        Resultado aurora = jogar(new PilotoFavoritoNucleo(),
                zonas(null, "TOPO=#E8C93C", "LATERAIS=#E8C93C", "FAIXA_VISEIRA=#2F7A45", "VISEIRA=#C3C6C9/ESPELHADO"));
        assertThat(aurora.pontos()).isEqualTo(100);
        Resultado errado = jogar(new PilotoFavoritoNucleo(), zonas(null, "TOPO=#C62B28", "LATERAIS=#2A5FA8", "VISEIRA=#C3C6C9/FOSCO"));
        assertThat(errado.pontos()).isZero();
    }

    @Test
    void superHeroiRecusaEmblemaProtegido() {
        Resultado armadura = jogar(new SuperHeroiNucleo(),
                zonas("EMBLEMA_ESTRELA", "PEITO=#B8BCC0/METALICO", "CAPA=#C62B28", "BRACOS=#B8BCC0"));
        assertThat(armadura.pontos()).isEqualTo(100);
        Resultado copia = jogar(new SuperHeroiNucleo(),
                zonas("EMBLEMA_MORCEGO", "PEITO=#B8BCC0", "BRACOS=#2A5FA8", "PERNAS=#E8C93C"));
        assertThat(copia.pontos()).isZero();
        assertThat(copia.regras()).allMatch(r -> !r.ok());
    }

    @Test
    void osQuinzeNucleosTemCodigoNumeroEDefinicaoCompleta() {
        assertThat(Flair3dNucleos.TODOS).extracting(Flair3dNucleo::numero).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
        assertThat(Flair3dNucleos.TODOS).extracting(Flair3dNucleo::codigo).doesNotHaveDuplicates();
        for (Flair3dNucleo n : Flair3dNucleos.TODOS) {
            Definicao d = n.definicao();
            assertThat(d.codigo()).isEqualTo(n.codigo());
            assertThat(d.objetivo().regras()).isNotEmpty();
            assertThat(d.acoes()).contains("ENTREGAR", "VER_OBJETIVO");
            assertThat(d.avatares()).isNotNull();
            assertThat(d.avatares().solo()).isNotEmpty();
        }
        assertThat(Flair3dNucleos.porCodigo("passarela")).isPresent();
        assertThat(Flair3dNucleos.porCodigo("NAO_EXISTE")).isEmpty();
    }

    @Test
    void deckSegueATabelaDoContrato() {
        Definicao.Deck passarela = Flair3dNucleos.porCodigo("PASSARELA").orElseThrow().definicao().deck();
        assertThat(passarela.tamanhoMax()).isEqualTo(8);
        assertThat(passarela.obrigatorias()).extracting(Definicao.Obrigatoria::posicao).containsExactly("SUP", "INF", "CAL");
        assertThat(Flair3dNucleos.porCodigo("DRESS_FIGHTER").orElseThrow().definicao().deck().tamanhoMax()).isEqualTo(6);
        assertThat(Flair3dNucleos.porCodigo("LABIRINTO").orElseThrow().definicao().deck().obrigatorias())
                .containsExactly(new Definicao.Obrigatoria("ANY", 3));
        for (String semDeck : List.of("ROAD_TO_GLORY", "CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI")) {
            assertThat(Flair3dNucleos.porCodigo(semDeck).orElseThrow().definicao().deck().semDeck()).as(semDeck).isTrue();
        }
        assertThat(Flair3dNucleos.porCodigo("PASSARELA").orElseThrow().definicao().acoes()).contains("DESFILAR");
        assertThat(Flair3dNucleos.porCodigo("DRESS_FIGHTER").orElseThrow().definicao().acoes()).doesNotContain("DESFILAR");
    }

    @Test
    void avataresDaDefinicaoViramParticipantesDaPartidaSolo() {
        Avatares sports = Flair3dNucleos.porCodigo("FASHION_SPORTS").orElseThrow().definicao().avatares();
        assertThat(sports.online()).isEqualTo(new Avatares.Online(2, 10, 5));
        UUID ana = UUID.randomUUID();
        List<Avatares.Participante> p = sports.participantes(ana, null);
        assertThat(p).hasSize(10);
        assertThat(p.get(0)).isEqualTo(new Avatares.Participante("PROPRIO", "PROTAGONISTA", "A", ana));
        assertThat(p).filteredOn(x -> "ADVERSARIO".equals(x.papel())).hasSize(5).allMatch(x -> "B".equals(x.time()));
        Avatares road = Flair3dNucleos.porCodigo("ROAD_TO_GLORY").orElseThrow().definicao().avatares();
        assertThat(road.online()).isNull();
        assertThat(road.participantes(ana, "MODELO_CASA")).containsExactly(new Avatares.Participante("MODELO_CASA", "PROTAGONISTA", "A", null));
        Avatares clube = Flair3dNucleos.porCodigo("CLUBE_CORACAO").orElseThrow().definicao().avatares();
        assertThat(clube.participantes(ana, null)).containsExactly(new Avatares.Participante("FIGURANTE", "MANEQUIM", null, null));
    }
}
