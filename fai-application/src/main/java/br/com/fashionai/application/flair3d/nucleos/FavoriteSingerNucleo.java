package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Núcleo 9 — peça da "Era Neon", 25 por regra: rosa dominante (mais zonas rosa que de qualquer outra família); roxo em
 * uma zona; 1 zona metálica; até 3 cores (hex distintos).
 */
public class FavoriteSingerNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("FRENTE", "COSTAS", "MANGAS", "GOLA");

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
                ZONAS, List.of());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, Integer> porFamilia = new HashMap<>();
        List<Entrega.Zona> zonas = ZONAS.stream().map(entrega.zonas()::get).filter(Objects::nonNull).toList();
        zonas.stream().map(Flair3dZonas::familia).filter(Objects::nonNull).forEach(f -> porFamilia.merge(f, 1, Integer::sum));
        int rosa = porFamilia.getOrDefault("Rosa", 0);
        boolean dominante = rosa > 0 && porFamilia.entrySet().stream().noneMatch(e -> !"Rosa".equals(e.getKey()) && e.getValue() >= rosa);
        boolean metalica = zonas.stream().anyMatch(z -> Flair3dZonas.acabamento(z, Flair3dZonas.METALICO));
        long cores = zonas.stream().map(Flair3dZonas::hex).filter(Objects::nonNull).distinct().count();
        return Resultado.somando(List.of(RegraResultado.de("ROSA_DOMINANTE", dominante, POR_REGRA),
                RegraResultado.de("ROXO_EM_UMA_ZONA", porFamilia.getOrDefault("Roxo", 0) >= 1, POR_REGRA),
                RegraResultado.de("ZONA_METALICA", metalica, POR_REGRA),
                RegraResultado.de("ATE_3_CORES", cores >= 1 && cores <= 3, POR_REGRA)), List.of());
    }
}
