package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
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

/**
 * RF35 — FAI Points: conquistados pelo uso, nunca vendidos (CA08). Duas medidas: saldo (gastável na loja do
 * quarto) e pontos vitalícios (definem o nível, nunca diminuem). Ledger append-only com chave de idempotência
 * (CA01); limite diário atingido não bloqueia a ação, só não pontua (CA02). Nenhuma função básica fica atrás
 * de nível ou saldo (§0.1 / CA05).
 */
@Service
public class FaiPointsService {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    /** §5.3 — nível, limiar de pontos vitalícios (calibração inicial: ~1 semana até Studio, ~2 meses até Closet). */
    public enum Level {
        ESTREIA(0, "FAI Origem, Smart Mirror, Vista-me, Copilot, gavetas com categoria", "branco de fábrica"),
        STUDIO(300, "Iluminação guiada personalizável e monograma nas portas", "primeiros acabamentos e materiais"),
        LOFT(900, "+2 módulos e mais categorias próprias", "quarto maior"),
        CLOSET(2000, "Sapateira, vitrine de bolsas e porta-joias", "módulos especializados"),
        ATELIER(4000, "Ilha central = bancada de looks (comparar 2–3 looks) e regras automáticas de organização", "ilha central"),
        PENTHOUSE(7500, "Troca de estação: peças fora de estação no maleiro, ignoradas pelo Vista-me", "ambiente premium"),
        MAISON(12000, "Closet de assinatura, itens exclusivos e Colabs Maison", "closet de assinatura");

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

        public boolean atLeast(Level other) {
            return ordinal() >= other.ordinal();
        }
    }

    public record Award(boolean granted, int points, boolean capReached, String message, Level level, boolean levelUp) {
    }

    private final FaiPointsLedgerEntryRepository ledger;
    private final FaiPointsRuleRepository rules;
    private final RoomCatalogItemRepository catalog;
    private final RoomInventoryItemRepository inventory;
    private final RoomLayoutAccess layouts;
    private final NotificationService notifications;

    public FaiPointsService(FaiPointsLedgerEntryRepository ledger, FaiPointsRuleRepository rules,
                            RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory, RoomLayoutAccess layouts,
                            NotificationService notifications) {
        this.ledger = ledger;
        this.rules = rules;
        this.catalog = catalog;
        this.inventory = inventory;
        this.layouts = layouts;
        this.notifications = notifications;
    }

    /** Lança pontos de forma idempotente; points > 0 sobrescreve o valor da regra (conquistas, desafios). */
    @Transactional
    public Award award(UUID userId, String actionCode, String refType, String refId, Integer pointsOverride) {
        FaiPointsRule rule = rules.findById(actionCode).orElse(null);
        if (rule == null || !rule.isActive()) {
            return new Award(false, 0, false, "Ação sem regra de pontos.", level(userId), false);
        }
        String key = userId + ":" + actionCode + ":" + (refId == null ? LocalDate.now(ZONE) : refId);
        if (ledger.existsByIdempotencyKey(key)) {
            return new Award(false, 0, false, "Evento já pontuado.", level(userId), false);
        }
        Instant dayStart = LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant();
        if (rule.getDailyCap() != null && ledger.countByUserIdAndActionCodeAndCreatedAtAfter(userId, actionCode, dayStart) >= rule.getDailyCap()) {
            return new Award(false, 0, true, "Limite diário de pontos desta ação atingido — a ação continua valendo.", level(userId), false);
        }
        Instant weekStart = LocalDate.now(ZONE).with(DayOfWeek.MONDAY).atStartOfDay(ZONE).toInstant();
        if (rule.getWeeklyCap() != null && ledger.countByUserIdAndActionCodeAndCreatedAtAfter(userId, actionCode, weekStart) >= rule.getWeeklyCap()) {
            return new Award(false, 0, true, "Limite semanal de pontos desta ação atingido.", level(userId), false);
        }
        int points = pointsOverride != null && pointsOverride > 0 ? pointsOverride : rule.getPoints();
        if (points <= 0) {
            return new Award(false, 0, false, "Ação sem pontos.", level(userId), false);
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
        Level after = level(userId);
        boolean up = after.ordinal() > before.ordinal();
        if (up) {
            layouts.setLevel(userId, after.name());
            notifications.notify(userId, null, NotificationType.ROOM_LEVEL_UP, "ROOM", null, "Seu quarto evoluiu: " + after.name(),
                    "Nível " + after.name() + " liberado — " + after.unlocks + ".", Map.of("level", after.name()));
        }
        return new Award(true, points, false, "+" + points + " FAI pts", after, up);
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
                "points", r.getPoints(), "dailyCap", String.valueOf(r.getDailyCap()), "description", String.valueOf(r.getDescription()))).toList());
        m.put("recent", ledger.findTop100ByUserIdOrderByCreatedAtDesc(user.id()).stream().limit(30).map(e -> Map.of("delta", e.getDelta(),
                "action", e.getActionCode(), "ref", String.valueOf(e.getRefId()), "at", e.getCreatedAt())).toList());
        m.put("note", "FAI Points não são vendidos por dinheiro real e não compram posição em ranking (RF35.CA08).");
        return m;
    }

    // ------------------------------------------------------------------ loja do quarto (Molde de Fábrica)
    @Transactional(readOnly = true)
    public List<Map<String, Object>> shop(CurrentUser user) {
        Level lvl = level(user.id());
        long bal = balance(user.id());
        return catalog.findByActiveTrueOrderByPricePoints().stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sku", c.getSku());
            m.put("name", c.getName());
            m.put("moldId", c.getMoldId());
            m.put("slotType", c.getSlotType());
            m.put("widthCm", c.getWidthCm());
            m.put("finish", Json.map(c.getFinishJson()));
            m.put("rarity", c.getRarity());
            m.put("pricePoints", c.getPricePoints());
            m.put("requiredLevel", c.getRequiredLevel());
            m.put("levelOk", lvl.atLeast(Level.valueOf(c.getRequiredLevel())));
            m.put("affordable", bal >= c.getPricePoints());
            m.put("owned", inventory.existsByUserIdAndSku(user.id(), c.getSku()));
            m.put("stockLeft", c.getStockLimit() == null ? null : Math.max(0, c.getStockLimit() - c.getSoldCount()));
            m.put("compatibleModules", layouts.compatibleModules(user.id(), c));
            return m;
        }).toList();
    }

    /** RF35.CA06 — "Provar no meu quarto": prévia aplicada na cena, sem compra, saldo intacto. */
    public Map<String, Object> tryOn(CurrentUser user, String sku, String moduleId) {
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound("Item da loja"));
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (moduleId != null && !compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", "Este item não cabe no módulo escolhido. Cabe em: "
                    + (compatible.isEmpty() ? "nenhum módulo do seu nível atual" : String.join(", ", compatible)) + ".");
        }
        return Map.of("preview", true, "sku", sku, "module", moduleId == null ? (compatible.isEmpty() ? "" : compatible.get(0)) : moduleId,
                "finish", Json.map(c.getFinishJson()), "balance", balance(user.id()), "note", "Prévia descartada ao sair — nada foi comprado.");
    }

    @Transactional
    public Map<String, Object> buy(CurrentUser user, String sku) {
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound("Item da loja"));
        Level lvl = level(user.id());
        if (!lvl.atLeast(Level.valueOf(c.getRequiredLevel()))) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", "Disponível a partir do nível " + c.getRequiredLevel() + ".");
        }
        if (c.getStockLimit() != null && c.getSoldCount() >= c.getStockLimit()) {
            throw new ApiException(409, "ESGOTADO", "Edição limitada esgotada (item cosmético — ETI-01).");
        }
        long bal = balance(user.id());
        if (bal < c.getPricePoints()) {
            throw new ApiException(409, "SALDO_INSUFICIENTE", "Saldo de " + bal + " FAI pts; o item custa " + c.getPricePoints() + ".");
        }
        if (c.getPricePoints() > 0) {
            FaiPointsLedgerEntry e = new FaiPointsLedgerEntry();
            e.setUserId(user.id());
            e.setDelta(-c.getPricePoints());
            e.setActionCode("SHOP_PURCHASE");
            e.setRefType("SKU");
            e.setRefId(sku);
            e.setIdempotencyKey(user.id() + ":SHOP_PURCHASE:" + sku + ":" + UUID.randomUUID());
            e.setCountsLifetime(false);
            ledger.save(e);
        }
        c.setSoldCount(c.getSoldCount() + 1);
        RoomInventoryItem item = new RoomInventoryItem();
        item.setUserId(user.id());
        item.setSku(sku);
        item.setSerial(c.getStockLimit() == null ? null : c.getSoldCount());
        item.setSource("PURCHASE");
        item.setAcquiredAt(Instant.now());
        inventory.save(item);
        return Map.of("inventoryId", item.getId(), "sku", sku, "balance", balance(user.id()), "lifetime", lifetime(user.id()),
                "level", level(user.id()).name(), "serial", String.valueOf(item.getSerial()));
    }

    @Transactional
    public Map<String, Object> apply(CurrentUser user, UUID inventoryId, String moduleId) {
        RoomInventoryItem item = inventory.findById(inventoryId).orElseThrow(() -> ApiException.notFound("Item"));
        if (!item.getUserId().equals(user.id())) {
            throw ApiException.forbidden("Item de outro usuário.");
        }
        RoomCatalogItem c = catalog.findById(item.getSku()).orElseThrow();
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (!compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", "O item cabe em: " + String.join(", ", compatible) + " (RF35.CA07).");
        }
        item.setAppliedModule(moduleId);
        layouts.applyFinish(user.id(), moduleId, c);
        return Map.of("applied", true, "module", moduleId, "sku", c.getSku());
    }

    /** Porta de acesso ao layout (implementada pelo RoomService) — evita dependência circular. */
    public interface RoomLayoutAccess {
        void setLevel(UUID userId, String level);

        List<String> compatibleModules(UUID userId, RoomCatalogItem item);

        void applyFinish(UUID userId, String moduleId, RoomCatalogItem item);

        RoomLayout layout(UUID userId);
    }
}
