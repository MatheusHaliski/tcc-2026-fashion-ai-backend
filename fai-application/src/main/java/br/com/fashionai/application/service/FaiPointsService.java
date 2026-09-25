package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
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
        ESTREIA(0, Msg.k("faiPoints.fai_origem_smart_mirror_vista"), Msg.k("faiPoints.branco_de_fabrica")),
        STUDIO(300, Msg.k("faiPoints.iluminacao_guiada_personalizavel_e"), Msg.k("faiPoints.primeiros_acabamentos_e_materiais")),
        LOFT(900, Msg.k("faiPoints.n2_modulos_e_mais_categorias"), "quarto maior"),
        CLOSET(2000, Msg.k("faiPoints.sapateira_vitrine_de_bolsas_e"), Msg.k("faiPoints.modulos_especializados")),
        ATELIER(4000, Msg.k("faiPoints.ilha_central_bancada_de_looks"), "ilha central"),
        PENTHOUSE(7500, Msg.k("faiPoints.troca_de_estacao_pecas_fora"), "ambiente premium"),
        MAISON(12000, Msg.k("faiPoints.closet_de_assinatura_itens_exclusivos"), Msg.k("faiPoints.closet_de_assinatura"));

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
    private final WardrobeCreatorService creator;

    public FaiPointsService(FaiPointsLedgerEntryRepository ledger, FaiPointsRuleRepository rules,
                            RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory, RoomLayoutAccess layouts,
                            NotificationService notifications, WardrobeCreatorService creator) {
        this.creator = creator;
        this.ledger = ledger;
        this.rules = rules;
        this.catalog = catalog;
        this.inventory = inventory;
        this.layouts = layouts;
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
        Level after = level(userId);
        boolean up = after.ordinal() > before.ordinal();
        if (up) {
            layouts.setLevel(userId, after.name());
            notifications.notify(userId, null, NotificationType.ROOM_LEVEL_UP, "ROOM", null, Msg.k("faiPoints.seu_quarto_evoluiu", after.name()),
                    Msg.k("faiPoints.nivel_liberado", after.name(), after.unlocks), Map.of("level", after.name()));
        }
        return new Award(true, points, false, Msg.t("faiPoints.fai_pts", points), after, up);
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
    /**
     * Loja do quarto: todos os blocos do móvel por material, cor e selo de identidade (fábrica FAI e itens criados por
     * marcas/celebridades no "Criar guarda-roupa 3D"), com as condições de compra de cada item.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> shop(CurrentUser user) {
        Level lvl = level(user.id());
        long bal = balance(user.id());
        Map<String, List<Map<String, Object>>> mine = new java.util.HashMap<>();
        for (RoomInventoryItem i : inventory.findByUserId(user.id())) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("inventoryId", i.getId());
            e.put("appliedModule", i.getAppliedModule());
            e.put("serial", i.getSerial());
            e.put("acquiredAt", i.getAcquiredAt());
            mine.computeIfAbsent(i.getSku(), k -> new ArrayList<>()).add(e);
        }
        return catalog.findByActiveTrueOrderByPricePoints().stream()
                .filter(c -> !"EXPIRADO".equals(WardrobeCreatorService.availability(c, Instant.now())) || mine.containsKey(c.getSku()))
                .map(c -> {
                    Map<String, Object> m = creator.view(c, user.id());
                    m.put("levelOk", lvl.atLeast(Level.valueOf(c.getRequiredLevel())));
                    m.put("affordable", bal >= c.getPricePoints());
                    m.put("owned", mine.containsKey(c.getSku()));
                    m.put("inventory", mine.getOrDefault(c.getSku(), List.of()));   // unidades compradas e onde estão aplicadas
                    m.put("compatibleModules", layouts.compatibleModules(user.id(), c));
                    return m;
                }).toList();
    }

    /** RF35.CA06 — "Provar no meu quarto": prévia aplicada na cena, sem compra, saldo intacto. */
    public Map<String, Object> tryOn(CurrentUser user, String sku, String moduleId) {
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound(Msg.t("faiPoints.item_da_loja")));
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (moduleId != null && !compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", Msg.t("faiPoints.este_item_nao_cabe_no", (compatible.isEmpty() ? Msg.t("faiPoints.nenhum_modulo_do_seu_nivel") : String.join(", ", compatible))));
        }
        return Map.of("preview", true, "sku", sku, "module", moduleId == null ? (compatible.isEmpty() ? "" : compatible.get(0)) : moduleId,
                "finish", Json.map(c.getFinishJson()), "balance", balance(user.id()), "note", Msg.t("faiPoints.previa_descartada_ao_sair_nada"));
    }

    @Transactional
    public Map<String, Object> buy(CurrentUser user, String sku) {
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound(Msg.t("faiPoints.item_da_loja")));
        Level lvl = level(user.id());
        if (!lvl.atLeast(Level.valueOf(c.getRequiredLevel()))) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("faiPoints.disponivel_a_partir_do_nivel", c.getRequiredLevel()));
        }
        if (c.getStockLimit() != null && c.getSoldCount() >= c.getStockLimit()) {
            throw new ApiException(409, "ESGOTADO", Msg.t("faiPoints.edicao_limitada_esgotada_item_cosmetico"));
        }
        String blocker = creator.blocker(user.id(), c);
        if (blocker != null) {
            throw new ApiException(409, "CONDICAO_DE_COMPRA", blocker);
        }
        long bal = balance(user.id());
        if (bal < c.getPricePoints()) {
            throw new ApiException(409, "SALDO_INSUFICIENTE", Msg.t("faiPoints.saldo_de_fai_pts_o", bal, c.getPricePoints()));
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
            throw ApiException.forbidden(Msg.t("faiPoints.item_de_outro_usuario"));
        }
        RoomCatalogItem c = catalog.findById(item.getSku()).orElseThrow();
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (!compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", Msg.t("faiPoints.o_item_cabe_em_rf35", String.join(", ", compatible)));
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
