package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.Requisito;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Confere um elenco, puro: links e química por {@link CbcLinks#evaluate}, requisitos de linha por {@link CbcLinks#meets}
 * e os de mesa (cartas, marcas, nível da carta) pela DSL de {@link CbcRules#evaluate}. Códigos em português para a API:
 * nível da linha VERMELHA, LARANJA ou VERDE; atributos MARCA, SUBCATEGORIA, CATEGORIA, ESTILO, COR e OCASIAO.
 */
public final class FlairCbcAvaliacao {
    public static final Map<CbcLinks.Level, String> NIVEIS = Map.of(CbcLinks.Level.RED, "VERMELHA", CbcLinks.Level.ORANGE, "LARANJA",
            CbcLinks.Level.GREEN, "VERDE");
    public static final Map<CbcLinks.Attribute, String> ATRIBUTOS = Map.of(CbcLinks.Attribute.BRAND, "MARCA",
            CbcLinks.Attribute.SUBCATEGORY, "SUBCATEGORIA", CbcLinks.Attribute.CATEGORY, "CATEGORIA", CbcLinks.Attribute.STYLE, "ESTILO",
            CbcLinks.Attribute.COLOR, "COR", CbcLinks.Attribute.OCCASION, "OCASIAO");
    private static final CbcRules.Context SEM_TEMA = new CbcRules.Context(List.of(), Set.of(), Set.of(), Set.of(), null, null, LocalDate.EPOCH);

    private FlairCbcAvaliacao() {
    }

    public static List<CbcRules.Slot> slots(FlairCbcElenco e) {
        return e.vagas().stream().map(v -> new CbcRules.Slot(v.chave(), v.posicao())).toList();
    }

    /** {links, quimicaCartas, quimica, requisitos:[{tipo, ok, valor, alvo}], ok}. */
    public static Map<String, Object> conferir(FlairCbcElenco e, Map<String, CbcRules.Card> board) {
        List<CbcRules.Slot> slots = slots(e);
        CbcLinks.Result r = CbcLinks.evaluate(slots, e.linhas(), board);
        List<Map<String, Object>> links = new ArrayList<>();
        for (CbcLinks.Link l : r.links()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("a", l.a());
            m.put("b", l.b());
            m.put("forca", l.strength());
            m.put("nivel", NIVEIS.get(l.level()));
            m.put("atributos", l.attributes().stream().map(ATRIBUTOS::get).toList());
            links.add(m);
        }
        List<Map<String, Object>> requisitos = new ArrayList<>();
        boolean ok = true;
        for (Requisito q : e.requisitosCompletos()) {
            Map<String, Object> m = avaliar(q, r, slots, board);
            ok &= Boolean.TRUE.equals(m.get("ok"));
            requisitos.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("links", links);
        out.put("quimicaCartas", r.cardChemistry());
        out.put("quimica", r.squadChemistry());
        out.put("requisitos", requisitos);
        out.put("ok", ok);
        return out;
    }

    static Map<String, Object> avaliar(Requisito q, CbcLinks.Result r, List<CbcRules.Slot> slots, Map<String, CbcRules.Card> board) {
        boolean ok;
        int valor;
        switch (q.tipo()) {
            case Requisito.QUIMICA -> {
                valor = r.squadChemistry();
                ok = CbcLinks.meets(r, Map.of("type", "chemistry", "min", q.alvo()), board);
            }
            case Requisito.LINHAS_VERDES -> {
                valor = r.count(CbcLinks.Level.GREEN);
                ok = CbcLinks.meets(r, Map.of("type", "greenLinks", "min", q.alvo()), board);
            }
            case Requisito.LINHAS_POR -> {
                CbcLinks.Attribute a = atributo(q.atributo());
                valor = a == null ? 0 : r.linksBy().getOrDefault(a, 0);
                ok = a != null && CbcLinks.meets(r, Map.of("type", "linksBy", "attribute", a.name(), "count", q.alvo()), board);
            }
            case Requisito.SEM_LINHA_VERMELHA -> {
                valor = (int) r.links().stream().filter(l -> q.vaga() == null || l.a().equals(q.vaga()) || l.b().equals(q.vaga()))
                        .filter(l -> l.level() == CbcLinks.Level.RED).count();
                Map<String, Object> req = q.vaga() == null ? Map.of("type", "noRedLinks") : Map.of("type", "noRedLinks", "slot", q.vaga());
                // a vaga pedida precisa estar preenchida: sem carta, não há linha para conferir
                ok = CbcLinks.meets(r, req, board) && (q.vaga() == null || board.get(q.vaga()) != null);
            }
            default -> {
                CbcRules.RequirementResult m = CbcRules.evaluate(slots, board, List.of(dsl(q)), SEM_TEMA).requirements().get(0);
                valor = m.have();
                ok = m.ok();
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tipo", q.tipo());
        out.put("ok", ok);
        out.put("valor", valor);
        out.put("alvo", q.alvo());
        return out;
    }

    /** Requisito de mesa na DSL do motor: cards {min}, distinctBrands {count}, tier {min, count}. */
    static Map<String, Object> dsl(Requisito q) {
        return switch (q.tipo()) {
            case Requisito.CARTAS -> Map.of("type", "cards", "min", q.alvo());
            case Requisito.MARCAS -> Map.of("type", "distinctBrands", "count", q.alvo());
            case Requisito.NIVEL_CARTA -> Map.of("type", "tier", "min", q.nivel(), "count", q.alvo());
            default -> Map.of("type", "desconhecido");
        };
    }

    static CbcLinks.Attribute atributo(String codigo) {
        return ATRIBUTOS.entrySet().stream().filter(e -> e.getValue().equals(codigo)).map(Map.Entry::getKey).findFirst().orElse(null);
    }
}
