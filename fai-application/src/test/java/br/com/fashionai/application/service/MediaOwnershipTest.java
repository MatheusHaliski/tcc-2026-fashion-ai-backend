package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.MediaService.MediaScope.CATALOG;
import static br.com.fashionai.application.service.MediaService.MediaScope.OWNER;
import static br.com.fashionai.application.service.MediaService.MediaScope.PENDING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * URL de mídia vinda do cliente só aponta para arquivo da própria pessoa (ou envio do cadastro / asset do catálogo):
 * nunca restricted/, nunca "..", nunca URL externa — senão "girar a foto" ou o card.png republicavam arquivos de terceiros.
 */
class MediaOwnershipTest {
    private static final String BASE = "https://api.test/media/";
    private final Map<String, byte[]> objects = new HashMap<>();
    private final List<String> reads = new ArrayList<>();
    private final MediaStoragePort storage = new MediaStoragePort() {
        public URI createUploadUrl(String key, String type) { throw new UnsupportedOperationException(); }
        public URI publicUrl(String key) { return URI.create(BASE + key); }
        public StoredObject put(String key, byte[] content, String type) { throw new UnsupportedOperationException(); }
        public byte[] get(String key) { reads.add(key); return objects.getOrDefault(key, new byte[0]); }
        public void delete(String key) { }
        public Optional<String> keyOf(String url) {
            return url != null && url.startsWith(BASE) ? Optional.of(url.substring(BASE.length())) : Optional.empty();
        }
    };
    private final UUID me = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    private Optional<MediaService.OwnedMedia> owned(String url, Set<MediaService.MediaScope> scopes) {
        return MediaService.ownedMedia(storage, me, url, scopes);
    }

    @Test
    void aceitaArquivoDaPropriaPessoaEDevolveAUrlCanonica() {
        Optional<MediaService.OwnedMedia> m = owned(BASE + "users/" + me + "/profile/avatar.jpg", Set.of(OWNER));
        assertThat(m).isPresent();
        assertThat(m.get().key()).isEqualTo("users/" + me + "/profile/avatar.jpg");
        assertThat(m.get().url()).isEqualTo(BASE + "users/" + me + "/profile/avatar.jpg");
    }

    @Test
    void recusaArquivoDeOutraPessoaRestritoTraversalEUrlExterna() {
        assertThat(owned(BASE + "users/" + other + "/profile/avatar.jpg", Set.of(OWNER))).isEmpty();
        assertThat(owned(BASE + "restricted/users/" + me + "/documents/identity.jpg", Set.of(OWNER))).isEmpty();
        assertThat(owned(BASE + "users/" + me + "/../" + other + "/a.jpg", Set.of(OWNER))).isEmpty();
        assertThat(owned("https://evil.tld/tracker.gif", Set.of(OWNER, CATALOG))).isEmpty();
        assertThat(owned("users/" + me + "//a.jpg", Set.of(OWNER))).isEmpty();
        assertThat(owned(" ", Set.of(OWNER))).isEmpty();
    }

    @Test
    void envioDoCadastroSoComOEscopoEOFormatoCertos() {
        String pending = BASE + "pending/" + UUID.randomUUID() + "/avatar.jpg";
        assertThat(owned(pending, Set.of(OWNER))).isEmpty();
        assertThat(owned(pending, Set.of(PENDING))).isPresent();
        assertThat(owned(BASE + "pending/" + UUID.randomUUID() + "/qualquer.jpg", Set.of(PENDING))).isEmpty();
    }

    @Test
    void assetDoCatalogoSoComEscopoCatalogoESemSairDoPublic() {
        assertThat(owned("/assets/backgrounds/aurora.png", Set.of(CATALOG))).isPresent();
        assertThat(owned("/assets/backgrounds/aurora.png", Set.of(OWNER))).isEmpty();
        assertThat(owned("/assets/../../etc/passwd.png", Set.of(CATALOG))).isEmpty();
        assertThat(owned("/media/restricted/x.png", Set.of(CATALOG))).isEmpty();
    }

    @Test
    void requireOwnedMediaRecusaCom400() {
        MediaService media = new MediaService(storage, null);
        assertThatThrownBy(() -> media.requireOwnedMedia(me, BASE + "users/" + other + "/a.jpg", Set.of(OWNER), "avatarUrl"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
    }

    @Test
    void leituraPorUrlGravadaNuncaDevolveRestricted() {
        MediaService media = new MediaService(storage, null);
        objects.put("restricted/users/" + other + "/documents/identity.jpg", new byte[]{1, 2, 3});
        assertThat(media.read(BASE + "restricted/users/" + other + "/documents/identity.jpg")).isEmpty();
        assertThat(reads).isEmpty();
    }
}
