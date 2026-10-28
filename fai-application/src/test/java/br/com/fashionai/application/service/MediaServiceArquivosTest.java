package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.PhotoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF12 — leitura, gravação e baixa de mídia: escopos aceitos, restricted/ só por fluxo próprio, acervo e exclusão em cascata. */
class MediaServiceArquivosTest {
    Kit kit;
    MediaStoragePort storage;
    MediaService media;
    User ana;
    UUID anaId;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        storage = kit.dep(MediaStoragePort.class);
        when(storage.keyOf(anyString())).thenAnswer(i -> {
            String u = i.getArgument(0);
            return u.startsWith("/media/") ? Optional.of(u.substring(7)) : Optional.empty();
        });
        when(storage.publicUrl(anyString())).thenAnswer(i -> URI.create("/media/" + i.getArgument(0)));
        media = kit.build(MediaService.class);
        ana = Kit.user("ana");
        anaId = ana.getId();
    }

    @Test
    void gravaPelaPorta() {
        var stored = new MediaStoragePort.StoredObject("k", "/media/k", 3, "image/png");
        when(storage.put("k", new byte[]{1}, "image/png")).thenReturn(stored);
        assertThat(media.put("k", new byte[]{1}, "image/png")).isSameAs(stored);
    }

    @Test
    void escoposDeMidiaAceitos() {
        String own = "/media/users/" + anaId + "/a.png";
        assertThat(media.ownedMedia(anaId, own, Set.of(MediaService.MediaScope.OWNER))).contains(new MediaService.OwnedMedia(
                "users/" + anaId + "/a.png", own));
        assertThat(media.ownedMedia(UUID.randomUUID(), own, Set.of(MediaService.MediaScope.OWNER))).isEmpty();
        assertThat(media.ownedMedia(null, own, Set.of(MediaService.MediaScope.OWNER))).isEmpty();
        assertThat(media.ownedMedia(anaId, "/assets/x.png", Set.of(MediaService.MediaScope.CATALOG))).get()
                .extracting(MediaService.OwnedMedia::key).isNull();
        assertThat(media.ownedMedia(anaId, "/assets/../x.png", Set.of(MediaService.MediaScope.CATALOG))).isEmpty();
        String tryOn = "restricted/users/" + anaId + "/tryon/person/p.jpg";
        assertThat(media.ownedMedia(anaId, tryOn, Set.of(MediaService.MediaScope.PRIVATE_TRY_ON))).isPresent();
        String pend = "pending/" + UUID.randomUUID() + "/avatar.jpg";
        assertThat(media.ownedMedia(null, pend, Set.of(MediaService.MediaScope.PENDING))).isPresent();
        String doc = "restricted/pending/" + UUID.randomUUID() + "/identity.jpg";
        assertThat(media.ownedMedia(null, doc, Set.of(MediaService.MediaScope.PENDING_RESTRICTED))).isPresent();
        assertThat(media.ownedMedia(null, doc, Set.of(MediaService.MediaScope.PENDING))).isEmpty();
        assertThat(media.ownedMedia(anaId, "https://fora.com/x.png", Set.of(MediaService.MediaScope.OWNER))).isEmpty();
        assertThat(media.ownedMedia(anaId, "/media/users/" + anaId + "//x.png", Set.of(MediaService.MediaScope.OWNER))).isEmpty();
        assertThat(media.ownedMedia(anaId, " ", Set.of(MediaService.MediaScope.OWNER))).isEmpty();
        assertThat(media.requireOwnedMedia(anaId, own, Set.of(MediaService.MediaScope.OWNER), "avatar").url()).isEqualTo(own);
        assertThatThrownBy(() -> media.requireOwnedMedia(anaId, "x//y", Set.of(MediaService.MediaScope.OWNER), "avatar"))
                .isInstanceOf(ApiException.class).satisfies(e -> {
                    assertThat(((ApiException) e).code()).isEqualTo("MIDIA_INVALIDA");
                    assertThat(((ApiException) e).details()).containsEntry("field", "avatar");
                });
    }

    @Test
    void tipoDoEnvioDoCadastro() {
        String u = UUID.randomUUID().toString();
        assertThat(MediaService.pendingKind(null)).isNull();
        assertThat(MediaService.pendingKind("pending/" + u + "/logo.jpg")).isEqualTo("logo");
        assertThat(MediaService.pendingKind("restricted/pending/" + u + "/activity-proof.jpg")).isEqualTo("activity-proof");
        assertThat(MediaService.pendingKind("users/x.jpg")).isNull();
        assertThat(MediaService.readableKey("users/a.png")).isTrue();
        assertThat(MediaService.readableKey(" ")).isFalse();
        assertThat(MediaService.readableKey("/abs")).isFalse();
        assertThat(MediaService.readableKey("restricted/a")).isFalse();
        assertThat(MediaService.readableKey("a\\b")).isFalse();
        assertThat(MediaService.safeKey("a/../b")).isFalse();
    }

    @Test
    void leituraNuncaDevolveRestricted() {
        when(storage.get("users/a.png")).thenReturn(new byte[]{7});
        when(storage.get("restricted/doc.jpg")).thenReturn(new byte[]{9});
        when(storage.get("users/sumiu.png")).thenThrow(new IllegalStateException("404"));
        assertThat(media.read(null)).isEmpty();
        assertThat(media.read("/media/users/a.png")).get().isEqualTo(new byte[]{7});
        assertThat(media.read("/media/restricted/doc.jpg")).isEmpty();
        assertThat(media.read("/media/users/sumiu.png")).isEmpty();
        assertThat(media.readRestricted(null)).isEmpty();
        assertThat(media.readRestricted("/media/restricted/doc.jpg")).get().isEqualTo(new byte[]{9});
        assertThat(media.readRestricted("/media/users/a.png")).isEmpty();
        when(storage.get("restricted/quebrado.jpg")).thenThrow(new IllegalStateException("x"));
        assertThat(media.readRestricted("/media/restricted/quebrado.jpg")).isEmpty();
    }

    @Test
    void leituraDeImagem() {
        when(storage.get("users/img.png")).thenReturn(ImageOps.png(new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB)));
        when(storage.get("users/lixo.png")).thenReturn(new byte[]{1, 2, 3});
        assertThat(media.readImage("/media/users/img.png")).get().extracting(BufferedImage::getWidth).isEqualTo(4);
        assertThat(media.readImage("/media/users/lixo.png")).isEmpty();
    }

    @Test
    void apagarEIdempotente() {
        media.deleteUrl(null);
        media.deleteUrl("https://fora/x");
        verify(storage, never()).delete(anyString());
        doThrow(new IllegalStateException("já foi")).when(storage).delete("users/x.png");
        media.deleteUrl("/media/users/x.png");
        verify(storage).delete("users/x.png");
    }

    @Test
    void extensaoPeloTipo() {
        assertThat(Arrays.asList("image/png", "image/webp", "image/jpeg", "application/json", "text/plain").stream().map(MediaService::ext))
                .containsExactly("png", "webp", "jpg", "json", "bin");
        assertThat(MediaService.ext(null)).isEqualTo("bin");
    }

    @Test
    void registroNoAcervoELigacaoAoDono() {
        var stored = new MediaStoragePort.StoredObject("users/a.png", "/media/users/a.png", 10, "image/png");
        Photo p = media.register(ana, PhotoOrigin.WARDROBE_ITEM, null, stored, null, null, new byte[]{1}, 4, 3, BigDecimal.ONE, null, Map.of("k", 1));
        assertThat(p.getOriginalUrl()).isEqualTo("/media/users/a.png");
        assertThat(p.getThumbnailUrl()).isEqualTo("/media/users/a.png");
        assertThat(p.getContentHash()).isNotNull();
        assertThat(p.getModerationStatus()).isEqualTo(ModerationStatus.APPROVED);
        assertThat(p.getMetadataJson()).contains("\"k\":1");
        Photo q = media.register(ana, PhotoOrigin.EDITOR, UUID.randomUUID(), stored, "/o.png", "/t.png", null, null, null, null,
                ModerationStatus.PENDING, null);
        assertThat(q.getOriginalUrl()).isEqualTo("/o.png");
        assertThat(q.getContentHash()).isNull();
        assertThat(q.getMetadataJson()).isNull();

        UUID look = UUID.randomUUID();
        media.linkSource(anaId, null, look);
        media.linkSource(anaId, "/media/users/a.png", null);
        assertThat(p.getSourceEntityId()).isNull();
        media.linkSource(anaId, "/media/users/a.png", look);
        assertThat(p.getSourceEntityId()).isEqualTo(look);
        assertThat(q.getSourceEntityId()).isNotEqualTo(look);
    }

    @Test
    void baixaDasFotosDaEntidade() {
        UUID piece = UUID.randomUUID();
        var stored = new MediaStoragePort.StoredObject("users/a.png", "/media/users/a.png", 10, "image/png");
        Photo daPeca = media.register(ana, PhotoOrigin.WARDROBE_ITEM, piece, stored, null, null, null, null, null, null, null, null);
        Photo outraOrigem = media.register(ana, PhotoOrigin.PROFILE, piece, stored, null, null, null, null, null, null, null, null);
        var s2 = new MediaStoragePort.StoredObject("users/b.png", "/media/users/b.png", 10, "image/png");
        Photo pelaUrl = media.register(ana, PhotoOrigin.EDITOR, null, s2, null, null, null, null, null, null, null, null);
        int n = media.retire(anaId, piece, Set.of(PhotoOrigin.WARDROBE_ITEM, PhotoOrigin.EDITOR), java.util.Arrays.asList("/media/users/b.png", null, " "));
        assertThat(n).isEqualTo(2);
        assertThat(daPeca.getDeletedAt()).isNotNull();
        assertThat(pelaUrl.getDeletedAt()).isNotNull();
        assertThat(outraOrigem.getDeletedAt()).isNull();
        assertThat(media.retire(anaId, null, Set.of(PhotoOrigin.WARDROBE_ITEM), null)).isZero();
        assertThat(List.of(daPeca, pelaUrl)).allMatch(ph -> ph.getUser() == ana);
    }
}
