package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.domain.model.FlairCardInstance;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Cartas de teste do FLAIR 3D descritas por etiquetas: "color:blue", "style:y2k", "occasion:party", "material:leather",
 * "brand:Farm", "sub:heels", "tier:OURO", "ovr:70". Marcas "Farm" e "Osklen" são brasileiras no {@link #contexto}.
 */
public final class Flair3dFixtures {
    public static final Set<String> MARCAS_BR = Set.of("Farm", "Osklen");

    private Flair3dFixtures() {
    }

    public static CbcRules.Card card(String position, String... etiquetas) {
        Map<String, Set<String>> tags = tags(etiquetas);
        String tier = one(tags, "tier", "BRONZE");
        int ovr = Integer.parseInt(one(tags, "ovr", "60"));
        return new CbcRules.Card(UUID.randomUUID(), position, tier, ovr, one(tags, "brand", null), "SEED", tags.get("style"),
                tags.get("color"), tags.get("occasion"), tags.get("material"), Map.of(), null, null, category(position), one(tags, "sub", null));
    }

    /** Contexto com as cartas dadas, marcas BR de {@link #MARCAS_BR} e sorteio de semente fixa. */
    public static Contexto contexto(long semente, CbcRules.Card... cartas) {
        Map<UUID, CbcRules.Card> m = new LinkedHashMap<>();
        for (CbcRules.Card c : cartas) {
            m.put(c.id(), c);
        }
        return new Contexto(m, marca -> MARCAS_BR.contains(marca) ? "BR" : "IT", new Random(semente));
    }

    /** Entrega com as cartas por vaga (cada carta na vaga da posição dela). */
    public static Entrega vestir(CbcRules.Card... cartas) {
        Map<String, UUID> m = new LinkedHashMap<>();
        for (CbcRules.Card c : cartas) {
            m.put(c.position(), c.id());
        }
        return new Entrega(m, null, null, null);
    }

    public static Entrega comMaquiagem(Entrega e, String area, String familia, String acabamento) {
        Map<String, Entrega.Maquiagem> m = new LinkedHashMap<>(e.maquiagem());
        m.put(area, new Entrega.Maquiagem(familia, acabamento));
        return new Entrega(e.cartas(), e.zonas(), m, e.resposta());
    }

    /** Zonas "ZONA=#RRGGBB/ACABAMENTO" (acabamento opcional, padrão FOSCO), com a resposta dada. */
    public static Entrega zonas(String resposta, String... zonas) {
        Map<String, Entrega.Zona> m = new LinkedHashMap<>();
        for (String z : zonas) {
            String[] kv = z.split("=");
            String[] cor = kv[1].split("/");
            m.put(kv[0], new Entrega.Zona(cor[0], cor.length > 1 ? cor[1] : "FOSCO"));
        }
        return new Entrega(null, m, null, resposta);
    }

    /** A carta FLAIR (entidade) de uma pessoa com as mesmas etiquetas, para os testes de serviço. */
    public static FlairCardInstance instance(UUID owner, String position, String... etiquetas) {
        Map<String, Set<String>> tags = tags(etiquetas);
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(owner);
        c.setCreatorId(owner);
        c.setOriginType("SEED");
        c.setSeason("SPRING");
        c.setTier(one(tags, "tier", "BRONZE"));
        c.setOvr(Integer.parseInt(one(tags, "ovr", "60")));
        c.setPosition(position);
        c.setName("carta " + position);
        c.setBrandName(one(tags, "brand", null));
        c.setCategory(category(position));
        c.setSubcategory(one(tags, "sub", null));
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("styles", List.copyOf(tags.get("style")));
        json.put("colors", List.copyOf(tags.get("color")));
        json.put("occasions", List.copyOf(tags.get("occasion")));
        json.put("materials", List.copyOf(tags.get("material")));
        c.setTagsJson(Json.write(json));
        return c;
    }

    static Map<String, Set<String>> tags(String... etiquetas) {
        Map<String, Set<String>> tags = new LinkedHashMap<>();
        for (String k : List.of("style", "color", "occasion", "material", "brand", "sub", "tier", "ovr")) {
            tags.put(k, new HashSet<>());
        }
        for (String e : etiquetas) {
            String[] kv = e.split(":", 2);
            tags.get(kv[0]).add(kv[1]);
        }
        return tags;
    }

    static String one(Map<String, Set<String>> tags, String key, String padrao) {
        return tags.get(key).stream().findFirst().orElse(padrao);
    }

    static String category(String position) {
        return switch (position) {
            case "SUP" -> "upper_piece";
            case "INF" -> "lower_piece";
            case "CAL" -> "shoes_piece";
            case "VES" -> "full_body_piece";
            default -> "accessory_piece";
        };
    }
}
