package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;

import java.util.List;

/**
 * Núcleo 11 — capacete da "Equipe Aurora" (amarelo e verde), 25 por regra: topo amarelo; laterais amarelas; faixa da
 * viseira verde; viseira espelhada.
 */
public class PilotoFavoritoNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA");
    public static final List<String> ZONAS_MACACAO = List.of("TRONCO", "MANGAS", "PERNAS", "GOLA", "CINTO");
    public static final List<String> ZONAS_TENIS = List.of("CABEDAL", "SOLA", "CADARCO");
    /** A rodada padrão: cada regra olha uma zona do capacete. */
    static final AtelieRodadas.Criacao EQUIPE_AURORA = AtelieRodadas.criacao("EQUIPE_AURORA", ZONAS,
            AtelieRodadas.regra("TOPO_AMARELO", z -> AtelieRodadas.daFamilia(z, "TOPO", "Amarelo")),
            AtelieRodadas.regra("LATERAIS_AMARELAS", z -> AtelieRodadas.daFamilia(z, "LATERAIS", "Amarelo")),
            AtelieRodadas.regra("FAIXA_VERDE", z -> AtelieRodadas.daFamilia(z, "FAIXA_VISEIRA", "Verde")),
            AtelieRodadas.regra("VISEIRA_ESPELHADA", z -> AtelieRodadas.acabamento(z, "VISEIRA", "ESPELHADO")));
    /**
     * O macacão da "Equipe Boreal" e o Tênis dos Sonhos (objetivo 49: "tênis para correr à noite"). O tênis tem 3 zonas: o
     * limite é de 2 cores (com 3, a regra saía cumprida em qualquer pintura).
     */
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
                    AtelieRodadas.conjunto("ATE_2_CORES", z -> AtelieRodadas.ateCores(z, 2))));

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
        return EQUIPE_AURORA.pontuar(entrega);
    }
}
