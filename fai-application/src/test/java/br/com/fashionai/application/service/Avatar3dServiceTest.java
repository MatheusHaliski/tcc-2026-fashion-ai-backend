package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAvatar3d;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.lang.reflect.Proxy;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF40 — consentimento, validação do modelo, textura privada, acesso de terceiros e exclusão. */
class Avatar3dServiceTest {
    private final Map<UUID, UserAvatar3d> rows = new HashMap<>();
    private final Map<String, byte[]> blobs = new LinkedHashMap<>();
    private final List<String> audited = new ArrayList<>();
    private Avatar3dService service;
    private final List<AiEngine.TextCall<?>> moderations = new ArrayList<>();
    /** Resposta do moderador remoto; null = sem provedor (fallback local sem veredito). */
    private String moderatorAnswer = "{\"approved\": true}";
    private User owner;
    private CurrentUser me;
    private CurrentUser other;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.assignId(UUID.randomUUID());
        me = new CurrentUser(owner.getId(), "dono", "USER", null, true, null, "127.0.0.1", "test");
        other = new CurrentUser(UUID.randomUUID(), "outra", "USER", null, true, null, "127.0.0.1", "test");
        UserAvatar3dRepository avatars = proxy(UserAvatar3dRepository.class, (name, args) -> switch (name) {
            case "findByUserId" -> Optional.ofNullable(rows.get((UUID) args[0]));
            case "save" -> {
                UserAvatar3d a = (UserAvatar3d) args[0];
                rows.put(a.getUser().getId(), a);
                yield a;
            }
            case "delete" -> {
                rows.values().remove(args[0]);
                yield null;
            }
            default -> throw new UnsupportedOperationException(name);
        });
        UserRepository users = proxy(UserRepository.class, (name, args) -> {
            if ("findById".equals(name)) {
                return owner.getId().equals(args[0]) ? Optional.of(owner) : Optional.empty();
            }
            throw new UnsupportedOperationException(name);
        });
        MediaStoragePort storage = new MediaStoragePort() {
            public URI createUploadUrl(String k, String c) { return URI.create("http://x/" + k); }
            public URI publicUrl(String k) { return URI.create("http://x/media/" + k); }
            public StoredObject put(String k, byte[] b, String c) { blobs.put(k, b); return new StoredObject(k, "http://x/media/" + k, b.length, c); }
            public byte[] get(String k) { byte[] b = blobs.get(k); if (b == null) throw ApiException.notFound("x"); return b; }
            public void delete(String k) { blobs.remove(k); }
            public Optional<String> keyOf(String url) { return Optional.empty(); }
        };
        AiEngine ai = mock(AiEngine.class);
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<?> call = inv.getArgument(0);
            moderations.add(call);
            Object value = moderatorAnswer == null ? call.local().get() : call.parser().apply(moderatorAnswer);
            return new AiOutcome<>(value, UUID.randomUUID(), AiCallResult.SUCCESS, moderatorAnswer == null, "gemini", "m", 1,
                    BigDecimal.ZERO, null, null, null);
        });
        service = new Avatar3dService(avatars, users, storage, new Audit(e -> audited.add(e.acao())), ai);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.util.function.BiFunction<String, Object[], Object> body) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (p, m, a) -> m.getDeclaringClass() == Object.class ? m.invoke(new Object(), a) : body.apply(m.getName(), a));
    }

    static Map<String, Object> model() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("v", 1);
        m.put("shape", new ArrayList<>(Collections.nCopies(Avatar3dService.SHAPE_LEN, 1.25)));
        m.put("skin", "#c8966e");
        m.put("hair", new LinkedHashMap<>(Map.of("present", true, "color", "#3a2a1e", "top", 12.4, "side", 8.1, "fringe", 0.2, "cut", false)));
        m.put("metrics", Map.of("faceW", 14.1));
        return m;
    }

    static byte[] texture(int w, int h) {
        return ImageOps.png(new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB));
    }

    private Avatar3dService.SaveCommand cmd(boolean consent, Boolean publicOnRunway) {
        return new Avatar3dService.SaveCommand(model(), Map.of("headScale", 3.0), 3, List.of("DEPTH_ESTIMATED", "x<script>"), consent, publicOnRunway);
    }

    private static String code(Runnable r) {
        return assertThrows(ApiException.class, r::run).code();
    }

    @Test
    void semConsentimentoNadaEGravado() {
        assertEquals("CONSENTIMENTO_OBRIGATORIO", code(() -> service.save(me, cmd(false, null), texture(512, 512))));
        assertTrue(rows.isEmpty());
        assertTrue(blobs.isEmpty());
    }

    @Test
    void salvaComTexturaPrivadaERefazerApagaATexturaAntiga() {
        Map<String, Object> v = service.save(me, cmd(true, null), texture(512, 512));
        assertEquals(true, v.get("exists"));
        String first = blobs.keySet().iterator().next();
        assertTrue(first.startsWith("restricted/users/" + owner.getId() + "/avatar3d/"), first);
        assertEquals(1.06, ((Map<?, ?>) v.get("adjust")).get("headScale"));          // ajuste fora da faixa é limitado
        assertEquals(List.of("DEPTH_ESTIMATED"), v.get("warnings"));        // só códigos A-Z0-9_; o resto é descartado
        try {
            Thread.sleep(2);
        } catch (InterruptedException ignored) {
        }
        service.save(me, cmd(true, null), texture(512, 512));
        assertEquals(1, blobs.size());
        assertFalse(blobs.containsKey(first));
        assertTrue(audited.contains("AVATAR3D_SALVO"));
    }

    @Test
    void modeloMalFormadoERecusado() {
        Map<String, Object> bad = model();
        ((List<Object>) bad.get("shape")).set(10, Double.NaN);
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(bad)));
        Map<String, Object> shortShape = model();
        shortShape.put("shape", List.of(1, 2, 3));
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(shortShape)));
        Map<String, Object> badSkin = model();
        badSkin.put("skin", "red");
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(badSkin)));
        Map<String, Object> badVersion = model();
        badVersion.put("v", 9);
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(badVersion)));
        Map<String, Object> extra = model();
        extra.put("photoUrl", "http://evil");
        assertFalse(Avatar3dService.validateModel(extra).containsKey("photoUrl"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void cabeloComprimentoTexturaCoberturaESilhueta() {
        Map<String, Object> m = model();
        Map<String, Object> hair = new java.util.LinkedHashMap<>((Map<String, Object>) m.get("hair"));
        hair.put("length", "medium"); hair.put("texture", "curly"); hair.put("cover", "#4a482b");
        hair.put("outline", List.of(7.5, 9.1, 10.2, 0, 0)); hair.put("extra", "x");
        m.put("hair", hair);
        Map<String, Object> ok = (Map<String, Object>) Avatar3dService.validateModel(m).get("hair");
        assertEquals("medium", ok.get("length")); assertEquals("curly", ok.get("texture")); assertEquals("#4a482b", ok.get("cover"));
        assertEquals(5, ((List<Object>) ok.get("outline")).size()); assertFalse(ok.containsKey("extra"));
        // valores fora da lista são descartados sem derrubar o avatar
        hair.put("length", "gigante"); hair.put("texture", 3); hair.put("cover", "verde"); hair.put("outline", List.of(-1, Double.NaN));
        Map<String, Object> cleaned = (Map<String, Object>) Avatar3dService.validateModel(m).get("hair");
        assertFalse(cleaned.containsKey("length")); assertFalse(cleaned.containsKey("texture"));
        assertFalse(cleaned.containsKey("cover")); assertFalse(cleaned.containsKey("outline"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void tomDoCabeloMedidoEEscolhido() {
        Map<String, Object> m = model();
        Map<String, Object> hair = new java.util.LinkedHashMap<>((Map<String, Object>) m.get("hair"));
        hair.put("tone", Map.of("level", 7, "family", "golden"));
        m.put("hair", hair);
        Map<String, Object> ok = (Map<String, Object>) Avatar3dService.validateModel(m).get("hair");
        assertEquals(Map.of("level", 7, "family", "golden"), ok.get("tone"));
        // nível fora de 1–10, família desconhecida ou campo a mais: o tom é descartado, o avatar continua válido
        for (Object bad : List.of(Map.of("level", 11, "family", "natural"), Map.of("level", 3, "family", "verde"),
                Map.of("level", 3.5, "family", "ash"), Map.of("level", 3, "family", "ash", "x", 1), "castanho")) {
            hair.put("tone", bad);
            assertFalse(((Map<String, Object>) Avatar3dService.validateModel(m).get("hair")).containsKey("tone"), String.valueOf(bad));
        }
        // ajuste: 0 = o medido, 1–14 = da paleta; inteiro e limitado
        Map<String, Object> adj = Avatar3dService.clampAdjust(Map.of("hairTone", 8.4));
        assertEquals(8, adj.get("hairTone"));
        assertEquals(14, Avatar3dService.clampAdjust(Map.of("hairTone", 99)).get("hairTone"));
        assertEquals(0, Avatar3dService.clampAdjust(Map.of()).get("hairTone"));
    }

    @Test
    void texturaPrecisaSerQuadradaEDeTamanhoRazoavel() {
        assertEquals("TEXTURA_INVALIDA", code(() -> Avatar3dService.normalizeTexture(texture(512, 300))));
        assertEquals("TEXTURA_INVALIDA", code(() -> Avatar3dService.normalizeTexture(texture(128, 128))));
        assertEquals("TEXTURA_INVALIDA", code(() -> Avatar3dService.normalizeTexture(null)));
        byte[] jpeg = Avatar3dService.normalizeTexture(texture(1024, 1024));
        assertEquals("image/jpeg", ImageOps.detectMime(jpeg));
    }

    @Test
    void outraPessoaSoVeOAvatarPublico() {
        service.save(me, cmd(true, false), texture(512, 512));
        assertTrue(service.texture(me, owner.getId()).length > 0);
        assertThrows(ApiException.class, () -> service.texture(other, owner.getId()));
        assertTrue(service.forMannequin(owner.getId(), other.id()).isEmpty());
        assertTrue(service.forMannequin(owner.getId(), null).isEmpty());
        assertTrue(service.forMannequin(owner.getId(), me.id()).isPresent());

        service.update(me, new Avatar3dService.SettingsCommand(null, true, null));
        assertTrue(service.texture(other, owner.getId()).length > 0);
        Map<String, Object> ref = service.forMannequin(owner.getId(), other.id()).orElseThrow();
        assertTrue(((String) ref.get("textureUrl")).startsWith("/api/avatar3d/" + owner.getId() + "/texture"));
        assertEquals("#c8966e", ((Map<?, ?>) ref.get("model")).get("skin"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void corpoBaseEstimadoPeloRostoFicaNoModeloETrocaDepois() {
        Map<String, Object> m = new LinkedHashMap<>((Map<String, Object>) cmd(true, false).model());
        m.put("sex", "FEMININO");
        assertEquals("FEMININO", Avatar3dService.validateModel(m).get("sex"));
        m.put("sex", "OUTRO");
        assertFalse(Avatar3dService.validateModel(m).containsKey("sex"));   // valor desconhecido é descartado
        service.save(me, cmd(true, false), texture(512, 512));
        Map<?, ?> model = (Map<?, ?>) service.update(me, new Avatar3dService.SettingsCommand(null, null, null, "MASCULINO")).get("model");
        assertEquals("MASCULINO", model.get("sex"));
        model = (Map<?, ?>) service.update(me, new Avatar3dService.SettingsCommand(null, null, null, "qualquer")).get("model");
        assertEquals("MASCULINO", model.get("sex"));                        // inválido não muda nada
    }

    @Test
    void texturaSoApareceParaOutrosDepoisDeAprovadaNaModeracao() {
        // avatar privado: o rosto não vai para provedor externo nenhum
        service.save(me, cmd(true, false), texture(512, 512));
        assertTrue(moderations.isEmpty());
        assertEquals("PENDING", service.get(me).get("textureModeration"));

        // sem veredito remoto (sem provedor/consentimento/cota): continua pendente e a foto não aparece para os outros
        moderatorAnswer = null;
        service.update(me, new Avatar3dService.SettingsCommand(null, true, null));
        assertEquals(1, moderations.size());
        assertEquals(AiCapability.CONTENT_MODERATOR, moderations.get(0).capability());
        assertEquals("PENDING", service.get(me).get("textureModeration"));
        assertThrows(ApiException.class, () -> service.texture(other, owner.getId()));
        Map<String, Object> ref = service.forMannequin(owner.getId(), other.id()).orElseThrow();
        assertEquals(null, ref.get("textureUrl"));                          // forma pública, rosto padrão
        assertTrue(service.texture(me, owner.getId()).length > 0);          // o dono sempre vê

        // reprovada: nunca sai para os outros
        moderatorAnswer = "{\"approved\": false, \"reason\": \"x\"}";
        service.save(me, cmd(true, true), texture(512, 512));
        assertEquals("REJECTED_POLICY", service.get(me).get("textureModeration"));
        assertThrows(ApiException.class, () -> service.texture(other, owner.getId()));

        // aprovada: aparece
        moderatorAnswer = "{\"approved\": true}";
        service.save(me, cmd(true, true), texture(512, 512));
        assertEquals("APPROVED", service.get(me).get("textureModeration"));
        assertTrue(service.texture(other, owner.getId()).length > 0);
    }

    @Test
    void excluirApagaRegistroETextura() {
        service.save(me, cmd(true, true), texture(512, 512));
        service.delete(me);
        assertTrue(rows.isEmpty());
        assertTrue(blobs.isEmpty());
        assertEquals(false, service.get(me).get("exists"));
        assertTrue(service.forMannequin(owner.getId(), me.id()).isEmpty());
        assertTrue(audited.contains("AVATAR3D_EXCLUIDO"));

        service.save(me, cmd(true, true), texture(512, 512));
        service.deleteAllFor(owner.getId());                           // exclusão da conta
        assertTrue(rows.isEmpty());
        assertTrue(blobs.isEmpty());
    }

    private static Map<String, Object> body(double waist, String waistSource) {
        Map<String, Object> params = new LinkedHashMap<>(Map.of("stature", 1.7, "shoulderW", 0.19, "chestW", 0.175, "waistW", waist,
                "hipW", 0.205, "legLen", 0.53, "armLen", 0.333, "headH", 0.13, "build", 0.0));
        Map<String, Object> sources = new LinkedHashMap<>();
        params.keySet().forEach(k -> sources.put(k, "default"));
        sources.put("waistW", waistSource);
        sources.put("stature", "user");
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("v", 1);
        b.put("sex", "FEMININO");
        b.put("params", params);
        b.put("sources", sources);
        b.put("heightCm", 170);
        b.put("weightKg", null);
        b.put("photo", true);
        b.put("warnings", List.of("CLOTHING", "<b>"));
        b.put("comentario", "texto livre não passa");
        return b;
    }

    /** Corpo do avatar: proporções dentro das faixas, origem conhecida; nada de texto livre; vai junto do modelo. */
    @Test
    void corpoValidadoEGuardadoComOModelo() {
        service.save(me, cmd(true, null), texture(512, 512));
        Map<String, Object> v = service.update(me, new Avatar3dService.SettingsCommand(null, null, body(0.15, "observed")));
        Map<?, ?> saved = (Map<?, ?>) ((Map<?, ?>) v.get("model")).get("body");
        assertEquals("observed", ((Map<?, ?>) saved.get("sources")).get("waistW"));
        assertEquals(List.of("CLOTHING", "b"), saved.get("warnings"));
        assertFalse(saved.containsKey("comentario"));
        assertTrue(audited.contains("AVATAR3D_CORPO"));
        // fora da faixa, origem desconhecida ou altura impossível: recusado
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(body(0.5, "observed"))));
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(body(0.15, "medido pela IA"))));
        Map<String, Object> tall = body(0.15, "user");
        tall.put("heightCm", 400);
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(tall)));
        // corpo vazio remove o corpo e o manequim volta às proporções de referência
        Map<String, Object> cleared = service.update(me, new Avatar3dService.SettingsCommand(null, null, Map.of()));
        assertFalse(((Map<?, ?>) cleared.get("model")).containsKey("body"));
    }

    /**
     * Profundidade do tronco (foto de perfil): opcional — um corpo salvo antes dela continua válido —, mas quando
     * vem precisa do valor na faixa e da origem, como qualquer outra medida.
     */
    @Test
    @SuppressWarnings("unchecked")
    void profundidadeDoPerfilEOpcionalMasValidadaQuandoVem() {
        service.save(me, cmd(true, null), texture(512, 512));
        // sem profundidade: o corpo continua válido e nada de profundidade é gravado
        Map<?, ?> semPerfil = (Map<?, ?>) ((Map<?, ?>) service.update(me, new Avatar3dService.SettingsCommand(null, null, body(0.15, "observed"))).get("model")).get("body");
        assertFalse(((Map<?, ?>) semPerfil.get("params")).containsKey("hipD"));

        Map<String, Object> comPerfil = body(0.15, "observed");
        ((Map<String, Object>) comPerfil.get("params")).put("hipD", 0.15);
        ((Map<String, Object>) comPerfil.get("sources")).put("hipD", "observed");
        Map<?, ?> saved = (Map<?, ?>) ((Map<?, ?>) service.update(me, new Avatar3dService.SettingsCommand(null, null, comPerfil)).get("model")).get("body");
        assertEquals(0.15, ((Map<?, ?>) saved.get("params")).get("hipD"));
        assertEquals("observed", ((Map<?, ?>) saved.get("sources")).get("hipD"));

        // fora da faixa, ou sem dizer de onde veio: recusado
        Map<String, Object> fundoDemais = body(0.15, "observed");
        ((Map<String, Object>) fundoDemais.get("params")).put("hipD", 0.9);
        ((Map<String, Object>) fundoDemais.get("sources")).put("hipD", "observed");
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(fundoDemais)));
        Map<String, Object> semOrigem = body(0.15, "observed");
        ((Map<String, Object>) semOrigem.get("params")).put("waistD", 0.12);
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(semOrigem)));
    }
}
