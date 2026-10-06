package br.com.fashionai.application.testkit;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Leitura de propriedades por caminho do nome das consultas derivadas: {@code UserId} → {@code getUserId()} ou {@code getUser().getId()}. */
final class Beans {
    private static final Map<String, Method> GETTERS = new ConcurrentHashMap<>();
    private static final Method NONE;

    static {
        try {
            NONE = Object.class.getMethod("hashCode");
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(e);
        }
    }

    private Beans() {
    }

    static Object path(Object bean, String prop) {
        if (bean == null || prop.isEmpty()) {
            return bean;
        }
        Method whole = getter(bean.getClass(), prop);
        if (whole != null) {
            return invoke(whole, bean);
        }
        // prefixo mais longo que é propriedade, e o resto dentro dela (UserId → user.id; SchemeUserId → scheme.user.id)
        for (int i = prop.length() - 1; i > 0; i--) {
            if (Character.isUpperCase(prop.charAt(i))) {
                Method head = getter(bean.getClass(), prop.substring(0, i));
                if (head != null) {
                    return path(invoke(head, bean), prop.substring(i));
                }
            }
        }
        throw new IllegalArgumentException("propriedade desconhecida: " + bean.getClass().getSimpleName() + "." + prop);
    }

    private static Method getter(Class<?> type, String prop) {
        Method m = GETTERS.computeIfAbsent(type.getName() + "#" + prop, k -> {
            for (String n : new String[]{"get" + prop, "is" + prop, Character.toLowerCase(prop.charAt(0)) + prop.substring(1)}) {
                try {
                    Method found = type.getMethod(n);
                    if (found.getParameterCount() == 0 && found.getReturnType() != void.class) {
                        return found;
                    }
                } catch (NoSuchMethodException ignored) {
                    // tenta o próximo nome
                }
            }
            return NONE;
        });
        return m == NONE ? null : m;
    }

    private static Object invoke(Method m, Object bean) {
        try {
            return m.invoke(bean);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
