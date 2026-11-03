package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Perguntas sobre Hype das próprias peças e looks, sempre com a compatibilidade de estilo ao lado. */
final class CopilotHypeAnswer extends CopilotTools {
    CopilotHypeAnswer(CopilotContext ctx) {
        super(ctx);
    }

    /**
     * "Qual é a peça mais relevante do meu guarda-roupa?", "qual item está crescendo?", "tenho alguma peça rara?",
     * "qual peça está voltando a ser tendência?", "qual look tem mais potencial de trend?" — respondido com o HypeScore v2
     * e SEMPRE com a compatibilidade com o estilo ao lado (Hype ≠ estilo pessoal).
     */
    Map<String, Object> hypeAnswer(CurrentUser user, String message) {
        String t = message.toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        Map<String, Object> out = new LinkedHashMap<>();
        StyleCompatibility.Profile dna = dnas.findByUserId(user.id()).map(HypeQueryService::profileOf).orElse(null);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        boolean looksAsked = t.matches(".*\\b(look|looks|esquema|esquemas|outfit)\\b.*");
        if (looksAsked) {
            List<Scheme> mine = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
            Map<UUID, HypeScoreCurrent> h = hype.currentOf(HypeEntityType.SCHEME, mine.stream().map(Scheme::getId).toList());
            List<Scheme> ranked = mine.stream().filter(s -> h.containsKey(s.getId()) && h.get(s.getId()).getScore() != null)
                    .sorted(Comparator.comparingDouble((Scheme s) -> potential(h.get(s.getId()))).reversed()).limit(3).toList();
            if (ranked.isEmpty()) {
                out.put("text", Msg.t("copilot.hype.nada") + "\n\n" + Msg.t("copilot.hype.aviso"));
                out.put("chips", List.of());
                return out;
            }
            StringBuilder sb = new StringBuilder(Msg.t("copilot.hype.looks"));
            List<Map<String, Object>> cards = new ArrayList<>();
            for (Scheme s : ranked) {
                HypeScoreCurrent c = h.get(s.getId());
                sb.append("\n• ").append(Msg.t("copilot.hype.linha_look", s.getTitle(), (int) Math.round(c.getScore().doubleValue()), dim(c.getDimensions().getTrend()), dim(c.getDimensions().getTrendVelocity())));
                List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
                Map<String, Object> card = new LinkedHashMap<>();
                card.put("title", s.getTitle());
                card.put("pieceIds", items.stream().map(si -> si.getWardrobeItem().getId()).toList());
                card.put("pieces", items.stream().map(si -> chip(si.getWardrobeItem(), where)).toList());
                card.put("why", Msg.t("copilot.hype.linha_look", s.getTitle(), (int) Math.round(c.getScore().doubleValue()), dim(c.getDimensions().getTrend()), dim(c.getDimensions().getTrendVelocity())));
                card.put("schemeId", s.getId());
                cards.add(card);
            }
            out.put("text", sb + "\n\n" + Msg.t("copilot.hype.aviso"));
            out.put("looks", cards);
            out.put("chips", List.of());
            out.put("actions", List.of(Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
            out.put("tools", List.of("hype_score"));
            return out;
        }
        List<WardrobeItem> own = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        Map<UUID, HypeScoreCurrent> h = hype.currentOf(HypeEntityType.PIECE, own.stream().map(WardrobeItem::getId).toList());
        java.util.function.Predicate<WardrobeItem> scored = w -> h.containsKey(w.getId()) && h.get(w.getId()).getScore() != null;
        String header;
        List<WardrobeItem> picked;
        if (t.matches(".*(rar[ao]s?|raridade|rare|rarest|exclusiv).*")) {
            header = Msg.t("copilot.hype.rare");
            // só o que é de fato raro (≥ 50): listar peças comuns como "raras" seria enganoso
            picked = own.stream().filter(w -> h.containsKey(w.getId()) && h.get(w.getId()).getDimensions().getRarity() != null
                            && h.get(w.getId()).getDimensions().getRarity().doubleValue() >= 50)
                    .sorted(Comparator.comparing((WardrobeItem w) -> h.get(w.getId()).getDimensions().getRarity()).reversed()).limit(5).toList();
        } else if (t.matches(".*(voltando|volta a ser|voltar a ser|comeback|coming back|volviendo|vuelve a ser).*")) {
            header = Msg.t("copilot.hype.comeback");
            picked = own.stream().filter(w -> h.containsKey(w.getId()) && HypeQueryService.idleDays(w, today) >= RoomService.FORGOTTEN_DAYS && comeback(h.get(w.getId())))
                    .sorted(Comparator.comparingDouble((WardrobeItem w) -> similarGrowth(h.get(w.getId()))).reversed()).limit(5).toList();
        } else if (t.matches(".*(crescend|subindo|growing|rising|creciendo|em crescimento|aumentando).*")) {
            header = Msg.t("copilot.hype.rising", hype.config().deltaWindowDays());
            picked = own.stream().filter(scored).filter(w -> h.get(w.getId()).getDeltaPoints() != null && h.get(w.getId()).getDeltaPoints().signum() > 0
                            || (h.get(w.getId()).getDimensions().getTrend() != null && h.get(w.getId()).getDimensions().getTrend().doubleValue() >= 60))
                    .sorted(Comparator.comparingDouble((WardrobeItem w) -> dim(h.get(w.getId()).getDimensions().getTrend())).reversed()).limit(5).toList();
        } else {
            header = Msg.t("copilot.hype.top");
            picked = own.stream().filter(scored).sorted(Comparator.comparing((WardrobeItem w) -> h.get(w.getId()).getScore()).reversed()).limit(5).toList();
        }
        if (picked.isEmpty()) {
            out.put("text", Msg.t("copilot.hype.nada") + "\n\n" + Msg.t("copilot.hype.aviso"));
            out.put("chips", List.of());
            out.put("actions", List.of(Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
            return out;
        }
        StringBuilder sb = new StringBuilder(header);
        List<Map<String, Object>> chips = new ArrayList<>();
        for (WardrobeItem w : picked) {
            HypeScoreCurrent c = h.get(w.getId());
            Map<String, Object> compat = dna == null ? null : StyleCompatibility.score(dna, HypeQueryService.profileOf(w));
            Integer style = compat == null ? null : ((Number) compat.get("score")).intValue();
            String hypeText = c.getScore() == null ? Msg.t("copilot.hype.sem_dados") : String.valueOf(Math.round(c.getScore().doubleValue()));
            sb.append("\n• ").append(style == null ? Msg.t("copilot.hype.linha", w.getName(), hypeText) : Msg.t("copilot.hype.linha_estilo", w.getName(), hypeText, style));
            Map<String, Object> chip = chip(w, where);
            chip.put("hype", c.getScore() == null ? null : (int) Math.round(c.getScore().doubleValue()));
            chip.put("compatibility", style);
            chip.put("daysUnused", HypeQueryService.idleDays(w, today));
            chips.add(chip);
        }
        out.put("text", sb + "\n\n" + Msg.t("copilot.hype.aviso"));
        out.put("chips", chips);
        out.put("actions", List.of(Map.of("type", "COMPOSE_WITH", "label", Msg.t("common.criar_look_com_elas"), "pieceIds", picked.stream().limit(3).map(WardrobeItem::getId).toList()),
                Map.of("type", "OPEN_HYPE", "label", Msg.t("copilot.hype.ver_historico"), "href", "/history?tab=hype")));
        out.put("tools", List.of("hype_score", "dna_de_estilo"));
        return out;
    }

    /** Potencial de trend de um look: crescimento recente + aceleração (não o score acumulado). */
    static double potential(HypeScoreCurrent c) {
        return 0.6 * dim(c.getDimensions().getTrend()) + 0.4 * dim(c.getDimensions().getTrendVelocity());
    }

    static boolean comeback(HypeScoreCurrent c) {
        return similarGrowth(c) >= 15 || dim(c.getDimensions().getTrend()) >= 60;
    }

    static double similarGrowth(HypeScoreCurrent c) {
        Map<String, Object> sig = Json.map(c.getSignalsJson());
        return sig != null && sig.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : 0;
    }

    static int dim(java.math.BigDecimal v) {
        return v == null ? 0 : (int) Math.round(v.doubleValue());
    }
}
