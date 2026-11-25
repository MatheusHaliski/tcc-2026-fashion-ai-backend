package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A "peça virtual" dos jogos de zonas (Clube do Coração, My Favorite Singer, Meu Piloto Favorito, Meu Super-Herói):
 * cada zona pintada vira uma peça para a regra peça-recurso — a vaga sai da zona (a gola e as mangas são parte de cima;
 * a capa é peça inteira; o capacete é acessório), a cor sai da família da zona e o acabamento faz as vezes do material
 * (fosco é algodão, brilhante é cetim, metálico e espelhado são metal; a viseira espelhada esconde como óculos). Puro.
 */
public final class Flair3dPecaVirtual {
    private Flair3dPecaVirtual() {
    }

    /** A vaga de cada zona; zona fora da tabela é parte de cima. */
    static final Map<String, String> VAGA = Map.of("CAPA", "VES", "PERNAS", "INF", "TOPO", "ACE", "LATERAIS", "ACE",
            "FAIXA_VISEIRA", "ACE", "VISEIRA", "ACE");

    /** Uma cor da Taxonomy por família (a primeira de cada uma), para a peça virtual ter a família da zona. */
    static final Map<String, String> COR_DA_FAMILIA = new LinkedHashMap<>();

    static {
        Taxonomy.COLOR_FAMILY.forEach((cor, familia) -> COR_DA_FAMILIA.putIfAbsent(familia, cor));
    }

    static String material(String acabamento) {
        if (acabamento == null) return "cotton";
        return switch (acabamento) {
            case "BRILHANTE" -> "satin";
            case Flair3dZonas.METALICO, Flair3dZonas.ESPELHADO -> "metal";
            default -> "cotton";
        };
    }

    /** As peças virtuais das zonas pintadas (zona sem cor não conta), por zona. */
    public static Map<String, CbcRules.Card> daZonas(String jogo, Map<String, Entrega.Zona> zonas) {
        Map<String, CbcRules.Card> out = new LinkedHashMap<>();
        zonas.forEach((zona, z) -> {
            if (Flair3dZonas.hex(z) == null) return;
            String vaga = VAGA.getOrDefault(zona, "SUP");
            String familia = Flair3dZonas.familia(z);
            Set<String> cores = familia != null && COR_DA_FAMILIA.containsKey(familia) ? Set.of(COR_DA_FAMILIA.get(familia)) : Set.of();
            String sub = zona.startsWith("VISEIRA") && Flair3dZonas.ESPELHADO.equals(z.acabamento()) ? "sunglasses" : null;
            UUID id = UUID.nameUUIDFromBytes((jogo + ":" + zona).getBytes(StandardCharsets.UTF_8));
            out.put(vaga + ":" + zona, new CbcRules.Card(id, vaga, "BRONZE", 60, null, "VIRTUAL", Set.of(), cores, Set.of(),
                    Set.of(material(z.acabamento())), Map.of(), null, null, null, sub));
        });
        return out;
    }
}
