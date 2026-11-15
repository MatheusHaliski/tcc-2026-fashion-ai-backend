package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;
import java.util.Map;

/**
 * Núcleo 11 — capacete da "Equipe Aurora" (amarelo e verde), 25 por regra: topo amarelo; laterais amarelas; faixa da
 * viseira verde; viseira espelhada.
 */
public class PilotoFavoritoNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA");
    public static final List<String> ZONAS_MACACAO = List.of("TRONCO", "MANGAS", "PERNAS", "GOLA", "CINTO");
    public static final List<String> ZONAS_TENIS = List.of("CABEDAL", "SOLA", "CADARCO");
    /** O macacão da "Equipe Boreal" e o Tênis dos Sonhos (objetivo 49: "tênis para correr à noite"). */
    static final List<AtelieRodadas.Criacao> RODADAS = List.of(
            AtelieRodadas.criacao("MACACAO_BOREAL", ZONAS_MACACAO,
                    AtelieRodadas.regra("TRONCO_AZUL", z -> AtelieRodadas.daFamilia(z, "TRONCO", "Azul")),
                    AtelieRodadas.regra("MANGAS_E_PERNAS_IGUAIS", z -> AtelieRodadas.iguais(z, "MANGAS", "PERNAS")),
                    AtelieRodadas.regra("CINTO_EM_CONTRASTE", z -> AtelieRodadas.contraste(z, "CINTO", "TRONCO")),
                    AtelieRodadas.regra("GOLA_BRANCA", z -> AtelieRodadas.daFamilia(z, "GOLA", "Branco"))),
            AtelieRodadas.criacao("TENIS_DOS_SONHOS", ZONAS_TENIS,
                    AtelieRodadas.regra("SOLA_CLARA", z -> AtelieRodadas.daFamilia(z, "SOLA", "Branco", "Cinza")),
                    AtelieRodadas.regra("ZONA_REFLETIVA", z -> AtelieRodadas.algumAcabamento(z, "ESPELHADO", "METALICO")),
                    AtelieRodadas.regra("CADARCO_EM_CONTRASTE", z -> AtelieRodadas.contraste(z, "CADARCO", "CABEDAL")),
                    AtelieRodadas.regra("ATE_3_CORES", z -> AtelieRodadas.ateCores(z, 3))));

    @Override
    public String codigo() {
        return "PILOTO_FAVORITO";
    }

    @Override
    public int numero() {
        return 11;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(), Definicao.objetivo("EQUIPE_AURORA", new Regra("TOPO_AMARELO", POR_REGRA),
                new Regra("LATERAIS_AMARELAS", POR_REGRA), new Regra("FAIXA_VERDE", POR_REGRA), new Regra("VISEIRA_ESPELHADA", POR_REGRA)),
                ZONAS, List.of()).comRodadas(RODADAS.get(0).rodada(), RODADAS.get(1).rodada());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        for (AtelieRodadas.Criacao c : RODADAS) {
            if (c.codigo().equals(contexto.rodada())) {
                return c.pontuar(entrega);
            }
        }
        Map<String, Entrega.Zona> z = entrega.zonas();
        return Resultado.somando(List.of(
                RegraResultado.de("TOPO_AMARELO", Flair3dZonas.daFamilia(z.get("TOPO"), "Amarelo"), POR_REGRA),
                RegraResultado.de("LATERAIS_AMARELAS", Flair3dZonas.daFamilia(z.get("LATERAIS"), "Amarelo"), POR_REGRA),
                RegraResultado.de("FAIXA_VERDE", Flair3dZonas.daFamilia(z.get("FAIXA_VISEIRA"), "Verde"), POR_REGRA),
                RegraResultado.de("VISEIRA_ESPELHADA", Flair3dZonas.acabamento(z.get("VISEIRA"), Flair3dZonas.ESPELHADO), POR_REGRA)),
                List.of());
    }
}
