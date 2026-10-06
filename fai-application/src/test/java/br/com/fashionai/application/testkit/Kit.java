package br.com.fashionai.application.testkit;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import org.mockito.Mockito;
import org.mockito.internal.stubbing.defaultanswers.ReturnsEmptyValues;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.SliceImpl;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Monta um service para teste de unidade com tudo de que ele depende: repositórios JPA viram {@link MemoryRepository}
 * (salvam e consultam de verdade, em memória), os outros colaboradores viram mocks do Mockito que devolvem vazio, e o
 * teste pode trocar qualquer um por um objeto real. Cada dependência fica guardada pelo tipo, para o teste programar
 * ({@code when(kit.mock(X.class)…)}) ou semear ({@code kit.save(entidade)}).
 */
public final class Kit {
    private static final ReturnsEmptyValues EMPTY = new ReturnsEmptyValues();
    private final Map<Class<?>, Object> deps = new LinkedHashMap<>();

    /** Dependências reais que entram no lugar dos mocks (casadas pelo tipo do parâmetro do construtor). */
    public Kit with(Object... real) {
        for (Object r : real) {
            deps.put(r.getClass(), r);
        }
        return this;
    }

    /** Constrói o service pelo construtor com mais parâmetros, preenchendo cada um. */
    public <T> T build(Class<T> type) {
        Constructor<?> ctor = Arrays.stream(type.getDeclaredConstructors())
                .max(Comparator.comparingInt(Constructor::getParameterCount))
                .orElseThrow();
        ctor.setAccessible(true);
        Object[] args = Arrays.stream(ctor.getParameterTypes()).map(this::dep).toArray();
        try {
            return type.cast(ctor.newInstance(args));
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("não deu para montar " + type.getSimpleName(), e);
        }
    }

    /** Constrói um colaborador de verdade (com as mesmas dependências deste kit) e o registra no lugar do mock. */
    public <T> T real(Class<T> type) {
        T t = build(type);
        deps.put(type, t);
        return t;
    }

    /** A dependência do tipo dado (criada na primeira vez): repositório em memória, real ou mock. */
    @SuppressWarnings("unchecked")
    public <D> D dep(Class<D> type) {
        for (Map.Entry<Class<?>, Object> e : deps.entrySet()) {
            if (type.isAssignableFrom(e.getKey())) {
                return (D) e.getValue();
            }
        }
        Object made;
        if (type.isPrimitive()) {
            made = type == boolean.class ? false : type == double.class ? 0d : type == float.class ? 0f : type == long.class ? 0L : 0;
        } else if (type == String.class) {
            made = "";
        } else if (type == br.com.fashionai.application.events.SideEffectRunner.class) {
            // efeitos colaterais rodam na hora (a transação própria vira um mock que não faz nada)
            made = new br.com.fashionai.application.events.SideEffectRunner(mock(org.springframework.transaction.PlatformTransactionManager.class));
        } else if (type == br.com.fashionai.application.ai.AiEngine.class) {
            // motor de IA de verdade sem provedores remotos: toda chamada cai no motor local (determinístico) e fica no log
            made = new br.com.fashionai.application.ai.AiEngine(java.util.List.of(), mock(br.com.fashionai.application.ports.RateLimitPort.class),
                    dep(br.com.fashionai.domain.repository.UserConsentRepository.class), dep(br.com.fashionai.domain.repository.AiInferenceLogRepository.class),
                    mock(br.com.fashionai.application.audit.AuditService.class), mock(br.com.fashionai.application.ai.AiBudget.class), false, false);
        } else if (type.isInterface() && JpaRepository.class.isAssignableFrom(type)) {
            made = MemoryRepository.of(type);
        } else {
            made = mock(type);
        }
        deps.put(type, made);
        return (D) made;
    }

    /** Mock que devolve vazio (listas, Optional, páginas, zero) em vez de null, para o service seguir o caminho comum. */
    public static <D> D mock(Class<D> type) {
        return Mockito.mock(type, Mockito.withSettings().defaultAnswer(inv -> {
            Class<?> ret = inv.getMethod().getReturnType();
            if (Page.class.isAssignableFrom(ret)) {
                return Page.empty();
            }
            if (Slice.class.isAssignableFrom(ret)) {
                return new SliceImpl<>(java.util.List.of());
            }
            if (ret == BigDecimal.class) {
                return BigDecimal.ZERO;
            }
            return EMPTY.answer(inv);
        }));
    }

    /** Salva a entidade no repositório em memória do tipo dado. */
    @SuppressWarnings("unchecked")
    public <E> E save(Class<? extends JpaRepository<?, ?>> repository, E entity) {
        return (E) ((JpaRepository<Object, ?>) dep(repository)).save(entity);
    }

    // ---------- entidades de exemplo ----------

    public static User user(String username) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.markCreatedAt(Instant.now().minusSeconds(86_400L * 30));
        u.setUsername(username);
        u.setDisplayName(username.substring(0, 1).toUpperCase() + username.substring(1));
        u.setEmail(username + "@example.com");
        u.setEmailVerified(true);
        u.setProfileType(ProfileType.PESSOAL);
        u.setStatus(AccountStatus.ACTIVE);
        u.setPrivateAccount(false);
        u.setCountry("BR");
        return u;
    }

    public static CurrentUser as(User u) {
        return CurrentUser.of(u, "127.0.0.1", "JUnit");
    }

    public static CurrentUser admin(User u) {
        u.setRole("ADMIN");
        return CurrentUser.of(u, "127.0.0.1", "JUnit");
    }

    public static WardrobeItem piece(User owner, String name, String category, String subcategory, String color) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.markCreatedAt(Instant.now().minusSeconds(86_400L * 10));
        w.setUser(owner);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setColor(color);
        w.setMaterial("COTTON");
        w.setStyleTags("basic,streetwear");
        w.setOccasionTags("casual");
        w.setImageUrl("/media/" + name.replace(' ', '-') + ".png");
        w.setThumbnailUrl("/media/" + name.replace(' ', '-') + "-thumb.png");
        w.setVisibility(Visibility.PUBLIC);
        w.setPrice(new BigDecimal("120.00"));
        return w;
    }

    public static Scheme look(User owner, String title, WardrobeItem... pieces) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.markCreatedAt(Instant.now().minusSeconds(86_400L * 5));
        s.setUser(owner);
        s.setTitle(title);
        s.setStyle("streetwear");
        s.setOccasion("casual");
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setVisibility(Visibility.PUBLIC);
        s.setCoverImageUrl("/media/" + title.replace(' ', '-') + ".png");
        return s;
    }

    public static SchemeItem slot(Scheme look, WardrobeItem piece, SchemeSlot slot, int order) {
        SchemeItem i = new SchemeItem();
        i.assignId(UUID.randomUUID());
        i.setScheme(look);
        i.setWardrobeItem(piece);
        i.setSlot(slot);
        i.setSortOrder(order);
        return i;
    }
}
