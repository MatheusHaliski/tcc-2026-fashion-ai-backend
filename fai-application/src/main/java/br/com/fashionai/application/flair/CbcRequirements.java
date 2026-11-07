package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Context;
import br.com.fashionai.application.flair.CbcRules.RequirementResult;
import br.com.fashionai.application.flair.CbcRules.Slot;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.POSITIONS;
import static br.com.fashionai.application.flair.CbcRules.TAG_FIELDS;
import static br.com.fashionai.application.flair.CbcRules.intOf;
import static br.com.fashionai.application.flair.CbcRules.strings;

/**
 * Avaliação de UM requisito da DSL dos Desafios de Montagem (extraído de {@link CbcRules}; mesma assinatura e mesmos
 * resultados). Puro: sem I/O, sem IA. Os tipos que olham a mesa (nível, nota, sintonia, posição, contagem, mala) moram em
 * {@link CbcRequirementsBoard}; os que olham as tags da carta (marca, tag, tema, hype, origem, compra, redescoberta) em
 * {@link CbcRequirementsTags}; tipo desconhecido reprova.
 *
 * <p>{@code n} é o número de vagas NÃO opcionais ({@link CbcRules#requiredSlots}): os requisitos que valem "para todas
 * as cartas" (tier only/max, ovrAvg, ovrMin sem count, origin, noBuy, strictPosition) exigem só as obrigatórias; as cartas
 * das vagas opcionais contam a favor, nunca contra.</p>
 *
 * <p>Tipos do FLAIR 3D MAKE UP: {@code cards {min}}, {@code mala {max}} (pesos Bronze 1, Prata 2, Ouro 3, Especial 4),
 * {@code position {position, count}}, {@code distinctTags {field, count}} (cores por família da taxonomia) e
 * {@code hypeBand {min, count, scope, positions}} (faixa pela nota HYP, {@link Flair3dHype#bandOf}; sem {@code scope}:
 * pelo menos {@code count} cartas; {@code scope=all}: todas as colocadas; {@code scope=positions}: cartas nas posições
 * listadas, {@code count} padrão = nº de posições).</p>
 */
final class CbcRequirements {
    private CbcRequirements() {
    }

    static final Set<String> SCOPES = Set.of("all", "positions");

    static RequirementResult evaluate(Map<String, Object> r, List<Slot> slots, Map<String, Card> board, List<Card> cards, int sintonia, Context ctx) {
        String type = String.valueOf(r.get("type"));
        int n = CbcRules.requiredSlots(slots);
        Map<String, Object> args = new LinkedHashMap<>(r);
        args.remove("type");
        RequirementResult byBoard = CbcRequirementsBoard.evaluate(type, r, slots, board, cards, sintonia, n, args);
        if (byBoard != null) {
            return byBoard;
        }
        RequirementResult byTags = CbcRequirementsTags.evaluate(type, r, cards, ctx, n, args);
        return byTags != null ? byTags : new RequirementResult(type, false, 0, 1, args);
    }

    /** Erros de forma dos tipos do FLAIR 3D MAKE UP (lista vazia = válido); os tipos clássicos ficam em {@link CbcRules#validate}. */
    static List<String> validateShape(String t, Map<String, Object> r, List<Slot> slots) {
        List<String> errors = new ArrayList<>();
        if ("cards".equals(t) && (intOf(r.get("min"), 0) < 1 || intOf(r.get("min"), 0) > slots.size())) {
            errors.add("requirements.cards");
        }
        if ("mala".equals(t) && intOf(r.get("max"), 0) < 1) {
            errors.add("requirements.mala");
        }
        if ("position".equals(t) && !concretePosition(r.get("position"))) {
            errors.add("requirements.position");
        }
        if ("distinctTags".equals(t) && !TAG_FIELDS.contains(String.valueOf(r.get("field")))) {
            errors.add("requirements.distinctTags");
        }
        if ("hypeBand".equals(t)) {
            boolean minOk = r.get("min") == null || Flair3dHype.parse(r.get("min"), null) != null;
            boolean scopeOk = r.get("scope") == null || SCOPES.contains(String.valueOf(r.get("scope")));
            List<String> positions = strings(r.get("positions"));
            boolean positionsOk = positions.stream().allMatch(CbcRequirements::concretePosition)
                    && (!"positions".equals(r.get("scope")) || !positions.isEmpty());
            if (!minOk || !scopeOk || !positionsOk) {
                errors.add("requirements.hypeBand");
            }
        }
        return errors;
    }

    /** Posição de carta de verdade: SUP, INF, CAL, ACE, VES ou LOOK (nunca ANY). */
    static boolean concretePosition(Object v) {
        return v != null && POSITIONS.contains(String.valueOf(v)) && !CbcRules.ANY.equals(v);
    }
}
