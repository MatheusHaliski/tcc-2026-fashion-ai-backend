package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** FAI Points: regras de pontos, nível e extrato; fachada sobre a loja do quarto e os itens aplicados (RF35). */
@Service
public class FaiPointsService {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    public enum Level {
        ESTREIA(0, Msg.k("faiPoints.fai_origem_smart_mirror_vista"), Msg.k("faiPoints.branco_de_fabrica")),
        STUDIO(300, Msg.k("faiPoints.iluminacao_guiada_personalizavel_e"), Msg.k("faiPoints.primeiros_acabamentos_e_materiais")),
        LOFT(900, Msg.k("faiPoints.n2_modulos_e_mais_categorias"), "quarto maior");

        public final int threshold;
        public final String unlocks;
        public final String aesthetic;

        Level(int threshold, String unlocks, String aesthetic) {
            this.threshold = threshold;
            this.unlocks = unlocks;
            this.aesthetic = aesthetic;
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
    private final RoomLayoutAccess layouts;
    private final NotificationService notifications;
    private final FaiPointsStatements statements;
    private final FaiPointsShop shop;
    private final FaiPointsRoomItems roomItems;

    public FaiPointsService(FaiPointsLedgerEntryRepository ledger, FaiPointsRuleRepository rules,
                            RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory, RoomLayoutAccess layouts,
                            NotificationService notifications, WardrobeCreatorService creator) {
        this.ledger = ledger;
        this.rules = rules;
        this.layouts = layouts;
        this.notifications = notifications;
        this.statements = new FaiPointsStatements(notifications);
        this.shop = new FaiPointsShop(this, ledger, catalog, inventory, layouts, creator, statements);
        this.roomItems = new FaiPointsRoomItems(catalog, inventory, layouts);
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
        statements.statement(e, null);
        Level after = level(userId);
        boolean up = after.ordinal() > before.ordinal();
        if (up) {
            layouts.setLevel(userId, after.name());
            notifications.notify(userId, null, NotificationType.ROOM_LEVEL_UP, "ROOM", null, Msg.k("faiPoints.seu_quarto_evoluiu", after.name()),
                    Msg.k("faiPoints.nivel_liberado", after.name(), after.unlocks), Map.of("level", after.name()));
        }
        return new Award(true, points, false, Msg.t("faiPoints.fai_pts", points), after, up);
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
            levels.add(Map.of("level", l.name(), "threshold", l.threshold, "unlocks", l.unlocks, "aesthetic", l.aesthetic,
                    "reached", life >= l.threshold));
        }
        m.put("levels", levels);
        m.put("rules", rules.findAll().stream().filter(FaiPointsRule::isActive).map(r -> Map.of("action", r.getActionCode(),
                "points", r.getPoints(), "dailyCap", r.getDailyCap() == null ? "" : r.getDailyCap(), "description", Msg.has("pointsRule." + r.getActionCode()) ? Msg.k("pointsRule." + r.getActionCode()) : String.valueOf(r.getDescription()))).toList());
        m.put("recent", ledger.findTop100ByUserIdOrderByCreatedAtDesc(user.id()).stream().limit(30).map(e -> Map.of("delta", e.getDelta(),
                "action", e.getActionCode(), "ref", String.valueOf(e.getRefId()), "at", e.getCreatedAt())).toList());
        m.put("note", Msg.t("faiPoints.fai_points_nao_sao_vendidos"));
        return m;
    }

    // ------------------------------------------------------------------ loja do quarto (Molde de Fábrica)
    @Transactional(readOnly = true)
    public List<Map<String, Object>> shop(CurrentUser user) {
        return shop.shop(user);
    }

    /** RF35.CA06 — "Provar no meu quarto": prévia aplicada na cena, sem compra, saldo intacto. */
    public Map<String, Object> tryOn(CurrentUser user, String sku, String moduleId) {
        return shop.tryOn(user, sku, moduleId);
    }

    public Map<String, Object> buy(CurrentUser user, String sku) {
        return buy(user, sku, null);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public Map<String, Object> buy(CurrentUser user, String sku, String requestKey) {
        return shop.buy(user, sku, requestKey);
    }

    /** Chave de pedido aceita: só letras, números e hífen (um UUID do navegador cabe), para caber na chave do ledger. */
    static String requestRef(String key) {
        return FaiPointsShop.requestRef(key);
    }

    @Transactional
    public Map<String, Object> apply(CurrentUser user, UUID inventoryId, String moduleId) {
        return roomItems.apply(user, inventoryId, moduleId);
    }

    /**
     * Retira do quarto um item comprado: o módulo volta ao acabamento de fábrica e o item continua no inventário (a
     * propriedade nunca depende de estar aplicado).
     */
    @Transactional
    public Map<String, Object> unapply(CurrentUser user, UUID inventoryId) {
        return roomItems.unapply(user, inventoryId);
    }

    /** Porta de acesso ao layout (implementada pelo RoomService) — evita dependência circular. */
    public interface RoomLayoutAccess {
        void setLevel(UUID userId, String level);

        List<String> compatibleModules(UUID userId, RoomCatalogItem item);

        void applyFinish(UUID userId, String moduleId, RoomCatalogItem item);

        /** Volta ao acabamento de fábrica os módulos que mostram {@code item} ({@code "ALL"} = guarda-roupa inteiro). */
        void resetFinish(UUID userId, String moduleId, RoomCatalogItem item);

        RoomLayout layout(UUID userId);
    }
}
