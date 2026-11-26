package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Elenco em quebra-cabeça descrito por dados: o código, uma vaga por peça da imagem e os requisitos do deck. A forma das
 * peças (quadrantes, encaixes, setores ou cacos) é só do desenho e mora no front (lib/flair/elencos/quebra-cabecas.ts).
 */
public record QuebraCabeca(String codigo, List<Vaga> vagas, List<Requisito> requisitos) implements FlairCbcElenco {
    public QuebraCabeca {
        vagas = List.copyOf(vagas);
        requisitos = List.copyOf(requisitos);
    }

    /**
     * Um elenco com as vagas p1, p2... na ordem dos pedidos: "color:red", "style:modern", "occasion:party" ou "" (a peça
     * aceita qualquer carta). Toda vaga aceita carta de qualquer posição.
     */
    public static QuebraCabeca de(String codigo, List<Requisito> requisitos, String... pedidos) {
        List<Vaga> vagas = new ArrayList<>();
        for (int i = 0; i < pedidos.length; i++) {
            String p = pedidos[i];
            Map<String, Object> pede = p.isEmpty() ? Map.of() : Map.of(p.substring(0, p.indexOf(':')), List.of(p.substring(p.indexOf(':') + 1)));
            vagas.add(new Vaga("p" + (i + 1), "ANY", pede));
        }
        return new QuebraCabeca(codigo, vagas, requisitos);
    }

    /** Os mesmos pedidos repetidos n vezes em sequência (atalho para decks grandes). */
    public static String[] repetir(int n, String... ciclo) {
        String[] out = new String[n];
        for (int i = 0; i < n; i++) {
            out[i] = ciclo[i % ciclo.length];
        }
        return out;
    }
}
