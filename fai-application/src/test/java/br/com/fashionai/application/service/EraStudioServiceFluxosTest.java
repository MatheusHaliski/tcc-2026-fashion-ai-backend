package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Estúdio de Eras: upload da foto, rascunho pela IA (com o motor local) e os temas do fallback. */
class EraStudioServiceFluxosTest {
    private final Kit kit = new Kit();
    private final EraStudioService service = kit.build(EraStudioService.class);
    private final CurrentUser marca = Kit.as(Kit.user("marca"));

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void uploadConverteEmJpegEGuardaNaPastaDaPessoa() throws Exception {
        MediaService media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 1, "image/jpeg"));

        Map<String, Object> out = service.upload(marca, png());

        assertThat((String) out.get("url")).startsWith("/media/users/" + marca.id() + "/era-studio/").endsWith(".jpg");
        verify(media).put(startsWith("users/" + marca.id()), any(), eq("image/jpeg"));
        verify(kit.dep(Guard.class)).requireApprovedInstitutional(eq(marca), eq("era-studio:upload"), anyString());
    }

    @Test
    void uploadExigeImagemValidaEPerfilAprovado() {
        assertThatThrownBy(() -> service.upload(marca, new byte[0])).isInstanceOf(ApiException.class);
        doThrow(ApiException.forbidden("não")).when(kit.dep(Guard.class)).requireApprovedInstitutional(any(), anyString(), anyString());
        assertThatThrownBy(() -> service.draft(marca, "Era disco")).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(403);
    }

    @Test
    void rascunhoCaiNoMotorLocalComTemaDoPedido() {
        Map<String, Object> out = service.draft(marca, "Uma era acústica e intimista");
        @SuppressWarnings("unchecked")
        Map<String, Object> editorial = (Map<String, Object>) out.get("editorial");
        assertThat(editorial.get("theme")).isEqualTo("ACOUSTIC");
        assertThat(out).containsKey("fallbackUsed").containsKey("inferenceId");
        assertThatThrownBy(() -> service.draft(marca, "x")).isInstanceOf(ApiException.class);
    }

    @Test
    void temasDoFallbackPorPalavraChave() {
        assertThat(EraStudioService.local("Show unplugged").get("theme")).isEqualTo("ACOUSTIC");
        assertThat(EraStudioService.local("Era gótica").get("theme")).isEqualTo("DARK_POP");
        assertThat(EraStudioService.local("goth girl").get("theme")).isEqualTo("DARK_POP");
        assertThat(EraStudioService.local("dark mood").get("theme")).isEqualTo("DARK_POP");
        assertThat(EraStudioService.local("noite disco").get("theme")).isEqualTo("RETRO_DISCO");
        assertThat(EraStudioService.local("visual retrô").get("theme")).isEqualTo("RETRO_DISCO");
        assertThat(EraStudioService.local("tons dourados").get("theme")).isEqualTo("GOLDEN_RNB");
        assertThat(EraStudioService.local("cyberpunk").get("theme")).isEqualTo("CYBER_NEON");
        assertThat(EraStudioService.local("luzes neon").get("theme")).isEqualTo("CYBER_NEON");
        assertThat(EraStudioService.local("turnê mundial").get("theme")).isEqualTo("STADIUM");
        assertThat(EraStudioService.local("turnê mundial").get("symbols")).isEqualTo(List.of("MIC", "STAR", "SPOTLIGHT"));
    }

    @Test
    void rascunhoDaIaComDatasConfirmadasEFotoInventada() {
        Map<String, Object> ok = EraStudioService.parseDraft("{\"theme\":\"STADIUM\",\"timeline\":[{\"date\":\"2026-01-01\",\"title\":\"Álbum\"}]}",
                "Lançamos o álbum em 2026-01-01");
        assertThat((List<?>) ok.get("timeline")).hasSize(1);
        assertThatThrownBy(() -> EraStudioService.parseDraft("{\"theme\":\"STADIUM\",\"photos\":[{\"url\":\"http://x\",\"alt\":\"a\"}]}", "Era"))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("ERA_MEDIA_INVALID"));
    }
}
