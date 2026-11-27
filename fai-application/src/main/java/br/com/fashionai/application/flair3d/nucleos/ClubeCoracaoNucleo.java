package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Núcleo 8 — camisa do "Clube Atlântico" (azul e branco): {@value #POR_REGRA} por todas as zonas pintadas e
 * {@value #POR_REGRA} pelas cores do clube (só as 2, e as 2 aparecem); CONCLUIDO com as duas. Antes era o modo
 * artístico sem placar; a nota (reauditoria de 25/11/2026) faz o look e a execução no percurso valerem nos clubes.
 */
public class ClubeCoracaoNucleo implements Flair3dNucleo {
    public static final List<String> ZONAS = List.of("FRENTE", "COSTAS", "MANGAS", "GOLA");
    /** Cada uma das duas regras da camisa do clube. */
    public static final double POR_REGRA = 50;
    public static final Set<String> CORES = Set.of("Azul", "Branco");
    public static final String AURORA = "CLUBE_AURORA";
    public static final Set<String> CORES_AURORA = Set.of("Vermelho", "Preto");
    /** Uniforme de E-sports do time inventado "Vórtex" (roxo e preto, destaque amarelo): a rodada com nota do modo. */
    static final List<AtelieRodadas.Criacao> RODADAS = List.of(AtelieRodadas.criacao("UNIFORME_ESPORTS", ZONAS,
            AtelieRodadas.regra("CORES_DO_TIME", z -> List.of("FRENTE", "COSTAS", "MANGAS").stream().allMatch(zona -> AtelieRodadas.daFamilia(z, zona, "Roxo", "Preto"))
                    && List.of("Roxo", "Preto").stream().allMatch(f -> List.of("FRENTE", "COSTAS", "MANGAS").stream().anyMatch(zona -> AtelieRodadas.daFamilia(z, zona, f)))),
            AtelieRodadas.regra("GOLA_DESTAQUE", z -> AtelieRodadas.daFamilia(z, "GOLA", "Amarelo")),
            AtelieRodadas.regra("COSTAS_IGUAL_FRENTE", z -> AtelieRodadas.iguais(z, "FRENTE", "COSTAS")),
            AtelieRodadas.conjunto("TUDO_FOSCO", z -> !AtelieRodadas.algumAcabamento(z, "BRILHANTE", "METALICO", "ESPELHADO"))));

    @Override
    public String codigo() {
        return "CLUBE_CORACAO";
    }

    @Override
    public int numero() {
        return 8;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(),
                Definicao.objetivo("CLUBE_ATLANTICO", new Regra("TODAS_AS_ZONAS", POR_REGRA), new Regra("CORES_DO_CLUBE", POR_REGRA)), ZONAS, List.of())
                .comRodadas(Definicao.Rodada.de(AURORA, new Regra("TODAS_AS_ZONAS", POR_REGRA), new Regra("CORES_DO_CLUBE", POR_REGRA)).comZonas(ZONAS),
                        RODADAS.get(0).rodada());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        for (AtelieRodadas.Criacao c : RODADAS) {
            if (c.codigo().equals(contexto.rodada())) {
                return c.pontuar(entrega);
            }
        }
        Set<String> doClube = AURORA.equals(contexto.rodada()) ? CORES_AURORA : CORES;
        Set<String> usadas = new HashSet<>();
        boolean todas = true;
        boolean soDoClube = true;
        for (String zona : ZONAS) {
            String familia = Flair3dZonas.familia(entrega.zonas().get(zona));
            todas &= familia != null;
            soDoClube &= familia == null || doClube.contains(familia);
            if (familia != null) {
                usadas.add(familia);
            }
        }
        boolean cores = soDoClube && usadas.containsAll(doClube);
        List<RegraResultado> regras = List.of(RegraResultado.de("TODAS_AS_ZONAS", todas, POR_REGRA), RegraResultado.de("CORES_DO_CLUBE", cores, POR_REGRA));
        double pontos = regras.stream().mapToDouble(RegraResultado::pontos).sum();
        return Resultado.of(pontos, todas && cores ? "CONCLUIDO" : "INCOMPLETO", regras, AtelieRodadas.faltas(entrega, ZONAS));
    }
}
