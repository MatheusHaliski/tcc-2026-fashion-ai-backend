package br.com.fashionai.application.insights;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ExplorerService;
import br.com.fashionai.application.service.LookbookService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.WorldRegions;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Insights dinâmicos e contextualizados (RF53, GET /api/insights). Cada aba com análise pede os insights do seu contexto:
 * os públicos (Explorador) leem só agregados de itens públicos elegíveis e ficam no {@link HypeCache} pela geração do job;
 * os pessoais (Cápsula, Copilot, Autopiloto, Histórico, Guarda-roupa, Looks) leem o guarda-roupa, o uso e o DNA de quem
 * pede. Tudo é determinístico a partir dos dados; {@code withAi=true} só reescreve o TEXTO pela IA (INSIGHT_GENERATOR),
 * e a reescrita é descartada se mudar qualquer número.
 *
 * <p>Princípios codificados: Hype é contexto, nunca critério único; tendência ≠ popularidade; Hype global ≠
 * compatibilidade pessoal (sempre lado a lado); redescoberta antes de compra; nunca pay-to-win; texto descritivo, nunca
 * juízo de valor; item privado nunca entra em agregado público.</p>
 */
@Service
public class InsightService {
    private static final Logger log = LoggerFactory.getLogger(InsightService.class);
    static final int MAX_ITEMS = 5;
    static final String SOURCE_LOCAL = "local";
    static final String SOURCE_AI = "ia";

    private final HypeQueryService hype;
    private final HypeCache cache;
    private final AiEngine ai;
    private final PublicInsights publicInsights;
    private final PersonalInsights personalInsights;

    public InsightService(HypeQueryService hype, HypeScoreCurrentRepository current, HypeCache cache, WardrobeItemRepository pieces, SchemeRepository schemes,
                          SchemeItemRepository schemeItems, StyleDnaRepository dnas, UserPreferencesRepository preferences, LookbookService lookbook,
                          ExplorerService explorer, WardrobeService wardrobe, AiEngine ai) {
        this.hype = hype;
        this.cache = cache;
        this.ai = ai;
        this.publicInsights = new PublicInsights(hype.config(), current, hype, explorer);
        this.personalInsights = new PersonalInsights(hype.config(), hype, pieces, schemes, schemeItems, dnas, preferences, lookbook, wardrobe);
    }

    /**
     * @param window 1, 7 ou 30 dias (padrão 7)
     * @param withAi reescreve só os textos pela IA (com login; sem login, sempre a leitura local)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer, String context, Integer window, String region, String category, String subcategory, boolean withAi) {
        InsightContext ctx = InsightContext.parse(context);
        if (ctx == null) {
            throw ApiException.badRequest("CONTEXTO_INVALIDO", Msg.t("insights.contexto_invalido", Arrays.toString(InsightContext.values())));
        }
        if (!ctx.isPublic() && viewer == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        Map<String, Object> out;
        if (ctx.isPublic()) {
            PublicInsights.Filters f = filters(window, region, category, subcategory);
            String key = "insights:" + ctx + ":" + f.window() + ":" + f.region() + ":" + f.category() + ":" + f.subcategory() + ":" + Msg.locale().toLanguageTag();
            out = new LinkedHashMap<>(cache.get(key, () -> response(ctx, finish(publicInsights.build(ctx, f)))));
        } else {
            out = response(ctx, finish(personalInsights.build(ctx, viewer)));
        }
        if (withAi && viewer != null && out.get("items") instanceof List<?> items && !items.isEmpty()) {
            rewrite(viewer, ctx, out);
        }
        return out;
    }

    /** Itens de um contexto pessoal para embutir em outra resposta (Copilot, Autopiloto); falha vira lista vazia. */
    public List<Map<String, Object>> itemsOrEmpty(CurrentUser user, InsightContext ctx) {
        if (user == null || ctx == null || ctx.isPublic()) {
            return List.of();
        }
        try {
            return finish(personalInsights.build(ctx, user)).stream().map(Insight::toMap).toList();
        } catch (RuntimeException e) {
            log.warn("Insights {} indisponíveis: {}", ctx, e.toString());
            return List.of();
        }
    }

    static PublicInsights.Filters filters(Integer window, String region, String category, String subcategory) {
        int win = window == null ? 7 : window <= 1 ? 1 : window >= 30 ? 30 : 7;
        String r = region == null ? "" : region.trim().toUpperCase(Locale.ROOT);
        if (!r.isEmpty() && !WorldRegions.LABELS.containsKey(r)) {
            throw ApiException.badRequest("REGIAO_INVALIDA", Msg.t("insights.regiao_invalida", WorldRegions.codes()));
        }
        return new PublicInsights.Filters(win, r, norm(category), norm(subcategory));
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 2–5 itens por relevância. A sugestão de compra (lacuna que destrava combinações) vai SEMPRE por último e só quando
     * há algo antes dela — reuso primeiro.
     */
    static List<Insight> finish(List<Insight> all) {
        List<Insight> main = all.stream().filter(i -> !isPurchase(i)).sorted(Comparator.comparingDouble(Insight::relevance).reversed()).toList();
        List<Insight> purchase = all.stream().filter(InsightService::isPurchase).toList();
        int room = MAX_ITEMS - (purchase.isEmpty() || main.isEmpty() ? 0 : 1);
        List<Insight> out = new ArrayList<>(main.subList(0, Math.min(room, main.size())));
        if (!purchase.isEmpty() && !out.isEmpty()) {
            out.add(purchase.get(0));
        }
        return out;
    }

    static boolean isPurchase(Insight i) {
        return i.code().endsWith("GAP_COMBOS");
    }

    Map<String, Object> response(InsightContext ctx, List<Insight> items) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("context", ctx.name());
        out.put("generatedAt", Instant.now().toString());
        out.put("algorithmVersion", hype.config().algorithmVersion());
        out.put("source", SOURCE_LOCAL);
        out.put("items", items.stream().map(Insight::toMap).toList());
        return out;
    }

    // ================================================================== reescrita pela IA (só o texto)
    @SuppressWarnings("unchecked")
    void rewrite(CurrentUser viewer, InsightContext ctx, Map<String, Object> out) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Object o : (List<?>) out.get("items")) {
            items.add(new LinkedHashMap<>((Map<String, Object>) o));
        }
        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map<String, Object> m : items) {
            payload.add(Map.of("code", String.valueOf(m.get("code")), "text", String.valueOf(m.get("text"))));
        }
        int n = items.size();
        AiOutcome<List<String>> outcome;
        try {
            outcome = ai.text(new AiEngine.TextCall<>(viewer.id(), AiCapability.INSIGHT_GENERATOR,
                    "Você é o Insight Generator do Fashion AI. Reescreva cada texto em " + Msg.languageName() + ", de forma natural e curta (até 2 frases), "
                            + "descritiva e sem juízo de valor (nunca diga que algo é bom, ruim, melhor ou que a pessoa deve comprar). NÃO altere, arredonde, "
                            + "acrescente nem remova números. Hype é contexto, nunca critério único; compatibilidade com o estilo e uso continuam ao lado. "
                            + "Responda SOMENTE com JSON {\"texts\":[\"...\"]}, na mesma ordem e com a mesma quantidade.",
                    "Contexto: " + ctx.name() + "\nInsights: " + Json.write(payload), List.of(), 700,
                    List.of(Msg.t("insights.ai_inputs")), text -> parseTexts(text, n), () -> null, null));
        } catch (RuntimeException e) {
            log.warn("Reescrita de insights pela IA falhou: {}", e.toString());
            return;
        }
        List<String> texts = outcome == null ? null : outcome.value();
        if (texts == null || outcome.fallbackUsed()) {
            return;
        }
        boolean changed = false;
        for (int i = 0; i < n && i < texts.size(); i++) {
            String local = String.valueOf(items.get(i).get("text"));
            String cand = texts.get(i);
            if (cand != null && !cand.isBlank() && sameNumbers(local, cand)) {
                items.get(i).put("text", cand);
                changed = true;
            }
        }
        if (changed) {
            out.put("items", items);
            out.put("source", SOURCE_AI);
        }
    }

    /** A IA nunca inventa número: a reescrita precisa citar exatamente os mesmos números do texto local. */
    static boolean sameNumbers(String local, String candidate) {
        return InsightMath.numbers(local).equals(InsightMath.numbers(candidate));
    }

    static List<String> parseTexts(String text, int expected) {
        if (text == null) {
            return null;
        }
        int a = text.indexOf('{');
        int b = text.lastIndexOf('}');
        if (a < 0 || b <= a) {
            return null;
        }
        Map<String, Object> m = Json.map(text.substring(a, b + 1));
        if (m == null || !(m.get("texts") instanceof List<?> list) || list.size() != expected) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (Object o : list) {
            out.add(o == null ? null : InputSanitizer.clean(String.valueOf(o), 400));
        }
        return out;
    }
}
