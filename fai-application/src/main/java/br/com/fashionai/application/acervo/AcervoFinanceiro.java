package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoDesejo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Contas do painel financeiro, sem inventar valor: só entra peça com preço informado; peça sem preço é contada à
 * parte. Os totais saem na moeda mais usada nas peças (real, por padrão); preço em outra moeda não é convertido, só
 * contado. A lista de desejos é sempre uma estimativa.
 */
final class AcervoFinanceiro {
    static final List<String> GRUPOS = List.of("ROUPAS", "CALCADOS", "ACESSORIOS", "OUTROS");

    private AcervoFinanceiro() {
    }

    static String grupo(String categoria) {
        if (categoria == null) {
            return "OUTROS";
        }
        return switch (categoria) {
            case "upper_piece", "lower_piece", "full_body_piece" -> "ROUPAS";
            case "shoes_piece" -> "CALCADOS";
            case "accessory_piece" -> "ACESSORIOS";
            default -> "OUTROS";
        };
    }

    /** Moeda com mais peças com preço; sem nenhuma, real. */
    static String moeda(Collection<WardrobeItem> pecas) {
        Map<String, Integer> contagem = new LinkedHashMap<>();
        for (WardrobeItem w : pecas) {
            if (preco(w) != null) {
                contagem.merge(moedaDe(w), 1, Integer::sum);
            }
        }
        return contagem.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("BRL");
    }

    static Map<String, Object> resumo(List<WardrobeItem> pecas, Set<UUID> selecao, List<AcervoDesejo> desejos) {
        String moeda = moeda(pecas);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("moeda", moeda);
        out.putAll(soma(pecas, moeda));
        out.put("totalPecas", pecas.size());
        out.put("grupos", grupos(pecas, moeda));
        List<WardrobeItem> escolhidas = pecas.stream().filter(w -> selecao.contains(w.getId())).toList();
        Map<String, Object> selecionadas = soma(escolhidas, moeda);
        selecionadas.put("totalPecas", escolhidas.size());
        out.put("selecao", selecionadas);
        out.put("desejos", desejos(desejos, moeda));
        out.put("custoPorUso", custoPorUso(pecas, moeda));
        return out;
    }

    /** valor, pecasComPreco, pecasSemPreco e pecasOutraMoeda de um conjunto de peças. */
    private static Map<String, Object> soma(List<WardrobeItem> pecas, String moeda) {
        BigDecimal valor = BigDecimal.ZERO;
        int comPreco = 0;
        int semPreco = 0;
        int outraMoeda = 0;
        for (WardrobeItem w : pecas) {
            if (preco(w) == null) {
                semPreco++;
            } else if (!moeda.equals(moedaDe(w))) {
                outraMoeda++;
            } else {
                valor = valor.add(preco(w));
                comPreco++;
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valor", valor.setScale(2, RoundingMode.HALF_UP));
        out.put("pecasComPreco", comPreco);
        out.put("pecasSemPreco", semPreco);
        out.put("pecasOutraMoeda", outraMoeda);
        return out;
    }

    private static List<Map<String, Object>> grupos(List<WardrobeItem> pecas, String moeda) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String grupo : GRUPOS) {
            List<WardrobeItem> doGrupo = pecas.stream().filter(w -> grupo(w.getCategory()).equals(grupo)).toList();
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("grupo", grupo);
            linha.put("pecas", doGrupo.size());
            linha.put("valor", soma(doGrupo, moeda).get("valor"));
            out.add(linha);
        }
        return out;
    }

    private static Map<String, Object> desejos(List<AcervoDesejo> desejos, String moeda) {
        BigDecimal valor = BigDecimal.ZERO;
        int semPreco = 0;
        int outraMoeda = 0;
        for (AcervoDesejo d : desejos) {
            if (d.getPrecoEstimado() == null) {
                semPreco++;
            } else if (!moeda.equals(d.getMoeda())) {
                outraMoeda++;
            } else {
                valor = valor.add(d.getPrecoEstimado());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valor", valor.setScale(2, RoundingMode.HALF_UP));
        out.put("itens", desejos.size());
        out.put("semPreco", semPreco);
        out.put("outraMoeda", outraMoeda);
        out.put("estimado", true);
        return out;
    }

    /** Preço das peças já usadas dividido pelas vezes em que foram usadas; nulo quando não há uso registrado. */
    private static Map<String, Object> custoPorUso(List<WardrobeItem> pecas, String moeda) {
        BigDecimal valor = BigDecimal.ZERO;
        int usos = 0;
        int contadas = 0;
        for (WardrobeItem w : pecas) {
            if (preco(w) != null && moeda.equals(moedaDe(w)) && w.getWearCount() > 0) {
                valor = valor.add(preco(w));
                usos += w.getWearCount();
                contadas++;
            }
        }
        if (usos == 0) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valor", valor.divide(BigDecimal.valueOf(usos), 2, RoundingMode.HALF_UP));
        out.put("pecas", contadas);
        out.put("usos", usos);
        return out;
    }

    /**
     * Preço informado pela pessoa. O cadastro grava 0 quando o preço não é informado: zero conta como "sem preço"
     * (não entra no valor do acervo nem no custo por uso, e o cartão não mostra "R$ 0,00").
     */
    static BigDecimal preco(WardrobeItem w) {
        BigDecimal p = w.getPrice();
        return p == null || p.signum() <= 0 ? null : p;
    }

    private static String moedaDe(WardrobeItem w) {
        return w.getPriceCurrency() == null ? "BRL" : w.getPriceCurrency();
    }
}
