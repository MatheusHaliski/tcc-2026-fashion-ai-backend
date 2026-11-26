package br.com.fashionai.application.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Peças do catálogo de marcas vestidas no espelho (RF33 + RF47): só para provar, ao lado das peças do guarda-roupa.
 * Ficam no mesmo {@code slots_json}, na chave {@value #KEY} ({@code {"upper": "<produto>", "accessory": ["<produto>"]}}),
 * para que salvar, usar hoje, Vista-me, "Tira uma coisa" e o editor continuem lendo só as peças da pessoa.
 * <p>
 * O corpo tem um lugar só por parte, seja a peça de quem for: vestir uma tira a outra do mesmo lugar, a peça única tira
 * cima e baixo (e vice-versa) e os acessórios somados não passam de {@link MirrorService#MAX_ACCESSORIES}. Regras puras
 * sobre o mapa; quem lê e grava o estado é o serviço.
 */
final class MirrorCatalogSlots {
    static final String KEY = "catalog";
    static final List<String> SINGLE = List.of("outer_layer", "upper", "dress", "lower", "shoes");

    private MirrorCatalogSlots() {
    }

    /** Lugares que saem do corpo quando este é ocupado: a peça única tira cima e baixo; cima ou baixo tiram a peça única. */
    static List<String> excluded(String slot) {
        return switch (slot) {
            case "dress" -> List.of("upper", "lower");
            case "upper", "lower" -> List.of("dress");
            default -> List.of();
        };
    }

    /** Cópia mutável das referências do catálogo (lugar → id; acessórios em lista). */
    static Map<String, Object> catalog(Map<String, Object> slots) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (slots.get(KEY) instanceof Map<?, ?> m) {
            m.forEach((k, v) -> out.put(String.valueOf(k), v));
        }
        return out;
    }

    static UUID single(Map<String, Object> slots, String slot) {
        return MirrorService.single(catalog(slots), slot);
    }

    static List<UUID> accessories(Map<String, Object> slots) {
        return MirrorService.accessories(catalog(slots));
    }

    /** Todos os produtos vestidos, de cima para baixo e os acessórios no fim. */
    static List<UUID> all(Map<String, Object> slots) {
        Map<String, Object> cat = catalog(slots);
        List<UUID> ids = new ArrayList<>();
        SINGLE.stream().map(slot -> MirrorService.single(cat, slot)).filter(id -> id != null).forEach(ids::add);
        ids.addAll(MirrorService.accessories(cat));
        return ids;
    }

    /** Veste o produto no lugar dele: sai o que ocupava o lugar (e o que ele exclui), seja do guarda-roupa ou do catálogo. */
    static void wear(Map<String, Object> slots, String slot, UUID productId) {
        Map<String, Object> cat = catalog(slots);
        if (slot.equals("accessory")) {
            List<String> acc = strings(MirrorService.accessories(cat));
            if (!acc.contains(productId.toString())) {
                List<String> own = strings(MirrorService.accessories(slots));
                // passa do teto: sai primeiro o produto provado há mais tempo; sem produto, o acessório mais antigo da pessoa
                while (!acc.isEmpty() && acc.size() + own.size() >= MirrorService.MAX_ACCESSORIES) {
                    acc.remove(0);
                }
                while (!own.isEmpty() && acc.size() + own.size() >= MirrorService.MAX_ACCESSORIES) {
                    own.remove(0);
                }
                slots.put("accessory", own);
                acc.add(productId.toString());
            }
            cat.put("accessory", acc);
        } else {
            slots.remove(slot);
            cat.put(slot, productId.toString());
            for (String other : excluded(slot)) {
                slots.remove(other);
                cat.remove(other);
            }
        }
        store(slots, cat);
    }

    /**
     * A peça do guarda-roupa manda: o produto do catálogo que divide o lugar com uma peça da pessoa (ou que ela exclui) sai,
     * e os acessórios do catálogo passam a caber no teto. Vale depois de vestir uma peça e como conserto do estado gravado.
     * @return se alguma referência saiu
     */
    static boolean yieldToWardrobe(Map<String, Object> slots) {
        Map<String, Object> cat = catalog(slots);
        if (cat.isEmpty()) {
            return false;
        }
        int before = all(slots).size();
        for (String slot : SINGLE) {
            if (MirrorService.single(slots, slot) != null) {
                cat.remove(slot);
                excluded(slot).forEach(cat::remove);
            }
        }
        List<String> acc = strings(MirrorService.accessories(cat));
        int own = MirrorService.accessories(slots).size();
        while (!acc.isEmpty() && acc.size() + own > MirrorService.MAX_ACCESSORIES) {
            acc.remove(0);
        }
        cat.put("accessory", acc);
        store(slots, cat);
        return all(slots).size() != before;
    }

    /** Tira o produto de onde estiver. @return se estava vestido */
    static boolean remove(Map<String, Object> slots, UUID productId) {
        return retainOnly(slots, all(slots).stream().filter(id -> !id.equals(productId)).toList());
    }

    /** Fica só com os produtos dados (os que continuam no catálogo). @return se algum saiu */
    static boolean retainOnly(Map<String, Object> slots, Collection<UUID> keep) {
        Map<String, Object> cat = catalog(slots);
        int before = all(slots).size();
        for (String slot : SINGLE) {
            UUID id = MirrorService.single(cat, slot);
            if (id == null || !keep.contains(id)) {
                cat.remove(slot);
            }
        }
        cat.put("accessory", strings(MirrorService.accessories(cat).stream().filter(keep::contains).toList()));
        store(slots, cat);
        return all(slots).size() != before;
    }

    private static List<String> strings(List<UUID> ids) {
        return ids.stream().map(UUID::toString).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    /** Grava as referências de volta; sem nenhuma, a chave sai do estado. */
    private static void store(Map<String, Object> slots, Map<String, Object> cat) {
        boolean noAccessory = !(cat.get("accessory") instanceof List<?> l) || l.isEmpty();
        if (noAccessory) {
            cat.remove("accessory");
        }
        if (cat.isEmpty()) {
            slots.remove(KEY);
        } else {
            slots.put(KEY, cat);
        }
    }
}
