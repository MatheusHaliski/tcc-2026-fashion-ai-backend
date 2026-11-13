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
import java.util.Objects;
import java.util.Set;

/**
 * Núcleo 13 — arquétipo "armadura", 25 por regra: peito metálico; até 2 cores (hex distintos); capa presente; nenhum
 * emblema protegido (a resposta é o emblema escolhido entre as opções; sem emblema também vale).
 */
public class SuperHeroiNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("PEITO", "CAPA", "BRACOS", "PERNAS");
    public static final List<String> OPCOES = List.of("EMBLEMA_ESTRELA", "EMBLEMA_RAIO", "EMBLEMA_ASA", "EMBLEMA_MORCEGO", "EMBLEMA_ESCUDO_S");
    /** Emblemas que imitam marcas registradas de heróis existentes: não podem ser usados. */
    public static final Set<String> PROTEGIDOS = Set.of("EMBLEMA_MORCEGO", "EMBLEMA_ESCUDO_S");

    @Override
    public String codigo() {
        return "SUPER_HEROI";
    }

    @Override
    public int numero() {
        return 13;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(), Definicao.objetivo("ARMADURA", new Regra("PEITO_METALICO", POR_REGRA),
                new Regra("ATE_2_CORES", POR_REGRA), new Regra("CAPA", POR_REGRA), new Regra("SEM_EMBLEMA_PROTEGIDO", POR_REGRA)),
                ZONAS, OPCOES);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        List<Entrega.Zona> zonas = ZONAS.stream().map(entrega.zonas()::get).filter(Objects::nonNull).toList();
        long cores = zonas.stream().map(Flair3dZonas::hex).filter(Objects::nonNull).distinct().count();
        return Resultado.somando(List.of(
                RegraResultado.de("PEITO_METALICO", Flair3dZonas.acabamento(entrega.zonas().get("PEITO"), Flair3dZonas.METALICO), POR_REGRA),
                RegraResultado.de("ATE_2_CORES", cores >= 1 && cores <= 2, POR_REGRA),
                RegraResultado.de("CAPA", Flair3dZonas.hex(entrega.zonas().get("CAPA")) != null, POR_REGRA),
                RegraResultado.de("SEM_EMBLEMA_PROTEGIDO", !PROTEGIDOS.contains(entrega.resposta()), POR_REGRA)), List.of());
    }
}
