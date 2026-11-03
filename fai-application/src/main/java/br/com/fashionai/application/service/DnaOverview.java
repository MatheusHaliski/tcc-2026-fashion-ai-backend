package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.StyleDnaVersionRepository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Visão geral do DNA (pré-requisitos, recálculo por evolução, versões) e prova social por arquétipo.
 */
final class DnaOverview {
    private final StyleDnaRepository dnas;
    private final StyleDnaVersionRepository versions;
    private final NotificationService notifications;
    private final DnaSynthesis synthesis;

    DnaOverview(StyleDnaRepository dnas, StyleDnaVersionRepository versions, NotificationService notifications, DnaSynthesis synthesis) {
        this.dnas = dnas;
        this.versions = versions;
        this.notifications = notifications;
        this.synthesis = synthesis;
    }

    Map<String, Object> overview(CurrentUser user) {
        long p = synthesis.activePieces(user.id());
        long f = synthesis.positiveFeedbacks(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        // Bloco 12: o DNA de Estilo não precisa ser destravado. A Camada 1 é sintetizada com o que houver no acervo e o
        // construtor de Esquemas de DNA fica sempre disponível; peças e looks "adorei" só deixam a síntese mais precisa.
        out.put("prerequisites", Map.of("pieces", p, "positiveFeedbacks", f, "ready", true, "unlockRequired", false));
        if (p < DnaService.MIN_PIECES || f < DnaService.MIN_POSITIVE) {
            out.put("precisionNote", Msg.t("dna.seu_dna_fica_mais_preciso", DnaService.MIN_PIECES, DnaService.MIN_POSITIVE, p, f));
        }
        StyleDna d = synthesis.ensureDna(user);
        out.put("generated", true);
        if (synthesis.interactions(user.id()) - d.getInteractionsAtSynthesis() >= DnaService.RECALC_INTERACTIONS) {
            synthesis.synthesize(user, d, true, "EVOLUCAO");
            notifications.notify(user.id(), null, NotificationType.AI_JOB_FINISHED, "DNA", d.getId(), Msg.k("dna.sua_identidade_evoluiu"),
                    Msg.k("dna.recalculamos_a_camada_1_do"), Map.of());
        }
        out.put("dna", DnaViews.view(d, true));
        out.put("versions", versions.findTop20ByUserIdOrderByCreatedAtDesc(user.id()).stream().map(v -> Map.of("id", v.getId(), "createdAt", v.getCreatedAt(),
                "snapshot", Json.map(v.getSnapshotJson()))).toList());
        out.put("lifeForm", DnaViews.lifeFormSpec());
        return out;
    }

    /**
     * DET-K06 — prova social pelo DNA: "12 pessoas com o seu arquétipo usaram jaqueta jeans esta semana". Conta pessoas
     * distintas com o mesmo arquétipo que usaram cada subcategoria num Look do Dia nos últimos 7 dias. Só grupos com
     * {@value DnaService#SOCIAL_PROOF_MIN} pessoas ou mais aparecem, e a resposta nunca identifica ninguém (só contagens).
     */
    Map<String, Object> socialProof(CurrentUser user) {
        StyleDna d = dnas.findByUserId(user.id()).orElse(null);
        if (d == null || d.getArchetype() == null) {
            return Map.of("items", List.of(), "minGroup", DnaService.SOCIAL_PROOF_MIN);
        }
        String archetype = DnaViews.ARCHETYPE_LABEL.get(d.getArchetype());
        List<Map<String, Object>> items = dnas.archetypeUsageSince(d.getArchetype(), LocalDate.now().minusDays(7)).stream()
                .filter(r -> r[0] != null && ((Number) r[1]).longValue() >= DnaService.SOCIAL_PROOF_MIN).limit(3)
                .map(r -> {
                    long n = ((Number) r[1]).longValue();
                    String sub = String.valueOf(r[0]);
                    String key = "taxonomy." + sub.toLowerCase(Locale.ROOT);
                    String label = Msg.has(key) ? Msg.t(key).toLowerCase(Msg.locale()) : sub.replace('_', ' ');
                    return Map.<String, Object>of("subcategory", sub, "people", n, "text", Msg.t("dna.prova_social", n, Msg.resolve(Msg.locale(), archetype), label));
                }).toList();
        return Map.of("archetype", d.getArchetype().name(), "items", items, "minGroup", DnaService.SOCIAL_PROOF_MIN,
                "note", Msg.t("dna.prova_social_nota", DnaService.SOCIAL_PROOF_MIN));
    }
}
