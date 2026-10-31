package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.TaskStatus;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.ai.RestClientFakes;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Meshy image-to-3D: envio da tarefa e leitura do estado (SUCCEEDED/FAILED/RUNNING/PENDING) com o erro certo. */
class MeshyModel3dAdapterTest {
    private static final String BASE = "https://api.meshy.ai";
    private final MeshyModel3dAdapter adapter = new MeshyModel3dAdapter(" chave ");
    private final MockRestServiceServer server = RestClientFakes.bind(adapter, BASE);

    @AfterEach
    void fechaCircuito() throws Exception {
        ProviderCircuit.run("meshy", () -> true);
    }

    private TaskStatus poll(String json) {
        server.reset();
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d/t1")).andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer chave")).andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
        return adapter.poll("t1").orElseThrow();
    }

    @Test
    void identidadeCustoEDisponibilidade() {
        assertThat(adapter.providerId()).isEqualTo("meshy");
        assertThat(adapter.costUsd()).isEqualByComparingTo(new BigDecimal("0.40"));
        assertThat(adapter.available()).isTrue();
        assertThat(new MeshyModel3dAdapter(null).available()).isFalse();
        assertThat(new MeshyModel3dAdapter("placeholder-key").available()).isFalse();
    }

    @Test
    void submeteSoGlbEDevolveOIdDaTarefa() {
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d")).andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer chave"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"target_formats\":[\"glb\"]")))
                .andRespond(withSuccess("{\"result\":\"t1\"}", MediaType.APPLICATION_JSON));
        assertThat(adapter.submit(new byte[]{1, 2})).contains("t1");
        server.verify();
    }

    @Test
    void submeteSemIdOuSemCorpoOuComErroDevolveVazio() {
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThat(adapter.submit(new byte[]{1})).isEmpty();
        server.reset();
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d")).andRespond(withSuccess());
        assertThat(adapter.submit(new byte[]{1})).isEmpty();
        server.reset();
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d")).andRespond(withBadRequest());
        assertThat(adapter.submit(new byte[]{1})).isEmpty();
    }

    @Test
    void tarefaConcluidaTrazOGlbEOProgresso() {
        TaskStatus s = poll("{\"status\":\"SUCCEEDED\",\"progress\":100,\"model_urls\":{\"glb\":\"https://cdn/x.glb\"}}");
        assertThat(s).isEqualTo(new TaskStatus("SUCCEEDED", 100, "https://cdn/x.glb", null));
    }

    @Test
    void falhaUsaAMensagemDaTarefaOuOStatus() {
        assertThat(poll("{\"status\":\"FAILED\",\"task_error\":{\"message\":\"imagem ruim\"}}").error()).isEqualTo("imagem ruim");
        assertThat(poll("{\"status\":\"CANCELED\",\"task_error\":{\"message\":\" \"}}").error()).isEqualTo("Meshy: CANCELED");
        TaskStatus expired = poll("{\"status\":\"EXPIRED\",\"task_error\":\"texto\",\"model_urls\":{}}");
        assertThat(expired.state()).isEqualTo("FAILED");
        assertThat(expired.error()).isEqualTo("Meshy: EXPIRED");
        assertThat(expired.glbUrl()).isNull();
    }

    @Test
    void emAndamentoOuPendenteSemErro() {
        TaskStatus running = poll("{\"status\":\"IN_PROGRESS\",\"progress\":\"40\",\"model_urls\":\"x\"}");
        assertThat(running).isEqualTo(new TaskStatus("RUNNING", 0, null, null));
        TaskStatus pending = poll("{\"status\":\"PENDING\",\"progress\":5,\"task_error\":{}}");
        assertThat(pending).isEqualTo(new TaskStatus("PENDING", 5, null, null));
    }

    @Test
    void consultaSemCorpoOuComErroDevolveVazio() {
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d/t1")).andRespond(withSuccess());
        assertThat(adapter.poll("t1")).isEmpty();
        server.reset();
        server.expect(requestTo(BASE + "/openapi/v1/image-to-3d/t1")).andRespond(withBadRequest());
        assertThat(adapter.poll("t1")).isEmpty();
    }
}
