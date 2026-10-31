package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.web.support.ClientIpResolver;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cada endpoint (método com @GetMapping/@PostMapping/...) dos controllers é chamado com os serviços trocados por
 * dublês que gravam as chamadas: o teste confere que o controller delega a um serviço, repassa o usuário
 * autenticado sem trocá-lo e devolve exatamente o que o serviço respondeu (direto ou no corpo do ResponseEntity).
 */
class ControllerDelegacaoTest {
    static final List<Class<?>> CONTROLLERS = List.of(
            AdminController.class, br.com.fashionai.web.atelierproject.AtelierProjectController.class,
            PhysicalStoreController.class, br.com.fashionai.web.passport.GarmentPassportController.class,
            SealHypeOffersController.class, EraStudioController.class, ProfileController.class, SealController.class,
            AdminRoomAssetController.class, MultiplatformController.class, MeController.class, ShowcaseController.class,
            PhotoController.class, NotificationController.class, PreferencesController.class,
            FlairChallengeController.class, DnaController.class, WardrobeController.class, RoomController.class,
            AuraPieceMediaController.class, CommentController.class, DashboardController.class,
            AutopilotController.class, FlairController.class, RoomCreatorController.class,
            FlairCollectionController.class, Avatar3dController.class, TryOnController.class, GuideController.class,
            MomentController.class, BackgroundController.class, TryOnPersonPhotoController.class,
            AdminPhysicalStoreController.class, AnatomicalTryOnController.class, HypeController.class,
            HighlightsController.class, AuthController.class, LensController.class, CatalogController.class,
            IssuerReviewController.class, AccountController.class, CouponController.class, DiscoveryController.class,
            ChallengeController.class, MomentAdminController.class, AuraMotionController.class,
            FlairModesController.class, PhotoEditController.class, MirrorController.class, TipoLookController.class,
            AdminCatalogImageController.class, InsightsController.class, FlairAdventureController.class,
            LookbookController.class, AuraCommerceController.class, SchemeController.class,
            AdminCatalogController.class, AuraPermissionsController.class, AuraHypeDropController.class,
            BrandLogoController.class, ExchangeRateController.class, CommunityTrendController.class,
            PieceReferenceController.class, SocialController.class, MetamorphoseInventoryController.class,
            AtelierController.class, br.com.fashionai.web.controller.fit.FitController.class,
            FlairCardModesController.class, DailyLookController.class, SealPromotionController.class,
            MultiPieceController.class, WardrobeStudioController.class);

    static final CurrentUser ADMIN = new CurrentUser(UUID.fromString("00000000-0000-0000-0000-00000000000a"), "admin",
            "ADMIN", ProfileType.ADMIN, true, AccountStatus.ACTIVE, "127.0.0.1", "junit");

    static final UUID SESSION = UUID.fromString("00000000-0000-0000-0000-0000000000cc");

    static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    /** Valores de texto por nome de parâmetro, quando o controller valida o texto antes de delegar. */
    static final Map<String, String> TEXTO = Map.of(
            "type", "PIECE", "kind", "eras", "command", "{}", "HypeController.groups.type", "BRAND");

    /** Endpoints que montam a resposta (não devolvem o objeto do serviço): cobertos em testes próprios. */
    static final Set<String> MONTA_RESPOSTA = Set.of("AuthController.requestReset", "SchemeController.compose");

    /** Endpoints que não dependem de serviço algum: cobertos em testes próprios. */
    static final Set<String> SEM_SERVICO = Set.of("AccountController.privacyProbe", "LookbookController.panelVersions");

    /**
     * Endpoints que passaram a ter regra própria antes de delegar (permissão de criador, nível Loft do FLAIR, item que
     * precisa existir): este teste genérico só sabe exercitar repasse puro, então ficam de fora dele.
     */
    static final Set<String> COM_REGRA = Set.of("CatalogController.textureImage", "FlairAdventureController.preview",
            "HighlightsController.unapply");

    static boolean generico(Class<?> type, java.lang.reflect.Method m) {
        String id = type.getSimpleName() + "." + m.getName();
        return !SEM_SERVICO.contains(id) && !COM_REGRA.contains(id);
    }

    @TestFactory
    Stream<DynamicTest> cadaEndpointDelegaAoServicoEDevolveARespostaDele() {
        return CONTROLLERS.stream().flatMap(type -> endpoints(type)
                .filter(m -> generico(type, m)).map(m ->
                DynamicTest.dynamicTest(type.getSimpleName() + "." + m.getName(), () -> exercita(type, m))));
    }

    @TestFactory
    Stream<DynamicTest> parametrosOpcionaisAusentesTambemDelegamAoServico() {
        return CONTROLLERS.stream().flatMap(type -> endpoints(type)
                .filter(m -> generico(type, m))
                .filter(m -> Arrays.stream(m.getParameters()).anyMatch(ControllerDelegacaoTest::opcional)).map(m ->
                DynamicTest.dynamicTest(type.getSimpleName() + "." + m.getName() + " sem opcionais",
                        () -> exercita(type, m, true))));
    }

    static boolean opcional(Parameter p) {
        if (p.getType().isPrimitive()) return false;
        RequestParam rp = p.getAnnotation(RequestParam.class);
        if (rp != null) return !rp.required() && ValueConstants.DEFAULT_NONE.equals(rp.defaultValue());
        RequestBody rb = p.getAnnotation(RequestBody.class);
        if (rb != null) return !rb.required();
        RequestPart part = p.getAnnotation(RequestPart.class);
        return part != null && !part.required();
    }

    static Stream<Method> endpoints(Class<?> type) {
        return Arrays.stream(type.getDeclaredMethods())
                .filter(m -> Modifier.isPublic(m.getModifiers()) && !m.isSynthetic())
                .filter(m -> m.isAnnotationPresent(GetMapping.class) || m.isAnnotationPresent(PostMapping.class)
                        || m.isAnnotationPresent(PutMapping.class) || m.isAnnotationPresent(DeleteMapping.class)
                        || m.isAnnotationPresent(PatchMapping.class) || m.isAnnotationPresent(RequestMapping.class))
                .sorted(Comparator.comparing(Method::toGenericString));
    }

    static Object controller(Class<?> type) throws ReflectiveOperationException {
        Constructor<?> k = Arrays.stream(type.getConstructors())
                .max(Comparator.comparingInt(Constructor::getParameterCount)).orElseThrow();
        Object[] args = Arrays.stream(k.getParameterTypes()).map(ControllerDelegacaoTest::collaborator).toArray();
        return k.newInstance(args);
    }

    static Object collaborator(Class<?> type) {
        if (type == Guard.class) return new Guard(event -> { }, null);
        if (type == ClientIpResolver.class) return new ClientIpResolver("", "X-Edge-Secret");
        if (type == boolean.class) return false;
        if (type.isInterface()) return Fk.proxy(type);
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
        throw new IllegalStateException("sem dublê para " + type.getName());
    }

    static Object[] arguments(Method m, boolean semOpcionais) {
        Parameter[] ps = m.getParameters();
        Object[] args = new Object[ps.length];
        for (int i = 0; i < ps.length; i++) args[i] = semOpcionais && opcional(ps[i]) ? null : argument(m, ps[i]);
        return args;
    }

    static Object argument(Method m, Parameter p) {
        Class<?> t = p.getType();
        RequestParam rp = p.getAnnotation(RequestParam.class);
        if (t == CurrentUser.class) return ADMIN;
        if (t == String.class) {
            if (rp != null && !ValueConstants.DEFAULT_NONE.equals(rp.defaultValue())) return rp.defaultValue();
            String key = m.getDeclaringClass().getSimpleName() + "." + m.getName() + "." + p.getName();
            return TEXTO.getOrDefault(key, TEXTO.getOrDefault(p.getName(), "valor"));
        }
        if (t == MultipartFile.class) return new MockMultipartFile("file", "a.png", "image/png", PNG);
        if (t == HttpServletRequest.class) return new MockHttpServletRequest();
        if (t == HttpServletResponse.class) return new MockHttpServletResponse();
        if (t == Jwt.class) return Jwt.withTokenValue("t").header("alg", "none").subject(ADMIN.id().toString()).claim("sid", SESSION.toString())
                .issuedAt(Instant.parse("2026-01-01T00:00:00Z")).expiresAt(Instant.parse("2026-01-02T00:00:00Z")).build();
        if (t == List.class && p.getParameterizedType().getTypeName().contains("MultipartFile")) {
            return new ArrayList<>(List.of(new MockMultipartFile("files", "a.png", "image/png", PNG)));
        }
        if (t == List.class) return new ArrayList<>();
        if (t == Map.class) return new LinkedHashMap<>();
        if (t == Integer.class || t == int.class) {
            if (rp != null && !ValueConstants.DEFAULT_NONE.equals(rp.defaultValue())) return Integer.valueOf(rp.defaultValue());
            return 1;
        }
        if (t == LocalDate.class) return LocalDate.of(2026, 1, 1);
        return Fk.value(t, 0);
    }

    static Stream<Object> componentes(Object value) {
        if (!(value instanceof Record)) return Stream.empty();
        return Arrays.stream(value.getClass().getRecordComponents()).map(c -> {
            try {
                c.getAccessor().setAccessible(true);
                return c.getAccessor().invoke(value);
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
        });
    }

    static void exercita(Class<?> type, Method m) throws Throwable {
        exercita(type, m, false);
    }

    static void exercita(Class<?> type, Method m, boolean semOpcionais) throws Throwable {
        Object controller = controller(type);
        Fk.reset();
        Object result;
        try {
            result = m.invoke(controller, arguments(m, semOpcionais));
        } catch (InvocationTargetException e) {
            throw new AssertionError(type.getSimpleName() + "." + m.getName() + " lançou " + e.getCause(), e.getCause());
        }
        assertThat(Fk.calls).as(type.getSimpleName() + "." + m.getName() + " deve delegar a um serviço").isNotEmpty();
        Fk.calls.stream().flatMap(c -> Arrays.stream(c.args())).filter(a -> a instanceof CurrentUser)
                .forEach(a -> assertThat(a).as("usuário repassado ao serviço").isSameAs(ADMIN));
        if (result != null && m.getReturnType() != void.class
                && !MONTA_RESPOSTA.contains(type.getSimpleName() + "." + m.getName())) {
            Object body = result instanceof ResponseEntity<?> r ? r.getBody() : result;
            boolean repassa = Fk.calls.stream().map(Fk.Call::returned).filter(Objects::nonNull).anyMatch(r -> r == body
                    || (body instanceof Map<?, ?> map && map.values().stream().anyMatch(v -> v == r || r.equals(v)))
                    || r.equals(body) || componentes(r).anyMatch(v -> v == body));
            assertThat(repassa).as(type.getSimpleName() + "." + m.getName() + " devolve a resposta do serviço: " + result).isTrue();
        }
    }
}
