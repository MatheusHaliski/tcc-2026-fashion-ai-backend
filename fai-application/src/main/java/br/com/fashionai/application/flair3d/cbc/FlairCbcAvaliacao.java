package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.Requisito;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Confere um elenco em quebra-cabeça, puro, pelo motor dos desafios ({@link CbcRules#evaluate}): cada vaga é uma peça
 * da imagem e encaixa quando tem carta e a carta cumpre o que a vaga pede (o {@code accepts} da vaga no motor); os
 * requisitos do deck viram a DSL do motor (tag de cor, estilo ou ocasião, cartas, marcas distintas, nível da carta).
 * O quebra-cabeça completa quando todas as peças encaixam e todos os requisitos são cumpridos.
 */
public final class FlairCbcAvaliacao {
    private static final CbcRules.Context SEM_TEMA = new CbcRules.Context(List.of(), Set.of(), Set.of(), Set.of(), null, null, LocalDate.EPOCH);

    private FlairCbcAvaliacao() {
    }

    public static List<CbcRules.Slot> slots(FlairCbcElenco e) {
        return e.vagas().stream().map(v -> new CbcRules.Slot(v.chave(), v.posicao(), v.pede())).toList();
    }

    /** {pecas:{vaga: encaixou}, completas, total, requisitos:[{tipo, ok, valor, alvo}], ok}. */
    public static Map<String, Object> conferir(FlairCbcElenco e, Map<String, CbcRules.Card> board) {
        List<Requisito> reqs = e.requisitosCompletos();
        CbcRules.Evaluation ev = CbcRules.evaluate(slots(e), board, reqs.stream().map(FlairCbcAvaliacao::dsl).toList(), SEM_TEMA);
        Map<String, Boolean> pecas = new LinkedHashMap<>();
        ev.slots().forEach(s -> pecas.put(s.slot(), s.cardId() != null && s.accepted()));
        int completas = (int) pecas.values().stream().filter(Boolean::booleanValue).count();
        List<Map<String, Object>> requisitos = new ArrayList<>();
        boolean ok = completas == pecas.size();
        for (int i = 0; i < reqs.size(); i++) {
            CbcRules.RequirementResult r = ev.requirements().get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tipo", reqs.get(i).tipo());
            m.put("ok", r.ok());
            m.put("valor", r.have());
            m.put("alvo", reqs.get(i).alvo());
            ok &= r.ok();
            requisitos.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pecas", pecas);
        out.put("completas", completas);
        out.put("total", pecas.size());
        out.put("requisitos", requisitos);
        out.put("ok", ok);
        return out;
    }

    /** Requisito na DSL do motor: tag {field, anyOf, count}, cards {min}, distinctBrands {count}, tier {min, count}. */
    static Map<String, Object> dsl(Requisito q) {
        return switch (q.tipo()) {
            case Requisito.COR -> tag("color", q);
            case Requisito.ESTILO -> tag("style", q);
            case Requisito.OCASIAO -> tag("occasion", q);
            case Requisito.CARTAS -> Map.of("type", "cards", "min", q.alvo());
            case Requisito.MARCAS -> Map.of("type", "distinctBrands", "count", q.alvo());
            case Requisito.NIVEL_CARTA -> Map.of("type", "tier", "min", q.nivel(), "count", q.alvo());
            default -> Map.of("type", "desconhecido");
        };
    }

    private static Map<String, Object> tag(String campo, Requisito q) {
        return Map.of("type", "tag", "field", campo, "anyOf", List.of(q.valor()), "count", q.alvo());
    }
}
