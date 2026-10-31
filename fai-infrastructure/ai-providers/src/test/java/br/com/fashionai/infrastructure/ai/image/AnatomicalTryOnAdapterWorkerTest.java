package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.infrastructure.ai.RestClientFakes;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Worker anatômico: rotas, corpo do try-on e tradução das recusas do worker (422 com motivo, demais 503). */
class AnatomicalTryOnAdapterWorkerTest {
    private static final String BASE = "http://vton.local";
    private final AnatomicalTryOnAdapter adapter = new AnatomicalTryOnAdapter(" " + BASE + " ", " tk ", 75);
    private final MockRestServiceServer server = RestClientFakes.bind(adapter, BASE);

    private void ok(String path, String json) {
        server.expect(requestTo(BASE + path)).andExpect(method(HttpMethod.POST)).andExpect(header("Authorization", "Bearer tk"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    @Test
    void timeoutForaDaFaixaEhRecusado() {
        assertThatThrownBy(() -> new AnatomicalTryOnAdapter(BASE, "t", 74)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AnatomicalTryOnAdapter(BASE, "t", 651)).isInstanceOf(IllegalArgumentException.class);
        assertThat(new AnatomicalTryOnAdapter(null, null, 650).available()).isFalse();
        assertThat(new AnatomicalTryOnAdapter(BASE, " ", 650).available()).isFalse();
        assertThat(adapter.available()).isTrue();
    }

    @Test
    void semWorkerNadaEhEnviado() {
        AnatomicalTryOnAdapter off = new AnatomicalTryOnAdapter("", "", 650);
        assertThatThrownBy(() -> off.probePerson(new byte[]{1})).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("VTON_NOT_CONFIGURED"));
        assertThatThrownBy(() -> off.render("g", new byte[]{1}, new byte[]{2}, null, null, false))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(503));
    }

    @Test
    void poseMedidasERetratoDevolvemOJsonDoWorker() {
        ok("/v1/body/pose", "{\"pose\":\"ok\"}");
        ok("/v1/body/measure", "{\"chest\":90}");
        ok("/v1/avatar/portrait", "{\"seed\":7}");
        assertThat(adapter.probePerson(new byte[]{1})).containsEntry("pose", "ok");
        assertThat(adapter.measureBody(new byte[]{1})).containsEntry("chest", 90);
        assertThat(adapter.stylizedPortrait(new byte[]{1}, 7)).containsEntry("seed", 7);
        server.verify();
    }

    @Test
    void renderRegistraAPecaEEnviaCategoriaEEvidencias() {
        ok("/v1/catalog/g1", "{}");
        server.expect(requestTo(BASE + "/try-on")).andExpect(content().string(allOf(containsString("\"garment_id\":\"g1\""),
                        containsString("\"garment_category\":\"top\""), containsString("\"body_evidence\""), containsString("\"mirror\":true"))))
                .andRespond(withSuccess("{\"image\":\"x\"}", MediaType.APPLICATION_JSON));
        assertThat(adapter.render("g1", new byte[]{1}, new byte[]{2}, "top", Map.of("h", 1), true)).containsEntry("image", "x");
        server.verify();
    }

    @Test
    void renderSemCategoriaNemEvidenciasNaoMandaOsCampos() {
        ok("/v1/catalog/g2", "{}");
        server.expect(requestTo(BASE + "/try-on")).andExpect(content().string(allOf(not(containsString("garment_category")),
                        not(containsString("body_evidence")))))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        adapter.render("g2", new byte[]{1}, new byte[]{2}, null, Map.of(), false);
        server.verify();
    }

    @Test
    void recusa422LevaOMotivoEOutrasViram503() {
        server.expect(requestTo(BASE + "/v1/body/pose")).andRespond(withStatus(org.springframework.http.HttpStatusCode.valueOf(422))
                .contentType(MediaType.APPLICATION_JSON).body("{\"code\":\"MULTIPLE_PEOPLE\"}"));
        assertThatThrownBy(() -> adapter.probePerson(new byte[]{1})).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(422);
            assertThat(e.code()).isEqualTo("VTON_WORKER_REJECTED");
            assertThat(e.details()).containsEntry("reason", "MULTIPLE_PEOPLE");
        });
        server.reset();
        server.expect(requestTo(BASE + "/v1/body/pose")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("falhou"));
        assertThatThrownBy(() -> adapter.probePerson(new byte[]{1})).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(503);
            assertThat(e.details()).isEmpty();
        });
    }

    @Test
    void motivoSoComCorpoCurtoEmJsonValido() {
        assertThat(AnatomicalTryOnAdapter.reasonOf(null)).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(new byte[0])).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(new byte[5000])).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf("{\"code\":7}".getBytes())).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf("nao-json".getBytes())).isNull();
    }
}
