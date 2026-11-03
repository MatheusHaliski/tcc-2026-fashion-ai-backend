package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CopilotService.Answer;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.CopilotPanel.promptsFor;

/** Conversa livre: resumo compacto, ferramenta buscar_pecas e validação no servidor de toda peça citada (CA10/CA16). */
final class CopilotConversation extends CopilotTools {
    static final Pattern REF = Pattern.compile("\\[\\[(p\\d+)]]");

    CopilotConversation(CopilotContext ctx) {
        super(ctx);
    }

    /** Conversa livre: resumo compacto + ferramentas; toda peça citada precisa ser [[pN]] do acervo (validação no servidor). */
    Map<String, Object> general(CurrentUser user, String message, String view) {
        List<WardrobeItem> own = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<WardrobeItem> relevant = searchPieces(user.id(), message);
        if (relevant.isEmpty()) {
            relevant = own.stream().filter(w -> w.isDisponivel()).limit(12).toList();
        }
        Map<String, WardrobeItem> refs = new LinkedHashMap<>();
        List<Map<String, Object>> tool = new ArrayList<>();
        Map<UUID, HypeScoreCurrent> toolHype = hype.currentOf(HypeEntityType.PIECE, relevant.stream().map(WardrobeItem::getId).toList());
        int i = 1;
        for (WardrobeItem w : relevant) {
            String ref = "p" + i++;
            refs.put(ref, w);
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("ref", ref);
            fields.put("name", String.valueOf(w.getName()));
            fields.put("category", String.valueOf(w.getCategory()));
            fields.put("subcategory", String.valueOf(w.getSubcategory()));
            fields.put("color", String.valueOf(w.getColor()));
            fields.put("material", String.valueOf(w.getMaterial()));
            fields.put("size", String.valueOf(w.getSizeLabel()));
            fields.put("style", Json.csv(w.getStyleTags()));
            fields.put("occasion", Json.csv(w.getOccasionTags()));
            fields.put("condition", w.getCondition() == null ? "" : w.getCondition().name());
            fields.put("available", w.isDisponivel());
            fields.put("favorite", w.isFavorite());
            fields.put("forSale", w.isForSale());
            fields.put("wearCount", w.getWearCount());
            fields.put("lastWornDate", w.getLastWornDate() == null ? "" : w.getLastWornDate().toString());
            // HypeScore v2 = relevância no ecossistema agora (contexto), não compatibilidade com o estilo da pessoa
            fields.put("hype", toolHype.containsKey(w.getId()) && toolHype.get(w.getId()).getScore() != null ? (int) Math.round(toolHype.get(w.getId()).getScore().doubleValue()) : "");
            fields.put("tags", Json.csv(w.getTags()));
            fields.put("notes", InputSanitizer.clean(w.getNotes(), 160));
            tool.add(fields);
        }
        Map<String, Object> summary = compactSummary(user);
        String localText = Msg.t("copilot.posso_ajudar_a_montar_looks", String.join(" · ", promptsFor(view)));
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                "Você é o Copilot do Fashion AI. Responda em " + Msg.languageName() + ", em até 4 frases. Use SOMENTE as peças listadas (refs p1..pn) e cite cada peça como [[pN]]. "
                        + "Nunca cite marca ou produto para compra. Nunca invente peças. Se precisar de algo fora do acervo, diga de forma genérica (categoria, cor, ocasião). "
                        + "Responda só com o texto da resposta, em prosa corrida: sem JSON, sem blocos de código.",
                "Contexto (resumo): " + Json.write(summary) + "\nVisão atual: " + view + "\nPeças disponíveis via ferramenta buscar_pecas (categoria, subcategoria, cor, material, tamanho, estilo, ocasião, estado, preço, uso, favoritas, tags e notas): " + Json.write(tool)
                        + "\nPergunta: " + message, List.of(), 500, List.of(Msg.t("copilot.resumo_compacto_contagens_dna_camada"), Msg.t("copilot.pecas_retornadas_por_buscar_pecas")),
                text -> text == null || text.isBlank() ? null : text, () -> localText, null));
        Answer answer = plainAnswer(outcome.value() == null ? localText : outcome.value());
        String raw = answer.text();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> chips = new ArrayList<>();
        Set<UUID> cited = new LinkedHashSet<>();
        // peças citadas só na lista "pecas" de uma resposta em JSON também viram chips
        answer.refs().stream().map(refs::get).filter(Objects::nonNull).forEach(w -> cited.add(w.getId()));
        Matcher m = REF.matcher(raw);
        StringBuilder sb = new StringBuilder();
        List<String> discarded = new ArrayList<>();
        while (m.find()) {
            WardrobeItem w = refs.get(m.group(1));
            if (w == null) {
                discarded.add(m.group(1));
                m.appendReplacement(sb, "");
            } else {
                cited.add(w.getId());
                m.appendReplacement(sb, Matcher.quoteReplacement("**" + w.getName() + "**"));
            }
        }
        m.appendTail(sb);
        if (!discarded.isEmpty()) {
            audit.log(user, "COPILOT_REF_DESCARTADA", "copilot:" + user.id(), Map.of("refs", discarded)); // CA10
        }
        for (UUID id : cited) {
            own.stream().filter(w -> w.getId().equals(id)).findFirst().ifPresent(w -> chips.add(chip(w, where)));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("text", sb.toString().trim());
        out.put("chips", chips);
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        out.put("message", outcome.userMessage());
        out.put("tools", List.of("buscar_pecas", "ler_dna_estilo", "ler_inventory_score"));
        return out;
    }

    /** Campos em que a IA costuma pôr o texto quando responde em JSON apesar do pedido de prosa. */
    private static final List<String> ANSWER_FIELDS = List.of("resposta", "answer", "respuesta", "texto", "text", "response", "message");

    /**
     * A IA às vezes devolve {@code {"resposta": "...", "pecas": ["p1"]}} (às vezes dentro de ```json) em vez de prosa:
     * sem desembrulhar, a tela mostrava chaves e aspas. Texto comum passa como veio.
     */
    static Answer plainAnswer(String text) {
        if (text == null) {
            return new Answer("", List.of());
        }
        String t = text.trim();
        if (t.startsWith("```")) {
            t = t.replaceFirst("^```[a-zA-Z]*\\s*", "").replaceFirst("\\s*```$", "").trim();
        }
        if (!t.startsWith("{")) {
            return new Answer(text.trim(), List.of());
        }
        Map<String, Object> m = WardrobeService.extractJson(t);
        String body = ANSWER_FIELDS.stream().map(m::get).filter(v -> v instanceof String s && !s.isBlank())
                .map(String::valueOf).findFirst().orElse(null);
        if (body == null) {
            return new Answer(text.trim(), List.of());
        }
        List<String> refs = new ArrayList<>();
        for (String key : List.of("pecas", "peças", "pieces", "prendas", "refs")) {
            if (m.get(key) instanceof List<?> l) {
                l.stream().map(String::valueOf).filter(r -> r.matches("p\\d+")).forEach(refs::add);
            }
        }
        return new Answer(body.trim(), refs);
    }

    /** Resumo compacto (§3.2): contagens, DNA Camada 1 (Camada 2 só com consentimento — CA16), Inventory Score. */
    Map<String, Object> compactSummary(CurrentUser user) {
        Map<String, Object> m = new LinkedHashMap<>();
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        m.put("pieces", all.size());
        m.put("byCategory", all.stream().collect(Collectors.groupingBy(w -> String.valueOf(w.getCategory()), Collectors.counting())));
        m.put("looks", schemes.countByUserId(user.id()));
        Optional<StyleDna> dna = dnas.findByUserId(user.id());
        dna.ifPresent(d -> {
            m.put("dnaArchetype", d.getArchetype().name());
            m.put("dnaPalette", Json.csv(d.getColorPalette()));
            m.put("dnaStyles", Json.csv(d.getStyleKeywords()));
            boolean lifeAllowed = preferences.findByUserId(user.id()).map(UserPreferences::isLifeIdentityInAi).orElse(false);
            if (lifeAllowed && d.getLifeIdentityJson() != null) {
                Map<String, Object> life = Json.map(d.getLifeIdentityJson());
                List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
                hidden.forEach(life::remove);
                m.put("lifeIdentity", life);
            }
        });
        try {
            InventoryScoreService.Result r = inventory.computeIsolated(user.id(), true);   // falha não afeta esta transação
            m.put("inventoryScore", r.score());
            m.put("inventoryDims", r.dims());
        } catch (RuntimeException ex) {
            m.put("inventoryScore", null);
        }
        m.put("activeChallenges", challenges.activeSummary(user.id()));
        m.put("activeMoments", activeMoments(user.id()));
        return m;
    }
}
