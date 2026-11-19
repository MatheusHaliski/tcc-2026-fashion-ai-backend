package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;

import java.util.List;

/**
 * Núcleo 9 — peça da "Era Neon", 25 por regra: rosa dominante (mais zonas rosa que de qualquer outra família); roxo em
 * uma zona; 1 zona metálica; até 3 cores (hex distintos).
 */
public class FavoriteSingerNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("FRENTE", "COSTAS", "MANGAS", "GOLA");
    public static final List<String> ZONAS_JAQUETA = List.of("CORPO", "MANGAS", "FERRAGENS", "GOLA");
    /** A rodada padrão: rosa dominante e até 3 cores falam da peça inteira; o roxo e a zona metálica, de uma zona. */
    static final AtelieRodadas.Criacao ERA_NEON = AtelieRodadas.criacao("ERA_NEON", ZONAS,
            AtelieRodadas.conjunto("ROSA_DOMINANTE", z -> AtelieRodadas.dominante(z, "Rosa")),
            AtelieRodadas.regra("ROXO_EM_UMA_ZONA", z -> ZONAS.stream().anyMatch(zona -> AtelieRodadas.daFamilia(z, zona, "Roxo"))),
            AtelieRodadas.regra("ZONA_METALICA", z -> AtelieRodadas.algumAcabamento(z, "METALICO")),
            AtelieRodadas.conjunto("ATE_3_CORES", z -> AtelieRodadas.ateCores(z, 3)));
    /** A "Era Acústica" (branco, um toque dourado, tudo fosco) e a Jaqueta da Banda (objetivo 50), de uma banda inventada. */
    static final List<AtelieRodadas.Criacao> RODADAS = List.of(
            AtelieRodadas.criacao("ERA_ACUSTICA", ZONAS,
                    AtelieRodadas.conjunto("BRANCO_DOMINANTE", z -> AtelieRodadas.dominante(z, "Branco")),
                    AtelieRodadas.regra("TOQUE_DOURADO", z -> ZONAS.stream().anyMatch(zona -> AtelieRodadas.daFamilia(z, zona, "Amarelo"))),
                    AtelieRodadas.conjunto("TUDO_FOSCO", z -> !AtelieRodadas.algumAcabamento(z, "BRILHANTE", "METALICO", "ESPELHADO")),
                    AtelieRodadas.conjunto("ATE_2_CORES", z -> AtelieRodadas.ateCores(z, 2))),
            AtelieRodadas.criacao("JAQUETA_DA_BANDA", ZONAS_JAQUETA,
                    AtelieRodadas.regra("CORPO_PRETO_FOSCO", z -> AtelieRodadas.daFamilia(z, "CORPO", "Preto")
                            && !AtelieRodadas.acabamento(z, "CORPO", "BRILHANTE", "METALICO", "ESPELHADO")),
                    AtelieRodadas.regra("DESTAQUE_NAS_MANGAS", z -> AtelieRodadas.familia(z, "MANGAS") != null
                            && !AtelieRodadas.SEM_COR.contains(AtelieRodadas.familia(z, "MANGAS"))),
                    AtelieRodadas.regra("FERRAGENS_METALICAS", z -> AtelieRodadas.acabamento(z, "FERRAGENS", "METALICO")),
                    AtelieRodadas.conjunto("ATE_2_CORES", z -> AtelieRodadas.ateCores(z, 2))));

    @Override
    public String codigo() {
        return "FAVORITE_SINGER";
    }

    @Override
    public int numero() {
        return 9;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(), Definicao.objetivo("ERA_NEON", new Regra("ROSA_DOMINANTE", POR_REGRA),
                new Regra("ROXO_EM_UMA_ZONA", POR_REGRA), new Regra("ZONA_METALICA", POR_REGRA), new Regra("ATE_3_CORES", POR_REGRA)),
                ZONAS, List.of()).comRodadas(RODADAS.get(0).rodada(), RODADAS.get(1).rodada());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        for (AtelieRodadas.Criacao c : RODADAS) {
            if (c.codigo().equals(contexto.rodada())) {
                return c.pontuar(entrega);
            }
        }
        return ERA_NEON.pontuar(entrega);
    }
}
