package br.com.fashionai.application.testkit;

import br.com.fashionai.domain.model.AuditableEntity;
import org.mockito.Mockito;
import org.mockito.internal.stubbing.defaultanswers.ReturnsEmptyValues;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;
import org.springframework.core.ResolvableType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Repositório JPA em memória para os testes de unidade dos services: guarda as entidades salvas e responde aos métodos
 * do {@link JpaRepository} e às consultas derivadas do nome ({@code findByUserIdAndStatus}, {@code countBy…},
 * {@code existsBy…In}, {@code findTop5By…OrderBy…}). Consultas escritas à mão ({@code @Query}) não têm como ser
 * interpretadas aqui: devolvem vazio, e o teste que depende delas as programa com {@code Mockito.when}.
 */
public final class MemoryRepository implements Answer<Object> {
    private static final Pattern DERIVED = Pattern.compile(
            "^(find|read|get|query|search|stream|count|exists|delete|remove)(?:Distinct)?(?:First|Top)?(\\d*)(?:Distinct)?\\w*?By(.+)$");
    private static final String[] OPS = {"IsNotNull", "NotNull", "IsNull", "Null", "IsTrue", "True", "IsFalse", "False",
            "NotIn", "In", "GreaterThanEqual", "GreaterThan", "LessThanEqual", "LessThan", "After", "Before", "Between",
            "NotContaining", "ContainingIgnoreCase", "Containing", "StartingWith", "EndingWith", "LikeIgnoreCase", "Like",
            "IgnoreCase", "Not", "Is", "Equals"};
    private static final ReturnsEmptyValues EMPTY = new ReturnsEmptyValues();

    private final Class<?> entityType;
    private final Map<Object, Object> rows = new LinkedHashMap<>();
    private final Map<Object, Object> keyless = new IdentityHashMap<>();

    private MemoryRepository(Class<?> entityType) {
        this.entityType = entityType;
    }

    /** Cria o repositório em memória para a interface dada (um {@code JpaRepository<Entidade, Id>}). */
    @SuppressWarnings("unchecked")
    public static <R> R of(Class<R> repositoryType) {
        Class<?> entity = ResolvableType.forClass(repositoryType).as(JpaRepository.class).getGeneric(0).resolve(Object.class);
        return Mockito.mock(repositoryType, Mockito.withSettings().defaultAnswer(new MemoryRepository(entity)).stubOnly());
    }

    /** As entidades guardadas no repositório em memória (na ordem em que foram salvas). */
    @SuppressWarnings("unchecked")
    public static <E> List<E> rows(Object repository) {
        MemoryRepository m = (MemoryRepository) Mockito.mockingDetails(repository).getMockCreationSettings().getDefaultAnswer();
        return (List<E>) m.all();
    }

    @Override
    public Object answer(InvocationOnMock inv) throws Throwable {
        Method method = inv.getMethod();
        Object[] args = inv.getArguments();
        String name = method.getName();
        Class<?> ret = method.getReturnType();
        if (method.getDeclaringClass() == Object.class) {
            return EMPTY.answer(inv);
        }
        switch (name) {
            case "save", "saveAndFlush" -> {
                return store(args[0]);
            }
            case "saveAll", "saveAllAndFlush" -> {
                List<Object> out = new ArrayList<>();
                ((Iterable<?>) args[0]).forEach(e -> out.add(store(e)));
                return out;
            }
            case "findById" -> {
                return Optional.ofNullable(rows.get(args[0]));
            }
            case "getReferenceById", "getById", "getOne" -> {
                return rows.get(args[0]);
            }
            case "existsById" -> {
                return rows.containsKey(args[0]);
            }
            case "findAllById" -> {
                List<Object> out = new ArrayList<>();
                ((Iterable<?>) args[0]).forEach(id -> Optional.ofNullable(rows.get(id)).ifPresent(out::add));
                return out;
            }
            case "findAll" -> {
                return adapt(all(), ret, args);
            }
            case "count" -> {
                return (long) all().size();
            }
            case "deleteById" -> {
                rows.remove(args[0]);
                return null;
            }
            case "delete" -> {
                remove(args[0]);
                return null;
            }
            case "deleteAll", "deleteAllInBatch", "deleteAllById", "deleteAllByIdInBatch" -> {
                if (args.length == 0) {
                    rows.clear();
                    keyless.clear();
                } else {
                    ((Iterable<?>) args[0]).forEach(x -> {
                        if (rows.containsKey(x)) {
                            rows.remove(x);
                        } else {
                            remove(x);
                        }
                    });
                }
                return null;
            }
            case "flush" -> {
                return null;
            }
            default -> {
            }
        }
        if (method.isAnnotationPresent(Query.class) || method.isAnnotationPresent(Modifying.class)) {
            return empty(inv, ret);
        }
        Matcher m = DERIVED.matcher(name);
        if (!m.matches()) {
            return empty(inv, ret);
        }
        try {
            String verb = m.group(1);
            int limit = m.group(2).isEmpty() ? (name.matches("^\\w+?(First|Top)\\w*By.+") ? 1 : Integer.MAX_VALUE) : Integer.parseInt(m.group(2));
            String criteria = m.group(3);
            int order = criteria.indexOf("OrderBy");
            String orderBy = order >= 0 ? criteria.substring(order + "OrderBy".length()) : null;
            if (order >= 0) {
                criteria = criteria.substring(0, order);
            }
            List<Object> matched = new ArrayList<>();
            for (Object row : all()) {
                if (criteria.isEmpty() || matchesAny(row, criteria, args)) {
                    matched.add(row);
                }
            }
            if (orderBy != null) {
                sort(matched, orderBy);
            }
            if (matched.size() > limit) {
                matched = new ArrayList<>(matched.subList(0, limit));
            }
            return switch (verb) {
                case "count" -> ret == int.class || ret == Integer.class ? (Object) matched.size() : (Object) (long) matched.size();
                case "exists" -> !matched.isEmpty();
                case "delete", "remove" -> {
                    matched.forEach(this::remove);
                    yield ret == void.class ? null : ret == int.class || ret == Integer.class ? (Object) matched.size()
                            : ret == long.class || ret == Long.class ? (Object) (long) matched.size() : adapt(matched, ret, args);
                }
                default -> adapt(matched, ret, args);
            };
        } catch (RuntimeException e) {
            return empty(inv, ret);
        }
    }

    private Object empty(InvocationOnMock inv, Class<?> ret) throws Throwable {
        if (Page.class.isAssignableFrom(ret)) {
            return Page.empty();
        }
        if (Slice.class.isAssignableFrom(ret)) {
            return new SliceImpl<>(List.of());
        }
        if (ret == BigDecimal.class) {
            return BigDecimal.ZERO;
        }
        return EMPTY.answer(inv);
    }

    private List<Object> all() {
        List<Object> out = new ArrayList<>(rows.values());
        out.addAll(keyless.values());
        return out;
    }

    private Object store(Object entity) {
        boolean fresh = !rows.containsValue(entity) && !keyless.containsKey(entity);
        lifecycle(entity, fresh ? jakarta.persistence.PrePersist.class : jakarta.persistence.PreUpdate.class);
        if (entity instanceof AuditableEntity a) {
            if (a.getId() == null) {
                a.assignId(UUID.randomUUID());
            }
            if (a.getCreatedAt() == null) {
                a.markCreatedAt(Instant.now());
            }
        }
        Object id = idOf(entity);
        if (id == null) {
            id = generateId(entity);
        }
        if (id == null) {
            keyless.put(entity, entity);
        } else {
            rows.put(id, entity);
        }
        if (fresh) {
            lifecycle(entity, jakarta.persistence.PostPersist.class);
        }
        return entity;
    }

    /** Chama os callbacks JPA da entidade ({@code @PrePersist}, {@code @PreUpdate}, {@code @PostPersist}), como o Hibernate faria. */
    private static void lifecycle(Object entity, Class<? extends java.lang.annotation.Annotation> phase) {
        for (Class<?> c = entity.getClass(); c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                if (m.isAnnotationPresent(phase) && m.getParameterCount() == 0) {
                    try {
                        m.setAccessible(true);
                        m.invoke(entity);
                    } catch (ReflectiveOperationException e) {
                        throw new IllegalStateException(e);
                    }
                }
            }
        }
    }

    private void remove(Object entity) {
        Object id = idOf(entity);
        if (id != null) {
            rows.remove(id);
        }
        keyless.remove(entity);
    }

    /** Id UUID gerado (como o {@code @GeneratedValue} ou o {@code @PrePersist} faria) quando a entidade chega sem ele. */
    private static Object generateId(Object entity) {
        for (Class<?> c = entity.getClass(); c != null && c != Object.class; c = c.getSuperclass()) {
            for (java.lang.reflect.Field f : c.getDeclaredFields()) {
                if (f.isAnnotationPresent(jakarta.persistence.Id.class) && f.getType() == UUID.class) {
                    try {
                        f.setAccessible(true);
                        UUID id = UUID.randomUUID();
                        f.set(entity, id);
                        return id;
                    } catch (ReflectiveOperationException e) {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    /** Valor do campo {@code @Id} da entidade (getId() ou o campo anotado, como o código dos modelos de desafio). */
    private static Object idOf(Object entity) {
        if (entity == null) {
            return null;
        }
        for (Class<?> c = entity.getClass(); c != null && c != Object.class; c = c.getSuperclass()) {
            for (java.lang.reflect.Field f : c.getDeclaredFields()) {
                if (f.isAnnotationPresent(jakarta.persistence.Id.class) || f.isAnnotationPresent(jakarta.persistence.EmbeddedId.class)) {
                    try {
                        f.setAccessible(true);
                        return f.get(entity);
                    } catch (ReflectiveOperationException e) {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private Object adapt(List<Object> list, Class<?> ret, Object[] args) {
        if (Optional.class.isAssignableFrom(ret)) {
            return list.stream().findFirst();
        }
        if (Page.class.isAssignableFrom(ret)) {
            Pageable p = pageable(args);
            if (p != null && p.isPaged()) {
                int from = (int) Math.min(p.getOffset(), list.size());
                int to = Math.min(from + p.getPageSize(), list.size());
                return new PageImpl<>(list.subList(from, to), p, list.size());
            }
            return new PageImpl<>(list);
        }
        if (Slice.class.isAssignableFrom(ret)) {
            return new SliceImpl<>(list);
        }
        if (Stream.class.isAssignableFrom(ret)) {
            return list.stream();
        }
        if (Set.class.isAssignableFrom(ret)) {
            return new LinkedHashSet<>(list);
        }
        if (Iterable.class.isAssignableFrom(ret) || Collection.class.isAssignableFrom(ret)) {
            Pageable p = pageable(args);
            if (p != null && p.isPaged() && list.size() > p.getPageSize()) {
                return new ArrayList<>(list.subList(0, p.getPageSize()));
            }
            return list;
        }
        if (ret.isInstance(list.isEmpty() ? null : list.get(0)) || ret.isAssignableFrom(entityType)) {
            return list.isEmpty() ? null : list.get(0);
        }
        return null;
    }

    private static Pageable pageable(Object[] args) {
        for (Object a : args) {
            if (a instanceof Pageable p) {
                return p;
            }
        }
        return null;
    }

    private boolean matchesAny(Object row, String criteria, Object[] args) {
        int[] cursor = {0};
        boolean any = false;
        for (String group : criteria.split("Or(?=[A-Z])")) {
            boolean all = true;
            for (String part : group.split("And(?=[A-Z])")) {
                if (!matches(row, part, args, cursor)) {
                    all = false;
                }
            }
            any |= all;
        }
        return any;
    }

    private boolean matches(Object row, String part, Object[] args, int[] cursor) {
        String op = "";
        String prop = part;
        boolean ignoreCase = false;
        if (prop.endsWith("AllIgnoreCase")) {
            prop = prop.substring(0, prop.length() - "AllIgnoreCase".length());
            ignoreCase = true;
        }
        for (String o : OPS) {
            if (prop.endsWith(o) && prop.length() > o.length()) {
                op = o;
                prop = prop.substring(0, prop.length() - o.length());
                break;
            }
        }
        if (op.equals("IgnoreCase")) {
            ignoreCase = true;
            op = "";
            for (String o : OPS) {
                if (!o.equals("IgnoreCase") && prop.endsWith(o) && prop.length() > o.length()) {
                    op = o;
                    prop = prop.substring(0, prop.length() - o.length());
                    break;
                }
            }
        }
        Object value = Beans.path(row, prop);
        switch (op) {
            case "IsNull", "Null" -> {
                return value == null;
            }
            case "IsNotNull", "NotNull" -> {
                return value != null;
            }
            case "IsTrue", "True" -> {
                return Boolean.TRUE.equals(value);
            }
            case "IsFalse", "False" -> {
                return Boolean.FALSE.equals(value);
            }
            default -> {
            }
        }
        Object arg = args[cursor[0]++];
        boolean ic = ignoreCase;
        return switch (op) {
            case "In" -> arg instanceof Collection<?> c && c.stream().anyMatch(x -> same(value, x, ic));
            case "NotIn" -> !(arg instanceof Collection<?> c) || c.stream().noneMatch(x -> same(value, x, ic));
            case "Not" -> !same(value, arg, ignoreCase);
            case "GreaterThan", "After" -> compare(value, arg) > 0;
            case "GreaterThanEqual" -> compare(value, arg) >= 0;
            case "LessThan", "Before" -> compare(value, arg) < 0;
            case "LessThanEqual" -> compare(value, arg) <= 0;
            case "Between" -> compare(value, arg) >= 0 && compare(value, args[cursor[0]++]) <= 0;
            case "Containing", "ContainingIgnoreCase", "Like", "LikeIgnoreCase" -> text(value).contains(text(arg).replace("%", ""));
            case "NotContaining" -> !text(value).contains(text(arg));
            case "StartingWith" -> text(value).startsWith(text(arg));
            case "EndingWith" -> text(value).endsWith(text(arg));
            default -> same(value, arg, ignoreCase);
        };
    }

    private static String text(Object o) {
        return o == null ? "" : o.toString().toLowerCase(Locale.ROOT);
    }

    private static boolean same(Object a, Object b, boolean ignoreCase) {
        if (a == null || b == null) {
            return a == b;
        }
        if (ignoreCase || a instanceof Enum<?> || b instanceof Enum<?>) {
            String x = a instanceof Enum<?> e ? e.name() : a.toString();
            String y = b instanceof Enum<?> e ? e.name() : b.toString();
            return ignoreCase ? x.equalsIgnoreCase(y) : x.equals(y);
        }
        if (a instanceof Number && b instanceof Number) {
            return new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString())) == 0;
        }
        if (idOf(b) != null && !b.getClass().equals(a.getClass()) && a.equals(idOf(b))) {
            return true;
        }
        return a.equals(b) || (idOf(a) != null && idOf(a).equals(idOf(b)));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static int compare(Object a, Object b) {
        if (a == null || b == null) {
            return a == null ? -1 : 1;
        }
        if (a instanceof Number && b instanceof Number) {
            return new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString()));
        }
        return ((Comparable) a).compareTo(b);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void sort(List<Object> list, String orderBy) {
        List<java.util.Comparator<Object>> keys = new ArrayList<>();
        for (String piece : orderBy.split("(?<=Asc|Desc)")) {
            boolean desc = piece.endsWith("Desc");
            String prop = piece.replaceAll("(Asc|Desc)$", "");
            if (prop.isEmpty()) {
                continue;
            }
            java.util.Comparator<Object> c = (x, y) -> {
                Object a = Beans.path(x, prop);
                Object b = Beans.path(y, prop);
                if (a == null || b == null) {
                    return a == b ? 0 : a == null ? -1 : 1;
                }
                return ((Comparable) a).compareTo(b);
            };
            keys.add(desc ? c.reversed() : c);
        }
        keys.stream().reduce(java.util.Comparator::thenComparing).ifPresent(list::sort);
    }
}
