package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.AuraMotionPort;
import br.com.fashionai.infrastructure.ai.RestClientFakes;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Worker do Aura Motion: autenticação, validação do id do job, do status e do vídeo devolvidos. */
class AuraMotionAdapterTest {
    private static final String BASE = "http://motion.local";
    private final AuraMotionAdapter adapter = new AuraMotionAdapter(BASE + " ", " tk ");
    private final MockRestServiceServer server = RestClientFakes.bind(adapter, BASE);

    private void responde(String path, String json) {
        server.reset();
        server.expect(requestTo(BASE + path)).andExpect(method(HttpMethod.POST)).andExpect(header("Authorization", "Bearer tk"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    @Test
    void semUrlOuSemTokenNaoFicaDisponivel() {
        assertThat(adapter.available()).isTrue();
        assertThat(new AuraMotionAdapter(null, "tk").available()).isFalse();
        assertThat(new AuraMotionAdapter(" ", "tk").available()).isFalse();
        AuraMotionAdapter semToken = new AuraMotionAdapter(BASE, null);
        assertThat(semToken.available()).isFalse();
        assertThatThrownBy(() -> semToken.poll("j1")).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(503);
            assertThat(e.code()).isEqualTo("AURA_MOTION_NOT_CONFIGURED");
        });
    }

    @Test
    void submeteEDevolveOIdValido() {
        responde("/v1/impersonation/jobs", "{\"jobId\":\"job:1-a_b\"}");
        assertThat(adapter.submit("k1", new byte[]{1}, new byte[]{2}, "walk", Map.of())).isEqualTo("job:1-a_b");
        server.verify();
    }

    @Test
    void idDoJobInvalidoOuAusenteEhRecusado() {
        responde("/v1/impersonation/jobs", "{\"jobId\":\"../etc\"}");
        assertThatThrownBy(() -> adapter.submit("k", new byte[]{1}, new byte[]{2}, "t", Map.of())).hasMessage("INVALID_PROVIDER_JOB");
        responde("/v1/impersonation/jobs", "{\"jobId\":42}");
        assertThatThrownBy(() -> adapter.submit("k", new byte[]{1}, new byte[]{2}, "t", Map.of())).hasMessage("INVALID_PROVIDER_JOB");
    }

    @Test
    void erroDoWorkerOuDeRedeViraIndisponivel() {
        server.expect(requestTo(BASE + "/v1/impersonation/jobs/status")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> adapter.poll("j1")).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("AURA_MOTION_WORKER_UNAVAILABLE"));
        server.reset();
        server.expect(requestTo(BASE + "/v1/impersonation/jobs/status")).andRespond(withException(new IOException("caiu")));
        assertThatThrownBy(() -> adapter.poll("j1")).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(503);
            assertThat(e.code()).isEqualTo("AURA_MOTION_WORKER_UNAVAILABLE");
        });
    }

    @Test
    void statusProntoDecodificaOVideoEOsSinais() {
        String mp4 = Base64.getEncoder().encodeToString(new byte[]{7, 8});
        responde("/v1/impersonation/jobs/status", "{\"status\":\"READY\",\"mp4Base64\":\"" + mp4 + "\",\"durationSeconds\":5,"
                + "\"fps\":24.0,\"personDetected\":true,\"garmentMatched\":true,\"temporalQualityPassed\":false}");
        AuraMotionPort.Result r = adapter.poll("j1");
        assertThat(r.status()).isEqualTo("READY");
        assertThat(r.mp4()).containsExactly(7, 8);
        assertThat(r.durationSeconds()).isEqualTo(5.0);
        assertThat(r.fps()).isEqualTo(24.0);
        assertThat(r.personDetected()).isTrue();
        assertThat(r.garmentMatched()).isTrue();
        assertThat(r.temporalQualityPassed()).isFalse();
    }

    @Test
    void statusEmProcessamentoNaoTemVideo() {
        responde("/v1/impersonation/jobs/status", "{\"status\":\"PROCESSING\",\"durationSeconds\":\"5\"}");
        AuraMotionPort.Result r = adapter.poll("j1");
        assertThat(r.mp4()).isNull();
        assertThat(r.durationSeconds()).isZero();
        assertThat(r.personDetected()).isFalse();
        assertThat(r.failureCode()).isEqualTo("AURA_MOTION_PROCESSING_FAILED");
    }

    @Test
    void statusDesconhecidoOuProntoSemVideoSaoRecusados() {
        responde("/v1/impersonation/jobs/status", "{\"status\":\"DONE\"}");
        assertThatThrownBy(() -> adapter.poll("j1")).hasMessage("INVALID_MOTION_STATUS");
        responde("/v1/impersonation/jobs/status", "{\"status\":\"READY\",\"mp4Base64\":7}");
        assertThatThrownBy(() -> adapter.poll("j1")).hasMessage("INVALID_VIDEO");
    }

    @Test
    void cancelamentoPrecisaSerConfirmado() {
        responde("/v1/impersonation/jobs/cancel", "{\"status\":\"CANCELLED\"}");
        adapter.cancel("j1");
        server.verify();
        responde("/v1/impersonation/jobs/cancel", "{\"status\":\"RUNNING\"}");
        assertThatThrownBy(() -> adapter.cancel("j1")).hasMessage("CANCEL_NOT_CONFIRMED");
    }
}
