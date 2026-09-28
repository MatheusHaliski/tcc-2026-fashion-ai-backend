package br.com.fashionai.application.service;

import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.domain.model.BackupRecord;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RNF4 — backup com falha visível (FAILED + motivo) e retenção dos N mais recentes. */
class BackupJobTest {

    /** Porta falsa: devolve o resultado configurado e anota o que a retenção pediu para apagar. */
    private static final class FakePort implements BackupPort {
        Result next = new Result(true, "restricted/backups/fashionai-novo.sql.gz", 123, "abc", "ok");
        RuntimeException boom;
        boolean canDelete = true;
        final List<String> deleted = new ArrayList<>();

        @Override
        public Result run(String kind) {
            if (boom != null) {
                throw boom;
            }
            return next;
        }

        @Override
        public boolean delete(String fileKey) {
            if (canDelete) {
                deleted.add(fileKey);
            }
            return canDelete;
        }
    }

    private final BackupRecordRepository repo = mock(BackupRecordRepository.class);
    private final List<BackupRecord> saved = new ArrayList<>();

    BackupJobTest() {
        when(repo.save(any(BackupRecord.class))).thenAnswer(inv -> {
            BackupRecord r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(UUID.randomUUID()); // o JPA gera o id no persist
            }
            saved.add(r);
            return r;
        });
    }

    private static List<BackupRecord> completed(int n) {
        List<BackupRecord> list = new ArrayList<>();
        Instant now = Instant.now();
        for (int i = 0; i < n; i++) {
            BackupRecord r = new BackupRecord();
            r.setId(UUID.randomUUID());
            r.setStatus(BackupJob.COMPLETED);
            r.setStartedAt(now.minusSeconds(86_400L * i));
            r.setFileKey("restricted/backups/fashionai-" + i + ".sql.gz");
            r.setNotes("ok");
            list.add(r);
        }
        return list;
    }

    @Test
    void sucessoRegistraCompletedEAplicaARetencao() {
        FakePort port = new FakePort();
        when(repo.findByStatusOrderByStartedAtDesc(BackupJob.COMPLETED)).thenReturn(completed(16));

        BackupRecord r = new BackupJob(repo, port, 14).run("agendado");

        assertThat(r.getStatus()).isEqualTo(BackupJob.COMPLETED);
        assertThat(r.getFileKey()).startsWith("restricted/backups/");
        assertThat(r.getFinishedAt()).isNotNull();
        // os dois mais antigos (posições 14 e 15) saem do storage e viram EXPIRED
        assertThat(port.deleted).containsExactly("restricted/backups/fashionai-14.sql.gz", "restricted/backups/fashionai-15.sql.gz");
        assertThat(saved).filteredOn(b -> BackupJob.EXPIRED.equals(b.getStatus())).hasSize(2)
                .allSatisfy(b -> assertThat(b.getNotes()).contains("retenção"));
    }

    @Test
    void falhaDoAdaptadorViraFailedComOMotivoESemRetencao() {
        FakePort port = new FakePort();
        port.next = new BackupPort.Result(false, null, 0, null, "mysqldump falhou (exit 2): Access denied");

        BackupRecord r = new BackupJob(repo, port, 14).run("agendado");

        assertThat(r.getStatus()).isEqualTo(BackupJob.FAILED);
        assertThat(r.getNotes()).contains("Access denied");
        assertThat(port.deleted).isEmpty();
        verify(repo, never()).findByStatusOrderByStartedAtDesc(any());
    }

    @Test
    void excecaoDoAdaptadorTambemViraFailed() {
        FakePort port = new FakePort();
        port.boom = new IllegalStateException("storage fora do ar");

        BackupRecord r = new BackupJob(repo, port, 14).run("manual");

        assertThat(r.getStatus()).isEqualTo(BackupJob.FAILED);
        assertThat(r.getNotes()).contains("storage fora do ar");
    }

    @Test
    void semAdaptadorRegistraFailed() {
        BackupRecord r = new BackupJob(repo, null, 14).run("agendado");

        assertThat(r.getStatus()).isEqualTo(BackupJob.FAILED);
        assertThat(r.getNotes()).isNotBlank();
        // o registro nasce RUNNING (visível durante o dump) e é atualizado no fim
        assertThat(saved).hasSize(2);
    }

    @Test
    void adaptadorQueNaoApagaInterrompeARetencaoSemMarcarExpired() {
        FakePort port = new FakePort();
        port.canDelete = false;
        when(repo.findByStatusOrderByStartedAtDesc(BackupJob.COMPLETED)).thenReturn(completed(20));

        new BackupJob(repo, port, 14).run("agendado");

        assertThat(saved).noneMatch(b -> BackupJob.EXPIRED.equals(b.getStatus()));
    }

    @Test
    void motivoLongoCabeNaColunaNotes() {
        FakePort port = new FakePort();
        port.next = new BackupPort.Result(false, null, 0, null, "x".repeat(5000));

        BackupRecord r = new BackupJob(repo, port, 14).run("agendado");

        assertThat(r.getNotes()).hasSize(BackupJob.NOTES_MAX);
    }
}
