package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.SingularAttribute;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Administração do catálogo da loja Fashion AI e visões administrativas (sem filtro de status) de jogos FLAIR, selos,
 * cupons, peças de roupa e itens do quarto 3D. Os filtros aceitam qualquer atributo básico da entidade (igualdade),
 * o usuário (userId/ownerId) e busca textual (q).
 */
@Service
public class AdminCatalogService {
    private static final Set<String> RESERVED = Set.of("page", "size", "sort", "dir", "q");
    private static final Set<String> STORE_EDITABLE = Set.of("name", "moldId", "slotType", "widthCm", "finishJson", "rarity",
            "pricePoints", "requiredLevel", "stockLimit", "active", "kind", "material", "colorName", "description", "sealId",
            "logoUrl", "artUrl", "labelText", "bundleJson", "availableFrom", "availableUntil", "perUserLimit", "requiresSeal");

    private final Guard guard;
    private final Audit audit;
    private final RoomCatalogItemRepository store;
    private final RoomInventoryItemRepository roomItems;
    private final FlairMatchRepository matches;
    private final SealRepository seals;
    private final CouponRightRepository coupons;
    private final WardrobeItemRepository garments;

    public AdminCatalogService(Guard guard, Audit audit, RoomCatalogItemRepository store, RoomInventoryItemRepository roomItems,
                               FlairMatchRepository matches, SealRepository seals, CouponRightRepository coupons,
                               WardrobeItemRepository garments) {
        this.guard = guard; this.audit = audit; this.store = store; this.roomItems = roomItems;
        this.matches = matches; this.seals = seals; this.coupons = coupons; this.garments = garments;
    }

    // ---- Loja Fashion AI: listar / editar qualquer item à venda ----

    public Map<String, Object> storeItems(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        return page(store.findAll(spec(params, null), pageable(params, "createdAt")), AdminCatalogService::view);
    }

    public Map<String, Object> storeItem(CurrentUser user, String sku) {
        guard.requireAdmin(user);
        return view(store.findById(sku).orElseThrow(() -> notFound("STORE_ITEM_NOT_FOUND")));
    }

    @Transactional
    public Map<String, Object> updateStoreItem(CurrentUser user, String sku, Map<String, Object> changes) {
        guard.requireAdmin(user);
        RoomCatalogItem item = store.lockBySku(sku).orElseThrow(() -> notFound("STORE_ITEM_NOT_FOUND"));
        apply(item, changes);
        validate(item);
        store.save(item);
        audit.log(user, "ADMIN_STORE_ITEM_UPDATE", "room_catalog:" + sku, Map.of("fields", new TreeSet<>(changes.keySet())));
        return view(item);
    }

    @Transactional
    public Map<String, Object> setStoreItemActive(CurrentUser user, String sku, boolean active) {
        guard.requireAdmin(user);
        RoomCatalogItem item = store.lockBySku(sku).orElseThrow(() -> notFound("STORE_ITEM_NOT_FOUND"));
        item.setActive(active);
        store.save(item);
        audit.log(user, active ? "ADMIN_STORE_ITEM_ACTIVATE" : "ADMIN_STORE_ITEM_DEACTIVATE", "room_catalog:" + sku, Map.of());
        return view(item);
    }

    // ---- Catálogos administrativos (todos os status) ----

    public Map<String, Object> flairGames(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        return page(matches.findAll(spec(params, "createdByUser"), pageable(params, "createdAt")), AdminCatalogService::view);
    }

    public Map<String, Object> sealCatalog(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        return page(seals.findAll(spec(params, "owner"), pageable(params, "createdAt")), AdminCatalogService::view);
    }

    public Map<String, Object> couponCatalog(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        Map<String, String> p = new HashMap<>(params);
        // "userId" = titular do cupom; "ownerId" = emissor (ambos são relações)
        return page(coupons.findAll(spec(p, "user"), pageable(params, "createdAt")), AdminCatalogService::view);
    }

    public Map<String, Object> garmentCatalog(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        return page(garments.findAll(spec(params, "user"), pageable(params, "createdAt")), AdminCatalogService::view);
    }

    public Map<String, Object> roomItemCatalog(CurrentUser user, Map<String, String> params) {
        guard.requireAdmin(user);
        return page(roomItems.findAll(spec(params, null), pageable(params, "acquiredAt")), AdminCatalogService::view);
    }

    // ---- Internos ----

    private static PageRequest pageable(Map<String, String> p, String defaultSort) {
        int page = Math.max(0, parseInt(p.get("page"), 0));
        int size = Math.min(200, Math.max(1, parseInt(p.get("size"), 50)));
        String sort = p.getOrDefault("sort", defaultSort);
        if (!sort.matches("[A-Za-z0-9_]+")) throw new ApiException(400, "CATALOG_SORT_INVALID", "Invalid sort");
        Sort.Direction dir = "asc".equalsIgnoreCase(p.get("dir")) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(page, size, Sort.by(dir, sort));
    }

    private static int parseInt(String v, int d) {
        try { return v == null ? d : Integer.parseInt(v); } catch (NumberFormatException e) { return d; }
    }

    /** Igualdade em qualquer atributo básico; userId/ownerId filtram as relações com usuário; q busca em atributos de texto. */
    private static <T> Specification<T> spec(Map<String, String> params, String userRelation) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            for (var e : params.entrySet()) {
                String key = e.getKey(), value = e.getValue();
                if (RESERVED.contains(key) || value == null || value.isBlank()) continue;
                if (key.equals("userId") || key.equals("ownerId") || key.equals("createdByUserId")) {
                    String rel = key.equals("ownerId") ? "owner" : userRelation;
                    if (rel != null && has(root.getModel().getAttributes(), rel)
                            && root.getModel().getAttribute(rel).isAssociation()) {
                        ps.add(cb.equal(root.get(rel).get("id"), coerce(UUID.class, value)));
                        continue;
                    }
                }
                if (!has(root.getModel().getAttributes(), key)) throw new ApiException(400, "CATALOG_FILTER_UNKNOWN", "Unknown filter: " + key);
                Attribute<?, ?> a = root.getModel().getAttribute(key);
                if (a.isAssociation() || a.isCollection()) throw new ApiException(400, "CATALOG_FILTER_UNKNOWN", "Unknown filter: " + key);
                ps.add(cb.equal(root.get(key), coerce(a.getJavaType(), value)));
            }
            String q = params.get("q");
            if (q != null && !q.isBlank()) {
                List<Predicate> any = new ArrayList<>();
                for (SingularAttribute<? super T, ?> a : root.getModel().getSingularAttributes()) {
                    if (a.getJavaType() == String.class && !a.isAssociation() && !a.getName().endsWith("Json")) {
                        any.add(cb.like(cb.lower(root.get(a.getName())), "%" + q.toLowerCase().replace("%", "").replace("_", "") + "%"));
                    }
                }
                if (!any.isEmpty()) ps.add(cb.or(any.toArray(new Predicate[0])));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private static boolean has(Set<? extends Attribute<?, ?>> attrs, String name) {
        return attrs.stream().anyMatch(a -> a.getName().equals(name));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object coerce(Class<?> type, String v) {
        try {
            if (type == String.class) return v;
            if (type == UUID.class) return UUID.fromString(v);
            if (type == boolean.class || type == Boolean.class) return Boolean.parseBoolean(v);
            if (type == int.class || type == Integer.class) return Integer.valueOf(v);
            if (type == long.class || type == Long.class) return Long.valueOf(v);
            if (type == java.math.BigDecimal.class) return new java.math.BigDecimal(v);
            if (type == LocalDate.class) return LocalDate.parse(v);
            if (type == Instant.class) return Instant.parse(v);
            if (type.isEnum()) return Enum.valueOf((Class<Enum>) type, v.toUpperCase());
        } catch (RuntimeException ex) {
            throw new ApiException(400, "CATALOG_FILTER_INVALID", "Invalid filter value: " + v);
        }
        throw new ApiException(400, "CATALOG_FILTER_UNKNOWN", "Unsupported filter type");
    }

    private static <T> Map<String, Object> page(Page<T> p, java.util.function.Function<T, Map<String, Object>> mapper) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", p.getContent().stream().map(mapper).toList());
        m.put("page", p.getNumber());
        m.put("size", p.getSize());
        m.put("total", p.getTotalElements());
        m.put("totalPages", p.getTotalPages());
        return m;
    }

    /** Serializa os atributos básicos e os ids das relações (sem carregar grafos preguiçosos). */
    private static Map<String, Object> view(Object entity) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (Method g : entity.getClass().getMethods()) {
            String n = g.getName();
            if (g.getParameterCount() != 0 || n.equals("getClass") || !(n.startsWith("get") || n.startsWith("is")) || n.length() <= (n.startsWith("is") ? 2 : 3)) continue;
            String prop = Character.toLowerCase(n.charAt(n.startsWith("is") ? 2 : 3)) + n.substring(n.startsWith("is") ? 3 : 4);
            try {
                Object v = g.invoke(entity);
                if (v instanceof User u) { m.put(prop + "Id", u.getId()); m.put(prop + "Username", u.getUsername()); }
                else if (v == null || v instanceof CharSequence || v instanceof Number || v instanceof Boolean || v instanceof Enum
                        || v instanceof UUID || v instanceof Instant || v instanceof LocalDate) m.put(prop, v instanceof Enum<?> e ? e.name() : v);
                else if (v instanceof AuditableEntity a) m.put(prop + "Id", a.getId());
            } catch (ReflectiveOperationException | RuntimeException ignored) { /* atributo indisponível */ }
        }
        return m;
    }

    private static void apply(RoomCatalogItem item, Map<String, Object> changes) {
        if (changes == null || changes.isEmpty()) throw new ApiException(400, "STORE_ITEM_EMPTY_UPDATE", "No changes");
        for (var e : changes.entrySet()) {
            if (!STORE_EDITABLE.contains(e.getKey())) throw new ApiException(400, "STORE_ITEM_FIELD_NOT_EDITABLE", "Field not editable: " + e.getKey());
            Method setter = Arrays.stream(RoomCatalogItem.class.getMethods())
                    .filter(m -> m.getName().equals("set" + Character.toUpperCase(e.getKey().charAt(0)) + e.getKey().substring(1)) && m.getParameterCount() == 1)
                    .findFirst().orElseThrow(() -> new ApiException(400, "STORE_ITEM_FIELD_NOT_EDITABLE", "Field not editable: " + e.getKey()));
            Class<?> t = setter.getParameterTypes()[0];
            Object v = e.getValue();
            try {
                setter.invoke(item, v == null ? (t.isPrimitive() ? fail(e.getKey()) : null) : coerce(t, v.toString()));
            } catch (ReflectiveOperationException ex) {
                throw new ApiException(400, "STORE_ITEM_FIELD_INVALID", "Invalid value for " + e.getKey());
            }
        }
    }

    private static Object fail(String field) { throw new ApiException(400, "STORE_ITEM_FIELD_INVALID", "Invalid value for " + field); }

    private static void validate(RoomCatalogItem i) {
        if (i.getName() == null || i.getName().isBlank() || i.getName().length() > 120 || i.getPricePoints() < 0
                || i.getStockLimit() != null && i.getStockLimit() < i.getSoldCount()
                || i.getPerUserLimit() != null && i.getPerUserLimit() < 1
                || i.getAvailableFrom() != null && i.getAvailableUntil() != null && i.getAvailableUntil().isBefore(i.getAvailableFrom())) {
            throw new ApiException(400, "STORE_ITEM_INVALID", "Invalid store item");
        }
    }

    private static ApiException notFound(String code) { return new ApiException(404, code, "Not found"); }
}
