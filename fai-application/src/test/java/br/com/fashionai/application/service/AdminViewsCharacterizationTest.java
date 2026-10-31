package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.AiInferenceLog;
import br.com.fashionai.domain.model.AuditLog;
import br.com.fashionai.domain.model.BackupRecord;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.AuditLogRepository;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Caracterização das views administrativas (fila de moderação, auditoria, IA e backups): chaves, ordem, conversões
 * para texto e limites — e RBAC real (Guard de verdade): usuário comum negado, admin autorizado.
 */
class AdminViewsCharacterizationTest {
    private Kit kit;
    private World world;
    private AdminService admin;
    private CurrentUser root;

    @BeforeEach
    void setUp() {
        kit = new Kit().with(new Guard(mock(AuditService.class), mock(FollowRepository.class)));
        world = new World(kit);
        admin = kit.build(AdminService.class);
        root = Kit.admin(world.friend);
    }

    private ModerationQueueItem item(String type, UUID target, String categoriesJson) {
        ModerationQueueItem q = new ModerationQueueItem();
        q.setTargetType(type);
        q.setTargetId(target);
        q.setUserId(world.me.getId());
        q.setContentExcerpt("trecho");
        q.setCategoriesJson(categoriesJson);
        q.setConfidence(new BigDecimal("0.91"));
        return kit.dep(ModerationQueueRepository.class).save(q);
    }

    private Map<String, Object> only(List<Map<String, Object>> queue) {
        assertThat(queue).hasSize(1);
        return queue.get(0);
    }

    @Test
    void itemDePecaTemChavesNaOrdemEImagemDaPeca() {
        WardrobeItem w = world.piecesOf(world.me).get(0);
        ModerationQueueItem q = item("PIECE", w.getId(), "[\"nudez\",\"violencia\"]");
        Map<String, Object> m = only(admin.moderationQueue(root));
        assertThat(m.keySet()).containsExactly("id", "targetType", "targetId", "userId", "excerpt", "categories",
                "confidence", "createdAt", "imageUrl");
        assertThat(m).containsEntry("id", q.getId()).containsEntry("targetType", "PIECE").containsEntry("targetId", w.getId())
                .containsEntry("userId", world.me.getId()).containsEntry("excerpt", "trecho")
                .containsEntry("categories", List.of("nudez", "violencia")).containsEntry("confidence", new BigDecimal("0.91"))
                .containsEntry("imageUrl", w.getImageUrl());
    }

    @Test
    void pecaInexistenteOuComentarioNaoTemImagem() {
        item("PIECE", UUID.randomUUID(), "[]");
        assertThat(only(admin.moderationQueue(root))).doesNotContainKey("imageUrl").containsEntry("categories", List.of());
        kit.dep(ModerationQueueRepository.class).deleteAll();
        item("COMMENT", UUID.randomUUID(), "[\"odio\"]");
        assertThat(only(admin.moderationQueue(root)).keySet()).containsExactly("id", "targetType", "targetId", "userId",
                "excerpt", "categories", "confidence", "createdAt");
    }

    @Test
    void fotoRetidaUsaMotivosMetadadosEEndpointAutenticado() {
        ModerationQueueItem q = item(UploadQuarantine.TARGET, UUID.randomUUID(),
                "{\"reasons\":[\"nudez explícita\"],\"kind\":\"PHOTO\",\"engine\":\"vision\",\"signals\":{\"adult\":\"LIKELY\"},\"key\":\"restricted/moderation/x\"}");
        Map<String, Object> m = only(admin.moderationQueue(root));
        assertThat(m.keySet()).containsExactly("id", "targetType", "targetId", "userId", "excerpt", "categories",
                "confidence", "createdAt", "upload", "imageEndpoint");
        assertThat(m).containsEntry("categories", List.of("nudez explícita"))
                .containsEntry("upload", Map.of("kind", "PHOTO", "engine", "vision", "signals", Map.of("adult", "LIKELY")))
                .containsEntry("imageEndpoint", "/api/admin/moderation/" + q.getId() + "/image");
        assertThat(m.toString()).doesNotContain("restricted/moderation/x");
    }

    @Test
    void fotoRetidaSemMetadadosViraTextoNull() {
        item(UploadQuarantine.TARGET, UUID.randomUUID(), "{}");
        Map<String, Object> m = only(admin.moderationQueue(root));
        assertThat(m).containsEntry("categories", List.of())
                .containsEntry("upload", Map.of("kind", "null", "engine", "null", "signals", Map.of()));
    }

    @Test
    void trilhaDeAuditoriaConverteIpEMetadados() {
        Instant at = Instant.parse("2026-10-01T10:00:00Z");
        AuditLog a = new AuditLog("ana", "CONTA_SUSPENSA", "user:1", "OK", null, "JUnit", at, "c1", "{\"reason\":\"spam\"}");
        when(kit.dep(AuditLogRepository.class).findTop100ByActorOrderByTimestampDesc("ana")).thenReturn(List.of(a));
        Map<String, Object> m = only(admin.auditLog(root, "ana"));
        assertThat(m).containsOnly(Map.entry("actor", "ana"), Map.entry("action", "CONTA_SUSPENSA"), Map.entry("resource", "user:1"),
                Map.entry("result", "OK"), Map.entry("ip", "null"), Map.entry("timestamp", at), Map.entry("correlationId", "c1"),
                Map.entry("metadata", Map.of("reason", "spam")));
        assertThat(admin.auditLog(root, "  ")).isEmpty();
    }

    @Test
    void visaoDeIaLimitaA100ChamadasRecentesEConverteTexto() {
        List<AiInferenceLog> logs = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            AiInferenceLog l = new AiInferenceLog();
            l.setCapability("CAP" + i);
            l.setProvider("local");
            l.setLatencyMs(i);
            l.setResult(AiCallResult.SUCCESS);
            l.setFallbackUsed(i % 2 == 0);
            l.setEstimatedCostUsd(i == 0 ? null : new BigDecimal("0.01"));
            logs.add(l);
        }
        when(kit.dep(AiInferenceLogRepository.class).findTop300ByOrderByCreatedAtDesc()).thenReturn(logs);
        Map<String, Object> ai = admin.aiOverview(root);
        @SuppressWarnings("unchecked") List<Map<String, Object>> recent = (List<Map<String, Object>>) ai.get("recent");
        assertThat(recent).hasSize(100);
        assertThat(recent.get(0)).containsOnly(Map.entry("capability", "CAP0"), Map.entry("provider", "local"), Map.entry("model", "null"),
                Map.entry("latencyMs", 0L), Map.entry("costUsd", "null"), Map.entry("result", "SUCCESS"), Map.entry("fallback", true),
                Map.entry("at", logs.get(0).getCreatedAt()));
        assertThat(recent.get(1)).containsEntry("costUsd", "0.01").containsEntry("fallback", false);
        @SuppressWarnings("unchecked") List<Map<String, Object>> catalog = (List<Map<String, Object>>) ai.get("catalog");
        assertThat(catalog).isNotEmpty().allSatisfy(c -> assertThat(c.keySet()).containsExactlyInAnyOrder("capability", "name",
                "hostRf", "primary", "fallback", "dailyQuota", "status"));
        assertThat(catalog).anySatisfy(c -> assertThat((String) c.get("primary")).contains(" · "));
    }

    @Test
    void backupsConvertemCamposOpcionaisEmTexto() {
        BackupRecord r = new BackupRecord();
        r.setId(UUID.randomUUID());
        r.setKind("agendado");
        r.setStatus("RUNNING");
        Instant started = Instant.parse("2026-10-02T06:00:00Z");
        r.setStartedAt(started);
        when(kit.dep(BackupRecordRepository.class).findTop50ByOrderByStartedAtDesc()).thenReturn(List.of(r));
        assertThat(only(admin.backups(root))).containsOnly(Map.entry("id", r.getId()), Map.entry("kind", "agendado"),
                Map.entry("status", "RUNNING"), Map.entry("sizeBytes", "null"), Map.entry("startedAt", started),
                Map.entry("finishedAt", "null"), Map.entry("notes", "null"));
        r.setSizeBytes(2048L);
        r.setFinishedAt(started.plusSeconds(60));
        r.setNotes("ok");
        assertThat(only(admin.backups(root))).containsEntry("sizeBytes", "2048")
                .containsEntry("finishedAt", started.plusSeconds(60).toString()).containsEntry("notes", "ok");
    }

    @Test
    void usuarioComumNegadoEAdminAutorizadoNasViews() {
        CurrentUser common = Kit.as(world.me);
        List<Consumer<CurrentUser>> calls = List.of(u -> admin.moderationQueue(u), u -> admin.auditLog(u, null),
                u -> admin.aiOverview(u), u -> admin.backups(u));
        for (Consumer<CurrentUser> call : calls) {
            assertThatThrownBy(() -> call.accept(common)).isInstanceOf(ApiException.class);
            assertThatThrownBy(() -> call.accept(null)).isInstanceOf(ApiException.class);
            call.accept(root);
        }
    }
}
