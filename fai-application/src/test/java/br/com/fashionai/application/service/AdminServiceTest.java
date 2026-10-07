package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.AuditLog;
import br.com.fashionai.domain.model.BackupRecord;
import br.com.fashionai.domain.model.Comment;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.repository.AuditLogRepository;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Administração (RF25): fila de moderação (peça, comentário e foto retida), suspensão e papel de contas, trilha de
 * auditoria, visão da IA e do job do HypeScore v2, backups e os jobs disparados à mão.
 */
class AdminServiceTest {
    private Kit kit;
    private World world;
    private AdminService admin;
    private CurrentUser root;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        admin = kit.build(AdminService.class);
        root = Kit.admin(world.friend);
    }

    private ModerationQueueItem item(String type, UUID target) {
        ModerationQueueItem q = new ModerationQueueItem();
        q.setTargetType(type);
        q.setTargetId(target);
        q.setUserId(world.me.getId());
        q.setContentExcerpt("trecho");
        q.setCategoriesJson("[\"nudez\"]");
        return kit.dep(ModerationQueueRepository.class).save(q);
    }

    @Test
    void filaDeModeracaoAprovaPecaERejeitaComentario() {
        WardrobeItem w = world.piecesOf(world.me).get(0);
        ModerationQueueItem piece = item("PIECE", w.getId());
        Comment c = new Comment();
        c.setAuthor(world.rival);
        c.setTargetType(TargetType.SCHEME);
        c.setTargetId(UUID.randomUUID());
        c.setContent("comentário");
        kit.dep(CommentRepository.class).save(c);
        ModerationQueueItem comment = item("COMMENT", c.getId());
        assertThat(admin.moderationQueue(root)).hasSize(2);
        assertThat(admin.moderationQueue(root).get(0)).containsKey("imageUrl");
        assertThat(admin.moderate(root, piece.getId(), true, "ok")).containsEntry("status", "APPROVED");
        assertThat(w.getModerationStatus()).isEqualTo(ModerationStatus.APPROVED);
        assertThat(admin.moderate(root, comment.getId(), false, null)).containsEntry("status", "REJECTED");
        assertThat(c.isActive()).isFalse();
        assertThat(admin.moderationQueue(root)).isEmpty();
        assertThatThrownBy(() -> admin.moderate(root, UUID.randomUUID(), true, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> admin.moderationImage(root, piece.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void fotoRetidaPelaQuarentena() {
        ModerationQueueItem q = item(UploadQuarantine.TARGET, UUID.randomUUID());
        when(kit.dep(UploadQuarantine.class).image(any())).thenReturn(new byte[]{9});
        List<Map<String, Object>> queue = admin.moderationQueue(root);
        assertThat(queue.get(0)).containsKeys("upload", "imageEndpoint");
        assertThat(admin.moderationImage(root, q.getId())).containsExactly(9);
        admin.moderate(root, q.getId(), false, "retida");
        verify(kit.dep(UploadQuarantine.class)).decide(any(), any(), org.mockito.ArgumentMatchers.eq(false));
        assertThatThrownBy(() -> admin.moderationImage(root, q.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void suspenderReativarEPapelDaConta() {
        assertThatThrownBy(() -> admin.setStatus(root, world.friend.getId(), true, null)).isInstanceOf(ApiException.class);
        assertThat(admin.setStatus(root, world.me.getId(), true, "spam")).containsEntry("status", "SUSPENDED");
        assertThat(world.me.getStatus()).isEqualTo(AccountStatus.SUSPENDED);
        assertThat(admin.setStatus(root, world.me.getId(), false, null)).containsEntry("status", "ACTIVE");
        assertThat(admin.setRole(root, world.me.getId(), "ADMIN")).containsEntry("role", "ADMIN");
        assertThatThrownBy(() -> admin.setRole(root, world.me.getId(), "DONO")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> admin.setStatus(root, UUID.randomUUID(), true, null)).isInstanceOf(ApiException.class);
        assertThat(admin.searchUsers(root, " an ")).isEmpty();
    }

    @Test
    void auditoriaIaBackupsEJobs() {
        AuditLog a = new AuditLog("ana", "LOGIN", "auth", "OK", "127.0.0.1", "JUnit", Instant.now(), "c1", "{}");
        when(kit.dep(AuditLogRepository.class).findTop200ByOrderByTimestampDesc()).thenReturn(List.of(a));
        assertThat(admin.auditLog(root, null)).hasSize(1);
        assertThat(admin.auditLog(root, "ana")).isEmpty();
        Map<String, Object> ai = admin.aiOverview(root);
        assertThat(ai).containsKeys("providers", "remoteEnabled", "catalog", "recent", "hypeV2");
        Map<String, Object> backup = admin.runBackup(root);
        assertThat(backup).containsKey("status");
        admin.scheduledBackup();
        BackupRecord r = new BackupRecord();
        r.setId(UUID.randomUUID());
        r.setKind("manual");
        r.setStatus("COMPLETED");
        r.setStartedAt(Instant.now());
        when(kit.dep(BackupRecordRepository.class).findTop50ByOrderByStartedAtDesc()).thenReturn(List.of(r));
        assertThat(admin.backups(root)).hasSize(1);
        for (String job : List.of("hype", "rankings", "challenges", "assets", "notifications")) {
            assertThat(admin.runJob(root, job)).containsEntry("job", job);
        }
        assertThatThrownBy(() -> admin.runJob(root, "nada")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> admin.runJob(root, null)).isInstanceOf(ApiException.class);
        admin.promoteChallenge(root, "X");
        User u = world.me;
        assertThat(u).isNotNull();
    }
}
