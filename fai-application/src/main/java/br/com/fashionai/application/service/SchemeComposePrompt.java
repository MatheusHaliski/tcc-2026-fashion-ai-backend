package br.com.fashionai.application.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import br.com.fashionai.application.ai.AiResponseJson;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.dna.CompositionContext;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;

/**
 * Etapa 2 do Criar Look (RF5.CA04): o que a IA recebe de cada peça, a instrução do compositor e a leitura da resposta.
 * Puro; a chamada à IA, as fotos e o perfil ficam no {@link SchemeService#compose}. Extraído do SchemeService.
 */
final class SchemeComposePrompt {
    /** Fotos enviadas à IA na etapa 2 (miniaturas das peças mais recentes). */
    static final int MAX_PHOTOS = 12;

    private SchemeComposePrompt() {
    }

    /** RF5 etapa 2 — tudo que a peça carrega no RF4 entra na interpretação da IA; Hype sem dados = nulo (nunca 0). */
    static Map<String, Object> entry(String ref, WardrobeItem w, HypeScoreCurrent h, HypeLevel level) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ref", ref);
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("material", w.getMaterial());
        m.put("sex", w.getSex());
        m.put("style", Json.csv(w.getStyleTags()));
        m.put("occasion", Json.csv(w.getOccasionTags()));
        m.put("brand", w.getBrandName());
        m.put("size", w.getSizeLabel());
        m.put("condition", w.getCondition() == null ? null : w.getCondition().name());
        m.put("price", w.getPrice());
        m.put("favorite", w.isFavorite());
        m.put("wearCount", w.getWearCount());
        m.put("lastWorn", w.getLastWornDate());
        // sem dados = nulo (nunca 0); a faixa acompanha o número
        m.put("hypeScore", h == null || h.getScore() == null ? null : h.getScore().setScale(0, java.math.RoundingMode.HALF_UP));
        m.put("hypeLevel", level == null ? null : level.name());
        m.put("tags", Json.csv(w.getTags()));
        m.put("notes", InputSanitizer.clean(w.getNotes(), 160));
        m.put("analysis", CompositionContext.pieceAnalysis(w));
        return m;
    }

    static String system() {
        return """
                Você é o Scheme Composer do Fashion AI. Monte EXATAMENTE 3 looks distintos usando SOMENTE as peças do
                acervo informado (referências p1, p2...). Nunca invente peças. Cada look: 2 a 4 peças, no máximo 1 de cada
                tipo (upper/lower/shoes/accessory; full_body ocupa upper e lower), sexo coerente.
                Interprete TUDO que o acervo oferece: materiais (texturas e combinações — linho/algodão para calor, lã/couro
                para frio, evite três materiais pesados juntos), cores (harmonia, contraste, paleta e estação cromática do
                DNA de estilo), padrões/estampas (no máximo uma estampa forte por look; leia a estampa real nas fotos),
                as FOTOS anexadas (caimento, corte, comprimento, brilho, estado real da peça), tamanho/caimento, estado de
                conservação, preço (coerência entre peças), frequência de uso (varie peças pouco usadas quando o usuário
                pedir novidade), favoritas, notas/tags do usuário, além de ocasião, estilo, humor, estação e clima do país.
                hypeScore (0–100) e hypeLevel são o HypeScore v2: a relevância atual da peça no FashionAI, não qualidade
                nem gosto pessoal; nulo = sem dados. Use só como contexto, nunca como critério principal do look.
                As orientações livres do usuário podem citar materiais, cores, estampas ou peças específicas: respeite-as.
                Sintetize ocasião e estilo (máx. 3 cada, nunca concatene as tags das peças). No rationale, cite os
                atributos que pesaram (ex.: "linho cru + terracota, sem estampa, clima quente"). Responda SOMENTE com JSON:
                {"compositions":[{"title":string,"refs":["p1",...],"occasion":[...],"style":[...],"mood":one of
                [ENERGETIC,ELEGANT,COMFORTABLE,SOPHISTICATED],"rationale":"até 2 frases"}]}"""
                + "\nEscreva title e rationale em " + Msg.languageName() + "; refs, occasion, style e mood seguem os códigos acima.";
    }

    /** A resposta da IA em até 3 looks: só peças do acervo, uma de cada tipo, sem repetir combinação; nulo se nada servir. */
    static List<LocalSchemeComposer.Composition> parse(String text, Map<String, WardrobeItem> byRef, SchemeService.ComposeRequest req,
                                                       Set<String> exclude) {
        Map<String, Object> m = AiResponseJson.extractJson(text);
        if (!(m.get("compositions") instanceof List<?> list)) {
            return null;
        }
        List<LocalSchemeComposer.Composition> out = new ArrayList<>();
        Set<String> seen = new HashSet<>(exclude);
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> c) || !(c.get("refs") instanceof List<?> refs)) {
                continue;
            }
            // a IA às vezes repete o tipo (duas blusas); o look fica com a primeira de cada tipo
            List<WardrobeItem> chosen = LocalSchemeComposer.onePerType(
                    refs.stream().map(String::valueOf).map(byRef::get).filter(Objects::nonNull).distinct().toList());
            if (chosen.size() < 2) {
                continue;
            }
            String key = SchemeService.combinationKey(chosen.stream().map(WardrobeItem::getId).toList());
            if (!seen.add(key)) {
                continue;
            }
            LocalSchemeComposer.Composition base = LocalSchemeComposer.toComposition(chosen,
                    strs(c.get("occasion"), Taxonomy.OCCASIONS, 3, req.occasion()), strs(c.get("style"), Taxonomy.STYLES, 3, req.style()),
                    req.season(), 0);
            String title = c.get("title") == null ? base.title() : InputSanitizer.clean(String.valueOf(c.get("title")), 120);
            String mood = c.get("mood") != null && Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED")
                    .contains(String.valueOf(c.get("mood"))) ? String.valueOf(c.get("mood")) : base.mood();
            String rationale = c.get("rationale") == null ? base.rationale() : InputSanitizer.clean(String.valueOf(c.get("rationale")), 300);
            // selos só vêm de vínculo com marca/celebridade (RF25), nunca de rótulo genérico da composição
            out.add(new LocalSchemeComposer.Composition(title, base.items(), base.occasions(), base.styles(), req.season(), mood,
                    List.of(), base.totalPrice(), 1, rationale));
            if (out.size() == 3) {
                break;
            }
        }
        return out.isEmpty() ? null : out;
    }

    private static List<String> strs(Object o, List<String> allowed, int max, List<String> fallback) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            l.stream().map(String::valueOf).filter(allowed::contains).distinct().limit(max).forEach(out::add);
        }
        return out.isEmpty() && fallback != null ? fallback.stream().limit(max).toList() : out;
    }
}
