package br.com.fashionai.web.support;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafety;
import br.com.fashionai.application.moderation.UploadQuarantine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Moderação central dos uploads: o veredito decide se a foto segue, fica retida ou é recusada, em qualquer rota. */
class UploadSafetyInterceptorTest {
    private static final UUID USER = UUID.randomUUID();
    private final List<String> held = new ArrayList<>();

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static ImageSafety fixed(ImageSafety.Decision d) {
        return new ImageSafety(List.of(), List.of(), false) {
            @Override
            public Verdict check(byte[] bytes) {
                return new Verdict(d, "teste", List.of("motivo"), Map.of("bodySkin", 0.6));
            }
        };
    }

    private UploadSafetyInterceptor interceptor(ImageSafety safety) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("safety", safety);
        beans.addBean("quarantine", new UploadQuarantine(null, null, null, null, null) {
            @Override
            public UUID hold(UUID userId, byte[] bytes, String path, ImageSafety.Verdict verdict) {
                held.add(userId + " " + path);
                return UUID.randomUUID();
            }
        });
        return new UploadSafetyInterceptor(beans.getBeanProvider(ImageSafety.class), beans.getBeanProvider(UploadQuarantine.class),
                beans.getBeanProvider(br.com.fashionai.domain.repository.ModerationQueueRepository.class),
                beans.getBeanProvider(br.com.fashionai.application.audit.Audit.class), true);
    }

    private static MockMultipartHttpServletRequest upload(String path) {
        MockMultipartHttpServletRequest r = new MockMultipartHttpServletRequest();
        r.setRequestURI(path);
        r.addFile(new MockMultipartFile("file", "foto.jpg", "image/jpeg", ImageOps.jpeg(new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB), 0.9f)));
        return r;
    }

    private static void login() {
        Jwt jwt = new Jwt("t", Instant.now(), Instant.now().plusSeconds(60), Map.of("alg", "none"), Map.of("sub", USER.toString(), "user_id", USER.toString()));
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    @Test
    void fotoLiberadaSegueParaOFluxo() {
        login();
        assertTrue(interceptor(fixed(ImageSafety.Decision.ALLOW)).preHandle(upload("/api/me/avatar"), new MockHttpServletResponse(), null));
        assertTrue(held.isEmpty());
    }

    @Test
    void fotoEmRevisaoFicaRetidaEAPessoaEAvisada() {
        login();
        ApiException ex = assertThrows(ApiException.class,
                () -> interceptor(fixed(ImageSafety.Decision.REVIEW)).preHandle(upload("/api/schemes/photos"), new MockHttpServletResponse(), null));
        assertEquals(422, ex.status());
        assertEquals("IMAGEM_EM_REVISAO", ex.code());
        assertEquals(List.of(USER + " /api/schemes/photos"), held);
    }

    @Test
    void fotoRecusadaNaoEGuardada() {
        login();
        ApiException ex = assertThrows(ApiException.class,
                () -> interceptor(fixed(ImageSafety.Decision.BLOCK)).preHandle(upload("/api/photos/background-removal"), new MockHttpServletResponse(), null));
        assertEquals("IMAGEM_RECUSADA", ex.code());
        assertTrue(held.isEmpty());
    }

    @Test
    void semContaNaoHaQuarentenaPedeOutraFoto() {
        ApiException ex = assertThrows(ApiException.class,
                () -> interceptor(fixed(ImageSafety.Decision.REVIEW)).preHandle(upload("/api/auth/pre-registration/photo"), new MockHttpServletResponse(), null));
        assertEquals("IMAGEM_NAO_ACEITA", ex.code());
        assertTrue(held.isEmpty());
    }

    @Test
    void texturaDoAvatarGeradaPeloAppNaoPassaPelaModeracao() {
        login();
        assertTrue(interceptor(fixed(ImageSafety.Decision.BLOCK)).preHandle(upload("/api/me/avatar3d/texture"), new MockHttpServletResponse(), null));
    }

    @Test
    void arquivosDemaisNaRequisicaoSaoRecusadosAntesDeDecodificar() {
        MockMultipartHttpServletRequest r = upload("/api/auth/uploads");
        for (int i = 0; i < UploadSafetyInterceptor.MAX_FILE_PARTS; i++) {
            r.addFile(new MockMultipartFile("extra", "x" + i + ".jpg", "image/jpeg", new byte[]{1}));
        }
        ApiException ex = assertThrows(ApiException.class,
                () -> interceptor(fixed(ImageSafety.Decision.ALLOW)).preHandle(r, new MockHttpServletResponse(), null));
        assertEquals(400, ex.status());
        assertEquals("ARQUIVOS_DEMAIS", ex.code());
    }

    @Test
    void bombaDeDescompressaoNaRotaPublicaDeCadastroERecusada() {
        byte[] png = ImageOps.png(new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB));
        java.nio.ByteBuffer.wrap(png, 16, 8).putInt(60_000).putInt(60_000);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(png, 12, 17);
        java.nio.ByteBuffer.wrap(png, 29, 4).putInt((int) crc.getValue());
        MockMultipartHttpServletRequest r = new MockMultipartHttpServletRequest();
        r.setRequestURI("/api/auth/uploads");
        r.addFile(new MockMultipartFile("file", "bomba.png", "image/png", png));
        ImageSafety real = new ImageSafety(List.of(), List.of(), false);
        ApiException ex = assertThrows(ApiException.class, () -> interceptor(real).preHandle(r, new MockHttpServletResponse(), null));
        assertEquals(400, ex.status());
        assertEquals(ImageOps.TOO_LARGE, ex.code());
    }

    @Test
    void imagemIlegivelNaoEntra() {
        login();
        MockMultipartHttpServletRequest r = new MockMultipartHttpServletRequest();
        r.setRequestURI("/api/me/cover");
        r.addFile(new MockMultipartFile("file", "foto.heic", "image/heic", "ftypheic-bytes-quaisquer".getBytes()));
        ImageSafety real = new ImageSafety(List.of(), List.of(), false);
        ApiException ex = assertThrows(ApiException.class, () -> interceptor(real).preHandle(r, new MockHttpServletResponse(), null));
        assertEquals("FORMATO_INVALIDO", ex.code());
    }
}
