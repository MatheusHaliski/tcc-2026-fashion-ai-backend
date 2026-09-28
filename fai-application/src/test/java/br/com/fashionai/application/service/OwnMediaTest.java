package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** L6 — campos de URL livres (provador, capa, ícone de selo, logo na peça) só aceitam mídia do próprio usuário. */
class OwnMediaTest {
    private static final String BASE = "https://api.fashionai.app/media/";
    private final UUID me = UUID.randomUUID();
    private final OwnMedia own = new OwnMedia(new MediaStoragePort() {
        public URI createUploadUrl(String k, String c) { return URI.create(BASE + k); }
        public URI publicUrl(String k) { return URI.create(BASE + k); }
        public StoredObject put(String k, byte[] b, String c) { return new StoredObject(k, BASE + k, b.length, c); }
        public byte[] get(String k) { return new byte[0]; }
        public void delete(String k) { }
        public Optional<String> keyOf(String url) { return url.startsWith(BASE) ? Optional.of(url.substring(BASE.length())) : Optional.empty(); }
    });

    @Test
    void aceitaSoOQueEDoProprioUsuarioOuDoCatalogo() {
        assertThat(own.accepts(me, BASE + "users/" + me + "/tryon/1.png", false)).isTrue();
        assertThat(own.accepts(me, BASE + "users/" + me + "/groupings/g/cover-1.jpg", true)).isTrue();
        assertThat(own.accepts(me, BASE + "brands/logos/web/nike-wikidata.png", true)).isTrue();
        assertThat(own.accepts(me, BASE + "assets/skins/aura.png", true)).isTrue();
        assertThat(own.accepts(me, BASE + "brands/logos/web/nike-wikidata.png", false)).isFalse();   // catálogo só onde faz sentido
    }

    @Test
    void recusaArquivoDeOutraPessoaRestritoTravessiaELinkExterno() {
        UUID other = UUID.randomUUID();
        assertThat(own.accepts(me, BASE + "users/" + other + "/tryon/1.png", true)).isFalse();
        assertThat(own.accepts(me, BASE + "restricted/users/" + me + "/avatar3d/face.jpg", true)).isFalse();
        assertThat(own.accepts(me, BASE + "restricted/challenges/c/" + me + "/x.jpg", true)).isFalse();
        assertThat(own.accepts(me, BASE + "users/" + me + "/../" + other + "/x.png", true)).isFalse();
        assertThat(own.accepts(me, BASE + "users/" + me + "/x.png?y=1", true)).isFalse();
        assertThat(own.accepts(me, "https://evil.example/users/" + me + "/x.png", true)).isFalse();
        assertThat(own.accepts(me, "javascript:alert(1)", true)).isFalse();
        assertThat(own.accepts(null, BASE + "users/" + me + "/x.png", true)).isFalse();
    }

    @Test
    void requireDevolveNullParaVazioE400ParaOResto() {
        assertThat(own.require(me, "  ", "coverUrl", true)).isNull();
        assertThat(own.require(me, " " + BASE + "users/" + me + "/x.png ", "coverUrl", true)).isEqualTo(BASE + "users/" + me + "/x.png");
        assertThatThrownBy(() -> own.require(me, "https://tracker.example/pixel.gif", "coverUrl", true))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    assertThat(((ApiException) e).status()).isEqualTo(400);
                    assertThat(((ApiException) e).code()).isEqualTo("MIDIA_INVALIDA");
                    assertThat(((ApiException) e).details()).containsEntry("field", "coverUrl");
                });
    }

    @Test
    void valorAtualReenviadoSemMudancaPassaMasTrocaContinuaValidada() {
        String legado = "/assets_pecas/capa-antiga.png";      // gravado antes da regra: não é mídia do storage
        assertThat(own.requireOrUnchanged(me, legado, "coverUrl", true, legado)).isEqualTo(legado);
        assertThatThrownBy(() -> own.requireOrUnchanged(me, "https://tracker.example/pixel.gif", "coverUrl", true, legado))
                .isInstanceOf(ApiException.class);
        assertThat(own.requireOrUnchanged(me, "", "coverUrl", true, legado)).isNull();   // vazio remove
    }
}
