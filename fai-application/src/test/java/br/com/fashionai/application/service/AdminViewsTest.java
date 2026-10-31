package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCatalog;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.domain.model.AuditLog;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura {@link AdminViews}: sem repositório, guard ou transação. */
class AdminViewsTest {

    private static ModerationQueueItem item(String type, UUID target, String json) {
        ModerationQueueItem q = new ModerationQueueItem();
        q.setTargetType(type);
        q.setTargetId(target);
        q.setCategoriesJson(json);
        return q;
    }

    /** Lookup que registra os ids consultados. */
    private static Function<UUID, Optional<WardrobeItem>> lookup(List<UUID> calls, WardrobeItem found) {
        return id -> {
            calls.add(id);
            return Optional.ofNullable(found);
        };
    }

    @Test
    void pecaSoConsultaOLookupComAlvoEPreservaImagemNula() {
        List<UUID> calls = new ArrayList<>();
        WardrobeItem semImagem = new WardrobeItem();
        UUID target = UUID.randomUUID();
        Map<String, Object> m = AdminViews.moderationItem(item("PIECE", target, "[]"), lookup(calls, semImagem));
        assertThat(calls).containsExactly(target);
        assertThat(m).containsKey("imageUrl").containsEntry("imageUrl", null);

        calls.clear();
        assertThat(AdminViews.moderationItem(item("PIECE", null, "[]"), lookup(calls, semImagem))).doesNotContainKey("imageUrl");
        assertThat(calls).isEmpty();
    }

    @Test
    void outrosAlvosNaoConsultamPecas() {
        List<UUID> calls = new ArrayList<>();
        AdminViews.moderationItem(item("COMMENT", UUID.randomUUID(), "[\"odio\"]"), lookup(calls, new WardrobeItem()));
        AdminViews.moderationItem(item(UploadQuarantine.TARGET, UUID.randomUUID(), "{}"), lookup(calls, new WardrobeItem()));
        assertThat(calls).isEmpty();
    }

    @Test
    void fotoRetidaNaoVazaChaveDoArquivoRestrito() {
        Map<String, Object> m = AdminViews.moderationItem(item(UploadQuarantine.TARGET, UUID.randomUUID(),
                "{\"reasons\":[\"r\"],\"kind\":\"PHOTO\",\"engine\":\"onnx\",\"key\":\"restricted/moderation/a.jpg\",\"userEmail\":\"x@y\"}"),
                id -> Optional.empty());
        assertThat(m).doesNotContainKeys("key", "imageUrl");
        assertThat(m.toString()).doesNotContain("restricted/").doesNotContain("x@y");
        assertThat(m.get("upload")).isEqualTo(Map.of("kind", "PHOTO", "engine", "onnx", "signals", Map.of()));
    }

    @Test
    void auditoriaComMetadadosInvalidosViraMapaVazio() {
        AuditLog a = new AuditLog("ana", "LOGIN", "auth", "OK", "10.0.0.1", "JUnit", Instant.EPOCH, "c", "não-json");
        assertThat(AdminViews.auditEntry(a)).containsEntry("ip", "10.0.0.1").containsEntry("metadata", Map.of());
    }

    @Test
    void catalogoDeIaCobreTodasAsCapacidades() {
        assertThat(AiCatalog.all()).allSatisfy(s -> {
            Map<String, Object> c = AdminViews.aiCapability(s);
            assertThat(c).containsEntry("capability", s.capability().name()).containsEntry("status", s.status());
            assertThat(c.get("primary")).isEqualTo(s.primary() == null ? "" : s.primary().service() + " · " + s.primary().model());
        });
    }
}
