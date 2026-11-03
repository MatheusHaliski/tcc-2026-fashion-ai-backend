package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeQueryService.RankGroup;
import br.com.fashionai.application.security.CurrentUser;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.hype.HypeQueryService.MAX_GROUP_KEYS;
import static br.com.fashionai.application.hype.HypeQueryService.MIN_GROUP_ITEMS;
import static br.com.fashionai.application.hype.HypeQueryService.brandKey;
import static br.com.fashionai.application.hype.HypeRankFilters.blank;

/** HypeScore v2 — agregados por chave (chips de criador e de marca): a tabela completa do tipo e o item do lote. */
final class HypeGroupChips {
    private final HypeReadCore core;
    private final HypeGroupRanking ranking;

    HypeGroupChips(HypeReadCore core, HypeGroupRanking ranking) {
        this.core = core;
        this.ranking = ranking;
    }

    // ================================================================== agregados por chave (Lote A1: chips de criador e de marca)
    /*
     * GET /api/hype/groups?type=CREATOR|BRAND&keys=a,b,c — o Hype agregado de várias marcas (chave = nome normalizado) ou
     * pessoas (chave = id) numa requisição, para os chips da busca, dos perfis e de /brands. Mesma régua do "Em alta":
     * só itens públicos elegíveis; o grupo é suficiente com ≥ 3 itens públicos e o valor é a média dos seus 5 itens mais
     * relevantes; {@code rank} é a posição no ranking público completo do tipo (sem recorte). Janela 7 (HypeScore atual)
     * ou 30 (média do mês); a 1 (trend) cai em 7, porque o chip fala de Hype, e crescimento não é Hype. A tabela completa
     * vai para o HypeCache por geração (GET nunca recalcula); o bloqueio entre quem vê e o criador é aplicado depois:
     * a chave bloqueada some da resposta, como se não houvesse dado. Criador que saiu de "Criadores em alta" (P3-12) volta
     * como sem dados: sem valor, sem faixa e sem posição (nunca 0).
     */

    Map<String, Object> groups(CurrentUser viewer, RankGroup group, Collection<String> rawKeys, int window) {
        int win = window >= 30 ? 30 : 7;
        List<String> keys = groupKeys(group, rawKeys);
        Map<String, Object> table = keys.isEmpty() ? Map.of() : core.cache.get("groups-table:" + group + ":" + win, () -> groupTable(group, win));
        Map<?, ?> rows = table.get("rows") instanceof Map<?, ?> m ? m : Map.of();
        Map<String, Object> items = new LinkedHashMap<>();
        for (String k : keys) {
            if (group == RankGroup.CREATOR && !core.guard.canView(viewer, UUID.fromString(k), br.com.fashionai.domain.model.enums.Visibility.PUBLIC)) {
                continue;   // bloqueio (em qualquer direção): nada de chip, como se não existisse
            }
            items.put(k, rows.get(k) instanceof Map<?, ?> row ? groupView(row) : emptyGroup(k));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", group.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("minItems", MIN_GROUP_ITEMS);
        out.put("total", table.get("ranked") instanceof Number n ? n.intValue() : 0);
        out.put("items", items);
        return out;
    }

    /** Chaves válidas, distintas e no limite do lote: marca = nome normalizado; criador = id (malformado é ignorado). */
    static List<String> groupKeys(RankGroup group, Collection<String> raw) {
        if (raw == null) {
            return List.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String k : raw) {
            if (blank(k) || out.size() >= MAX_GROUP_KEYS) {
                continue;
            }
            if (group == RankGroup.BRAND) {
                out.add(brandKey(k));
            } else {
                try {
                    out.add(UUID.fromString(k.trim()).toString());
                } catch (IllegalArgumentException ignored) {
                    // id malformado: ignorado (o lote continua)
                }
            }
        }
        return new ArrayList<>(out);
    }

    /** Tabela completa do tipo (todas as chaves, com a posição dos suficientes); independe de quem vê. */
    Map<String, Object> groupTable(RankGroup group, int win) {
        Map<String, Object> rows = new LinkedHashMap<>();
        int rank = 0;
        for (Map<String, Object> m : ranking.groupRows(group, win, null, null, null)) {
            Map<String, Object> r = new LinkedHashMap<>(m);
            r.remove("user");   // o chip já tem a identidade de quem aparece; a tabela guarda só o agregado
            r.put("rank", Boolean.TRUE.equals(m.get("sufficient")) ? ++rank : null);
            rows.put(String.valueOf(m.get("key")), r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ranked", rank);
        out.put("rows", rows);
        return out;
    }

    /** Item do lote: só o agregado (sem o resumo do item de destaque, que é coisa do ranking). */
    static Map<String, Object> groupView(Map<?, ?> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String f : List.of("key", "name", "slug", "logoUrl", "ownerId")) {
            if (row.get(f) != null) {
                m.put(f, row.get(f));
            }
        }
        boolean sufficient = Boolean.TRUE.equals(row.get("sufficient"));
        m.put("sufficient", sufficient);
        m.put("value", sufficient ? row.get("value") : null);
        m.put("level", sufficient ? row.get("level") : null);
        m.put("rank", sufficient ? row.get("rank") : null);
        m.put("items", row.get("items") instanceof Number n ? n.intValue() : 0);
        m.put("pieces", row.get("pieces") instanceof Number n ? n.intValue() : 0);
        m.put("looks", row.get("looks") instanceof Number n ? n.intValue() : 0);
        if (sufficient && row.get("top") instanceof Map<?, ?> top) {
            m.put("top", Map.of("type", String.valueOf(top.get("type")), "id", String.valueOf(top.get("id"))));
        }
        return m;
    }

    /** Chave sem nenhum item público elegível: insuficiente, sem valor nem faixa (a interface não mostra nada). */
    static Map<String, Object> emptyGroup(String key) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("sufficient", false);
        m.put("value", null);
        m.put("level", null);
        m.put("rank", null);
        m.put("items", 0);
        m.put("pieces", 0);
        m.put("looks", 0);
        return m;
    }
}
