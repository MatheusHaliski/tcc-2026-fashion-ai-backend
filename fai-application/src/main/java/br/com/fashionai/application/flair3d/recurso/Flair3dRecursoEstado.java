package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Os recursos de uma partida a partir das peças usadas (Andamento.usos): começa na reserva inicial e soma cada uso, com
 * vida, energia e foco de 0 a 100. Recalculado sempre do zero, como o resto da partida: o mesmo andamento dá o mesmo
 * estado. Puro.
 */
public final class Flair3dRecursoEstado {
    private Flair3dRecursoEstado() {
    }

    /** A reserva com que toda partida começa: há espaço para a peça usada encher o medidor. */
    public static final Map<Recurso, Integer> INICIAL = Map.of(Recurso.VIDA, 60, Recurso.ENERGIA, 40, Recurso.FOCO, 40, Recurso.MOEDAS, 0);
    public static final int MAXIMO = 100;

    public static EnumMap<Recurso, Integer> de(List<UsoDeRecurso> usos) {
        EnumMap<Recurso, Integer> e = new EnumMap<>(INICIAL);
        for (UsoDeRecurso u : usos) {
            Recurso r = Recurso.valueOf(u.recurso());
            e.put(r, somar(r, e.get(r), u.quantidade()));
        }
        return e;
    }

    /** Vida, energia e foco param em 100; moedas não têm teto. */
    static int somar(Recurso r, int atual, int quantidade) {
        int total = Math.max(0, atual + quantidade);
        return r == Recurso.MOEDAS ? total : Math.min(MAXIMO, total);
    }

    public static long usosDa(UUID carta, List<UsoDeRecurso> usos) {
        return usos.stream().filter(u -> u.carta().equals(carta)).count();
    }

    /** {VIDA: 60, ENERGIA: 40, FOCO: 40, MOEDAS: 0}, na ordem do enum. */
    public static Map<String, Integer> paraTela(EnumMap<Recurso, Integer> estado) {
        Map<String, Integer> out = new LinkedHashMap<>();
        estado.forEach((r, v) -> out.put(r.name(), v));
        return out;
    }
}
