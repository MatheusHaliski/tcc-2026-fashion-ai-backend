package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class FaiPointsService {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    /** Níveis de FAI XP. O que cada um libera hoje: auras, acabamentos do Hype, itens da loja física e a Metamorfose. */
    public enum Level {
        ESTREIA(0, Msg.k("faiPoints.nivel_libera.ESTREIA")),
        STUDIO(300, Msg.k("faiPoints.nivel_libera.STUDIO")),
        LOFT(900, Msg.k("faiPoints.nivel_libera.LOFT"));

        public final int threshold;
        public final String unlocks;

        Level(int threshold, String unlocks) {
            this.threshold = threshold;
            this.unlocks = unlocks;
        }

        public static Level of(long lifetime) {
            Level result = ESTREIA;
            for (Level l : values()) {
                if (lifetime >= l.threshold) {
                    result = l;
                }
            }
            return result;
        }

        /** Lê um nível gravado; os nomes antigos (Closet, Atelier, Penthouse, Maison) viraram Loft. */
        public static Level parse(String name) {
            if (name == null || name.isBlank()) {
                return ESTREIA;
            }
            String n = name.trim().toUpperCase(java.util.Locale.ROOT);
            for (Level l : values()) {
                if (l.name().equals(n)) {
                    return l;
                }
            }
            return java.util.Set.of("CLOSET", "ATELIER", "PENTHOUSE", "MAISON").contains(n) ? LOFT : ESTREIA;
        }

        public boolean atLeast(Level other) {
            return ordinal() >= other.ordinal();
        }
    }

    public record Award(boolean granted, int points, boolean capReached, String message, Level level, boolean levelUp) {
    }

    private final FaiPointsLedgerEntryRepository ledger;
    private final FaiPointsRuleRepository rules;
    private final NotificationService notifications;

    public FaiPointsService(FaiPointsLedgerEntryRepository ledger, FaiPointsRuleRepository rules, NotificationService notifications) {
        this.ledger = ledger;
        this.rules = rules;
        this.notifications = notifications;
    }

    /** Igual a {@link #award}, em transação própria: para chamadores que tratam a falha sem desfazer o próprio trabalho. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public Award awardIsolated(UUID userId, String actionCode, String refType, String refId, Integer pointsOverride) {
        return award(userId, actionCode, refType, refId, pointsOverride);
    }

    /** Lança pontos de forma idempotente; points > 0 sobrescreve o valor da regra (conquistas, desafios). */
    @Transactional
    public Award award(UUID userId, String actionCode, String refType, String refId, Integer pointsOverride) {
        FaiPointsRule rule = rules.findById(actionCode).orElse(null);
        if (rule == null || !rule.isActive()) {
            return new Award(false, 0, false, Msg.t("faiPoints.acao_sem_regra_de_pontos"), level(userId), false);
        }
        String key = userId + ":" + actionCode + ":" + (refId == null ? LocalDate.now(ZONE) : refId);
        if (ledger.existsByIdempotencyKey(key)) {
            return new Award(false, 0, false, Msg.t("faiPoints.evento_ja_pontuado"), level(userId), false);
        }
        Instant dayStart = LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant();
        if (rule.getDailyCap() != null && ledger.countByUserIdAndActionCodeAndCreatedAtAfter(userId, actionCode, dayStart) >= rule.getDailyCap()) {
            return new Award(false, 0, true, Msg.t("faiPoints.limite_diario_de_pontos_desta"), level(userId), false);
        }
        Instant weekStart = LocalDate.now(ZONE).with(DayOfWeek.MONDAY).atStartOfDay(ZONE).toInstant();
        if (rule.getWeeklyCap() != null && ledger.countByUserIdAndActionCodeAndCreatedAtAfter(userId, actionCode, weekStart) >= rule.getWeeklyCap()) {
            return new Award(false, 0, true, Msg.t("faiPoints.limite_semanal_de_pontos_desta"), level(userId), false);
        }
        int points = pointsOverride != null && pointsOverride > 0 ? pointsOverride : rule.getPoints();
        if (points <= 0) {
            return new Award(false, 0, false, Msg.t("faiPoints.acao_sem_pontos"), level(userId), false);
        }
        Level before = level(userId);
        FaiPointsLedgerEntry e = new FaiPointsLedgerEntry();
        e.setUserId(userId);
        e.setDelta(points);
        e.setActionCode(actionCode);
        e.setRefType(refType);
        e.setRefId(refId);
        e.setIdempotencyKey(key);
        e.setCountsLifetime(true);
        ledger.save(e);
        statement(e, null);
        Level after = level(userId);
        boolean up = after.ordinal() > before.ordinal();
        if (up) {
            // o tipo ROOM_LEVEL_UP fica (avisos antigos no banco); o texto fala do nível, não mais do quarto (saiu em 15/11/2026)
            notifications.notify(userId, null, NotificationType.ROOM_LEVEL_UP, "ROOM", null, Msg.k("faiPoints.subiu_de_nivel", after.name()),
                    Msg.k("faiPoints.nivel_liberado", after.name(), after.unlocks), Map.of("level", after.name()));
        }
        return new Award(true, points, false, Msg.t("faiPoints.fai_pts", points), after, up);
    }

    private void statement(FaiPointsLedgerEntry e, String detail) {
        if (notifications == null) {
            return;   // testes de unidade sem a central de notificações
        }
        String title = Msg.k(e.getDelta() >= 0 ? "faiPoints.extrato.credito" : "faiPoints.extrato.debito", Math.abs(e.getDelta()));
        String action = "faiPoints.extrato." + e.getActionCode();
        String body = !Msg.has(action) ? Msg.k("faiPoints.extrato.outro", e.getActionCode().toLowerCase(Locale.ROOT).replace('_', ' '))
                : detail == null ? Msg.k(action) : Msg.k(action, detail);
        notifications.notify(e.getUserId(), null, NotificationType.FAI_POINTS, "FAI_POINTS", e.getId(), title, body,
                Map.of("delta", e.getDelta(), "action", e.getActionCode(), "href", "/points"));
    }

    
    @Transactional
    public int game(UUID userId, String game, String matchRef, String outcome) {
        String ref = game + ":" + matchRef;
        int total = award(userId, "GAME_PLAYED", "GAME", ref, null).points();
        if ("WIN".equals(outcome)) {
            total += award(userId, "GAME_WON", "GAME", ref, null).points();
        }
        return total;
    }

    public long balance(UUID userId) {
        return ledger.balance(userId);
    }

    public long lifetime(UUID userId) {
        return ledger.lifetime(userId);
    }

    public Level level(UUID userId) {
        return Level.of(lifetime(userId));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> account(CurrentUser user) {
        long life = lifetime(user.id());
        Level lvl = Level.of(life);
        Level next = lvl.ordinal() + 1 < Level.values().length ? Level.values()[lvl.ordinal() + 1] : null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balance", balance(user.id()));
        m.put("lifetime", life);
        m.put("level", lvl.name());
        m.put("unlocks", lvl.unlocks);
        m.put("nextLevel", next == null ? null : Map.of("level", next.name(), "threshold", next.threshold, "missing", next.threshold - life,
                "unlocks", next.unlocks));
        List<Map<String, Object>> levels = new ArrayList<>();
        for (Level l : Level.values()) {
            levels.add(Map.of("level", l.name(), "threshold", l.threshold, "unlocks", l.unlocks, "reached", life >= l.threshold));
        }
        m.put("levels", levels);
        m.put("rules", rules.findAll().stream().filter(FaiPointsRule::isActive).map(r -> Map.of("action", r.getActionCode(),
                "points", r.getPoints(), "dailyCap", r.getDailyCap() == null ? "" : r.getDailyCap(), "description", Msg.has("pointsRule." + r.getActionCode()) ? Msg.k("pointsRule." + r.getActionCode()) : String.valueOf(r.getDescription()))).toList());
        m.put("recent", ledger.findTop100ByUserIdOrderByCreatedAtDesc(user.id()).stream().limit(30).map(e -> Map.of("delta", e.getDelta(),
                "action", e.getActionCode(), "ref", String.valueOf(e.getRefId()), "at", e.getCreatedAt())).toList());
        m.put("note", Msg.t("faiPoints.fai_points_nao_sao_vendidos"));
        return m;
    }

    /** Chave de pedido aceita: só letras, números e hífen (um UUID do navegador cabe), para caber na chave do ledger. */
    static String requestRef(String key) {
        return key != null && key.matches("[A-Za-z0-9-]{16,64}") ? key : null;
    }
}
