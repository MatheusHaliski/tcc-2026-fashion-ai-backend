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
 * Núcleo 8 — camisa do "Clube Atlântico" (azul e branco). Modo artístico: sem placar (0 pontos, 0 estrelas); CONCLUIDO
 * quando todas as zonas estão pintadas só com as 2 cores do clube e as 2 aparecem.
 */
public class ClubeCoracaoNucleo implements Flair3dNucleo {
    public static final List<String> ZONAS = List.of("FRENTE", "COSTAS", "MANGAS", "GOLA");
    public static final Set<String> CORES = Set.of("Azul", "Branco");

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
                Definicao.objetivo("CLUBE_ATLANTICO", new Regra("TODAS_AS_ZONAS", 0), new Regra("CORES_DO_CLUBE", 0)), ZONAS, List.of());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Set<String> usadas = new HashSet<>();
        boolean todas = true;
        boolean soDoClube = true;
        for (String zona : ZONAS) {
            String familia = Flair3dZonas.familia(entrega.zonas().get(zona));
            todas &= familia != null;
            soDoClube &= familia == null || CORES.contains(familia);
            if (familia != null) {
                usadas.add(familia);
            }
        }
        boolean cores = soDoClube && usadas.containsAll(CORES);
        List<RegraResultado> regras = List.of(RegraResultado.de("TODAS_AS_ZONAS", todas, 0), RegraResultado.de("CORES_DO_CLUBE", cores, 0));
        return Resultado.of(0, todas && cores ? "CONCLUIDO" : "INCOMPLETO", regras, List.of());
    }
}
