package br.com.fashionai.web.controller;

import org.springframework.http.ResponseEntity;

import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Proxy;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Stream;

/**
 * Gravador das chamadas feitas aos dublês ({@link ServiceFakes} e proxies de interfaces) e fábrica de valores
 * de retorno: cada valor devolvido é uma instância nova, para que o teste confira por identidade que o
 * controller repassou exatamente o que o serviço respondeu.
 */
final class Fk {
    record Call(String owner, String method, Object[] args, Object returned) {
    }

    static final List<Call> calls = new ArrayList<>();

    private Fk() {
    }

    static void reset() {
        calls.clear();
    }

    static Object call(Object owner, String method, Class<?> returnType, Object[] args) {
        Object value = value(returnType, 0);
        calls.add(new Call(owner.getClass().getSimpleName(), method, args, value));
        return value;
    }

    /** Argumento de construtor dos dublês: interfaces viram proxies; o resto, padrão neutro. */
    static Object arg(Class<?> type) {
        if (type.isInterface()) return proxy(type);
        if (type.isPrimitive()) return primitive(type);
        if (type == String.class) return "";
        for (Class<?> fake : ServiceFakes.class.getDeclaredClasses()) {
            if (fake.getSuperclass() == type) {
                try {
                    Constructor<?> k = fake.getDeclaredConstructor();
                    k.setAccessible(true);
                    return k.newInstance();
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException("dublê de " + type.getName(), e);
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    static <T> T proxy(Class<T> type) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (p, m, a) -> {
            switch (m.getName()) {
                case "toString" -> { if (m.getParameterCount() == 0) return "Fk<" + type.getSimpleName() + ">"; }
                case "hashCode" -> { if (m.getParameterCount() == 0) return System.identityHashCode(p); }
                case "equals" -> { if (m.getParameterCount() == 1) return p == a[0]; }
                default -> { }
            }
            Object value = value(m.getReturnType(), 0);
            calls.add(new Call(type.getSimpleName(), m.getName(), a == null ? new Object[0] : a, value));
            return value;
        });
    }

    static Object primitive(Class<?> t) {
        if (t == boolean.class) return true;
        if (t == int.class) return 7;
        if (t == long.class) return 7L;
        if (t == double.class) return 7.0;
        if (t == float.class) return 7f;
        if (t == short.class) return (short) 7;
        if (t == byte.class) return (byte) 7;
        if (t == char.class) return 'x';
        return null;
    }

    static Object value(Class<?> t, int depth) {
        if (t == void.class || t == Void.class) return null;
        if (t.isPrimitive()) return primitive(t);
        if (t == Boolean.class) return true;
        if (t == Integer.class) return 7;
        if (t == Long.class) return 7L;
        if (t == Double.class) return 7.0;
        if (t == Float.class) return 7f;
        if (t == String.class) return new String("fake");
        if (t == Object.class) return null;
        if (t == UUID.class) return UUID.randomUUID();
        if (t == Instant.class) return Instant.parse("2026-01-01T00:00:00Z");
        if (t == LocalDate.class) return LocalDate.of(2026, 1, 1);
        if (t == LocalDateTime.class) return LocalDateTime.of(2026, 1, 1, 0, 0);
        if (t == OffsetDateTime.class) return OffsetDateTime.parse("2026-01-01T00:00:00Z");
        if (t == Duration.class) return Duration.ofSeconds(1);
        if (t == BigDecimal.class) return new BigDecimal("7");
        if (t == Optional.class) return Optional.empty();
        if (t == Stream.class) return Stream.empty();
        if (t == byte[].class) return new byte[]{1, 2, 3};
        if (t.isArray()) return Array.newInstance(t.getComponentType(), 0);
        if (t == Map.class || t == LinkedHashMap.class || t == HashMap.class) return new LinkedHashMap<>();
        if (t == List.class || t == Collection.class || t == Iterable.class || t == ArrayList.class) return new ArrayList<>();
        if (t == Set.class || t == LinkedHashSet.class) return new LinkedHashSet<>();
        if (t == ResponseEntity.class) return ResponseEntity.ok().build();
        if (t.isEnum()) return t.getEnumConstants()[0];
        if (depth > 3) return null;
        if (t.isRecord()) return record(t, depth);
        if (t.isInterface()) return proxy(t);
        try {
            Constructor<?> k = t.getDeclaredConstructor();
            k.setAccessible(true);
            return k.newInstance();
        } catch (ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }

    static Object record(Class<?> t, int depth) {
        RecordComponent[] cs = t.getRecordComponents();
        Class<?>[] types = Arrays.stream(cs).map(RecordComponent::getType).toArray(Class<?>[]::new);
        Object[] values = new Object[cs.length];
        for (int i = 0; i < cs.length; i++) {
            boolean mime = cs[i].getName().equals("mime") || cs[i].getName().equals("contentType");
            values[i] = mime && types[i] == String.class ? "image/png" : value(types[i], depth + 1);
        }
        try {
            Constructor<?> k = t.getDeclaredConstructor(types);
            k.setAccessible(true);
            return k.newInstance(values);
        } catch (ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }
}
