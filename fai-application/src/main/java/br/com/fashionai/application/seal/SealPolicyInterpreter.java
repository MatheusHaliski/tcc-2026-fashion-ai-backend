package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Msg;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * RF25 — Copilot "Definir selo": lê uma mensagem {@code #createsealpolicy …} (doc 06 §2–§3, padrões P01–P17) e devolve
 * a política ajustada. É determinístico e puro (sem IA, sem banco): cada «slot» reconhecido altera um campo do objeto
 * {@code SealPolicy}; o que não foi entendido não inventa valor. Depois disso {@link SealPolicies#normalize} e
 * {@link SealPolicies#enforce} aplicam as regras duras (o interpretador nunca as contorna).
 *
 * <p>Aceita português, inglês e espanhol nas palavras-chave mais comuns ("peça/piece/pieza", "teto/cap/tope"…).</p>
 */
public final class SealPolicyInterpreter {
    private static final Pattern NUM = Pattern.compile("(\\d{1,3}(?:[.\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)");
    private static final Pattern QUOTED = Pattern.compile("[«\"“]([^»\"”]{1,80})[»\"”]");

    private SealPolicyInterpreter() {
    }

    /** Resultado: a política ajustada e a lista do que foi entendido (vira o texto da resposta do Copilot). */
    public record Result(Map<String, Object> policy, List<String> understood) {
    }

    public static boolean isTagged(String text) {
        return text != null && fold(text).contains(SealPolicies.TAG);
    }

    @SuppressWarnings("unchecked")
    public static Result interpret(String text, Map<String, Object> current, String issuerType) {
        Map<String, Object> p = SealPolicies.normalize(current, issuerType);
        List<String> ok = new ArrayList<>();
        String raw = text == null ? "" : text.replace(SealPolicies.TAG, " ").trim();
        String t = fold(raw);
        Map<String, Object> el = SealPolicies.map(p, "eligibility");
        Map<String, Object> rv = SealPolicies.map(p, "review");
        Map<String, Object> va = SealPolicies.map(p, "validity");
        Map<String, Object> qu = SealPolicies.map(p, "quota");
        Map<String, Object> rk = SealPolicies.map(p, "revocation");
        Map<String, Object> pr = SealPolicies.map(p, "promotion");
        Map<String, Object> ae = SealPolicies.map(p, "aesthetics");

        // tier
        if (has(t, "tier perfil", "selo de perfil", "profile seal", "sello de perfil", "embaixador", "ambassador", "embajador")) {
            p.put("tier", "PERFIL");
            ok.add(Msg.t("sealCopilot.tier", "PERFIL"));
        } else if (has(t, "tier peca", "tier pieza", "piece seal", "selo de peca", "uma peca", "one piece", "una pieza")) {
            p.put("tier", "PECA");
            ok.add(Msg.t("sealCopilot.tier", "PECA"));
        } else if (has(t, "tier look", "selo de look", "look seal", "looks com", "looks with", "looks con")) {
            p.put("tier", "LOOK");
            ok.add(Msg.t("sealCopilot.tier", "LOOK"));
        }
        // peças mínimas do emissor
        Integer minPieces = numberBefore(t, "(pecas?|pieces?|piezas?)");
        if (minPieces != null && has(t, "pelo menos", "ao menos", "at least", "al menos", "minimo", "minimum")) {
            el.put("min_pieces_from_issuer", minPieces);
            ok.add(Msg.t("sealCopilot.min_pecas", minPieces));
        }
        // coleção
        Matcher col = Pattern.compile("(colecao|collection|coleccion)\\s+[«\"“]([^»\"”]{1,60})[»\"”]").matcher(t);
        if (col.find()) {
            String name = original(raw, col.group(2));
            // a política guarda o id da coleção (slug), como os demais ids; o nome legível vai na justificativa
            String slug = fold(name).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
            List<String> cols = new ArrayList<>((List<String>) el.getOrDefault("collections", List.of()));
            if (!slug.isEmpty() && !cols.contains(slug)) cols.add(slug);
            el.put("collections", cols);
            ok.add(Msg.t("sealCopilot.colecao", name));
        }
        // confiança mínima ("confiança acima de 0,80")
        Double conf = decimalAfter(t, "(confianca|confidence|confianza)[^0-9]{0,20}");
        if (conf != null) {
            el.put("min_confidence", conf);
            ok.add(Msg.t("sealCopilot.confianca", pct(conf)));
        }
        // revisão
        Double auto = decimalAfter(t, "(automaticamente acima de|automatically above|automaticamente por encima de|auto acima de)\\s*");
        if (auto != null) {
            rv.put("mode", "hybrid");
            rv.put("auto_threshold", auto);
            Double manual = decimalAfter(t, "(entre|between)\\s*");
            if (manual != null && manual < auto) rv.put("manual_below", manual);
            ok.add(Msg.t("sealCopilot.revisao_hibrida", pct(auto)));
        } else if (has(t, "revisao manual", "manual review", "revision manual", "sempre manual", "always manual", "ninguem e auto")) {
            rv.put("mode", "manual");
            rv.put("auto_threshold", null);
            ok.add(Msg.t("sealCopilot.revisao_manual"));
        } else if (has(t, "aprovar automaticamente", "approve automatically", "aprobar automaticamente", "revisao automatica")) {
            rv.put("mode", "auto");
            ok.add(Msg.t("sealCopilot.revisao_auto"));
        }
        Integer sla = numberBefore(t, "(h\\b|horas|hours)");
        if (sla != null && has(t, "sla")) {
            rv.put("sla_hours", sla);
            ok.add(Msg.t("sealCopilot.sla", sla));
        }
        // validade
        Integer months = numberBefore(t, "(meses|months|mes)");
        if (months != null) {
            va.put("months", months);
            ok.add(Msg.t("sealCopilot.validade", months));
        }
        if (has(t, "fim da campanha", "end of the campaign", "fin de la campana", "o que vier primeiro", "whichever comes first")) {
            va.put("expires_with_campaign", true);
            ok.add(Msg.t("sealCopilot.ate_fim_campanha"));
        }
        // teto e cota
        Integer total = numberAfter(t, "(teto de|cap of|tope de|no maximo|at most|maximo de|limite de)\\s*");
        if (total != null && total > 0) {
            qu.put("total", total);
            ok.add(Msg.t("sealCopilot.teto", total));
        }
        Integer perUser = numberBefore(t, "(por usuario|per user|por usuario)");
        if (perUser != null) {
            qu.put("per_user", perUser);
            ok.add(Msg.t("sealCopilot.por_usuario", perUser));
        }
        Matcher period = Pattern.compile("(\\d+)\\s*(por|per)\\s*(dia|day|semana|week|mes|month)").matcher(t);
        if (period.find()) {
            String unit = period.group(3);
            String per = unit.startsWith("d") ? "day" : unit.startsWith("s") || unit.startsWith("w") ? "week" : "month";
            Map<String, Object> pp = new LinkedHashMap<>();
            pp.put("count", Integer.parseInt(period.group(1)));
            pp.put("period", per);
            qu.put("per_period", pp);
            ok.add(Msg.t("sealCopilot.por_periodo", period.group(1), per));
        }
        if (has(t, "entram em fila", "fila", "queue", "cola")) qu.put("on_exceed", "queue");
        if (has(t, "recusar novos", "reject new", "rechazar nuevos")) qu.put("on_exceed", "reject");
        // revogação
        if (has(t, "revogar", "revoke", "revocar")) {
            rk.put("on_piece_removed", true);
            rk.put("notify_user", has(t, "avisar", "notify", "avisar al"));
            ok.add(Msg.t("sealCopilot.revogacao"));
        }
        // promoção a criar ("cupom de loja de 15%", "desconto 15%")
        String promoType = has(t, "cupom de loja", "store coupon", "cupon de tienda") ? "CUPOM_LOJA"
                : has(t, "frete gratis", "free shipping", "envio gratis") ? "FRETE_GRATIS"
                : has(t, "acesso antecipado", "early access", "acceso anticipado", "pre-venda", "presale", "preventa") ? "ACESSO_ANTECIPADO"
                : has(t, "brinde", "gift", "regalo") ? "BRINDE"
                : has(t, "desconto", "discount", "descuento") ? "DESCONTO_ECOMMERCE" : null;
        if (promoType != null && pr.get("promotion_id") == null) {
            Map<String, Object> create = new LinkedHashMap<>();
            create.put("type", promoType);
            Matcher pc = Pattern.compile("(\\d{1,2})\\s*%").matcher(t);
            if (pc.find()) create.put("discount_percent", Integer.parseInt(pc.group(1)));
            create.put("per_user", 1);
            pr.put("create", create);
            ok.add(Msg.t("sealCopilot.promocao", Msg.t("sealCopilot.promo." + promoType)));
        }
        // estética: formato e material
        if (has(t, "folha", "selo postal", "stamp", "sheet", "sello postal", "retangular", "rectangular")) {
            ae.put("format", "FOLHA");
            ok.add(Msg.t("sealCopilot.formato", "FOLHA"));
        } else if (has(t, "formato fashion ai", "fashion ai format", "emblema fai", "sacola fai")) {
            ae.put("format", "FASHION_AI");
            ok.add(Msg.t("sealCopilot.formato", "FASHION_AI"));
        } else if (has(t, "circular", "redondo", "round", "medalhao", "medallion")) {
            ae.put("format", "CIRCULAR");
            ok.add(Msg.t("sealCopilot.formato", "CIRCULAR"));
        }
        for (String m : SealDesigns.STYLE_MATERIALS) {
            if (Pattern.compile("material\\s+[«\"“]?" + Pattern.quote(fold(m))).matcher(t).find()) {
                ae.put("material", m);
                ok.add(Msg.t("sealCopilot.material", m));
                break;
            }
        }
        // nomes ("propor 3 nomes")
        if (has(t, "nome", "name", "nombre")) {
            List<String> names = proposeNames(el, p, numberBefore(t, "(nomes|names|nombres)"));
            p.put("name_proposals", names);
            ok.add(Msg.t("sealCopilot.nomes", names.size()));
        }
        if (!raw.isBlank()) {   // mensagem vazia = só reavaliar a política (a justificativa anterior fica)
            p.put("rationale", ok.isEmpty() ? Msg.t("sealCopilot.nada_entendido") : String.join(" · ", ok));
        }
        return new Result(SealPolicies.normalize(p, issuerType), ok);
    }

    @SuppressWarnings("unchecked")
    static List<String> proposeNames(Map<String, Object> el, Map<String, Object> p, Integer howMany) {
        int n = howMany == null ? 3 : Math.max(1, Math.min(5, howMany));
        List<String> cols = (List<String>) el.getOrDefault("collections", List.of());
        String base = cols.isEmpty() ? Msg.t("sealCopilot.nome_base_" + String.valueOf(p.get("tier")).toLowerCase(Locale.ROOT)) : titled(cols.get(0));
        String year = String.valueOf(java.time.Year.now().getValue());
        List<String> pool = List.of(base + " · " + year, Msg.t("sealCopilot.nome_selecao", base), Msg.t("sealCopilot.nome_assinatura", base),
                Msg.t("sealCopilot.nome_edicao", base, year), Msg.t("sealCopilot.nome_curadoria", base));
        return new ArrayList<>(pool.subList(0, n));
    }

    // ------------------------------------------------------------------ texto

    /** "inverno_26" → "Inverno 26" (nome sugerido a partir do id da coleção). */
    private static String titled(String slug) {
        StringBuilder b = new StringBuilder();
        for (String w : slug.split("_")) if (!w.isEmpty()) b.append(b.length() > 0 ? " " : "").append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        return b.toString();
    }

    /** minúsculas sem acento (a tag e as palavras-chave comparam assim). */
    static String fold(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static boolean has(String t, String... words) {
        for (String w : words) if (t.contains(w)) return true;
        return false;
    }

    /** Recupera a grafia original (com acentos e maiúsculas) do trecho entre aspas. */
    private static String original(String raw, String folded) {
        Matcher m = QUOTED.matcher(raw);
        while (m.find()) if (fold(m.group(1)).equals(folded)) return m.group(1).trim();
        return folded.trim();
    }

    private static Integer toInt(String s) {
        try {
            return Integer.parseInt(s.replaceAll("[.\\s]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer numberBefore(String t, String unitRegex) {
        Matcher m = Pattern.compile(NUM.pattern() + "[»\"”]?\\s*" + unitRegex).matcher(t);
        return m.find() ? toInt(m.group(1).replace(",", "")) : null;
    }

    private static Integer numberAfter(String t, String prefixRegex) {
        Matcher m = Pattern.compile(prefixRegex + "[«\"“]?" + NUM.pattern()).matcher(t);
        return m.find() ? toInt(m.group(m.groupCount())) : null;
    }

    private static Double decimalAfter(String t, String prefixRegex) {
        Matcher m = Pattern.compile(prefixRegex + "[«\"“]?(0?[.,]\\d{1,2}|\\d{2}\\s*%)").matcher(t);
        if (!m.find()) return null;
        String v = m.group(m.groupCount()).replace(" ", "");
        double d = v.endsWith("%") ? Double.parseDouble(v.replace("%", "")) / 100.0 : Double.parseDouble(v.replace(",", "."));
        return d > 0 && d <= 1 ? d : null;
    }

    private static String pct(double v) {
        return Math.round(v * 100) + "%";
    }
}
