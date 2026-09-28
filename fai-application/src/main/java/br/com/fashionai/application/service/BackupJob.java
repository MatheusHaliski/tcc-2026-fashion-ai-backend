package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.domain.model.BackupRecord;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;

/**
 * Uma execução de backup (RNF4), manual ou agendada: registro em backup_records desde o início (RUNNING), falha
 * sempre visível — status FAILED com o motivo em {@code notes} e log ERROR (antes, o job das 3 h falhava em silêncio)
 * — e retenção: depois de um backup bem-sucedido ficam só os {@code retention} mais recentes; os arquivos dos mais
 * antigos são apagados do storage pelo próprio adaptador e o registro vira EXPIRED (o histórico continua).
 */
final class BackupJob {
    static final String KIND = "MYSQL_FULL";
    static final String RUNNING = "RUNNING";
    static final String COMPLETED = "COMPLETED";
    static final String FAILED = "FAILED";
    static final String EXPIRED = "EXPIRED";
    /** backup_records.notes é VARCHAR(512). */
    static final int NOTES_MAX = 512;
    private static final Logger log = LoggerFactory.getLogger(BackupJob.class);

    private final BackupRecordRepository records;
    private final BackupPort port;
    private final int retention;

    /** @param port adaptador de backup, ou {@code null} quando nenhum está configurado */
    BackupJob(BackupRecordRepository records, BackupPort port, int retention) {
        this.records = records;
        this.port = port;
        this.retention = retention;
    }

    BackupRecord run(String trigger) {
        BackupRecord r = new BackupRecord();
        // id gerado pelo JPA (persist): atribuir UUID à mão num @GeneratedValue faz o save virar merge
        r.setKind(KIND);
        r.setStatus(RUNNING);
        r.setStartedAt(Instant.now());
        r = records.save(r);
        BackupPort.Result res = execute();
        r.setStatus(res.ok() ? COMPLETED : FAILED);
        r.setFileKey(res.fileKey());
        r.setSizeBytes(res.sizeBytes());
        r.setChecksum(res.checksum());
        r.setNotes(clip(res.notes()));
        r.setFinishedAt(Instant.now());
        r = records.save(r);
        if (res.ok()) {
            log.info("Backup {} ({}) concluído: {} ({} bytes)", r.getId(), trigger, r.getFileKey(), r.getSizeBytes());
            prune();
        } else {
            log.error("Backup {} ({}) FALHOU: {}", r.getId(), trigger, r.getNotes());
        }
        return r;
    }

    private BackupPort.Result execute() {
        if (port == null) {
            return new BackupPort.Result(false, null, 0, null, Msg.t("admin.nenhum_adaptador_de_backup_configurado"));
        }
        try {
            BackupPort.Result res = port.run(KIND);
            return res != null ? res : new BackupPort.Result(false, null, 0, null, "o adaptador de backup não devolveu resultado");
        } catch (RuntimeException ex) {
            return new BackupPort.Result(false, null, 0, null, "erro inesperado no backup: " + ex.getClass().getSimpleName() + ": " + ex.getMessage());
        }
    }

    /** Mantém os {@code retention} backups COMPLETED mais recentes; devolve quantos antigos foram removidos. */
    int prune() {
        if (port == null || retention <= 0) {
            return 0;
        }
        List<BackupRecord> done = records.findByStatusOrderByStartedAtDesc(COMPLETED);
        int removed = 0;
        for (BackupRecord old : done.subList(Math.min(retention, done.size()), done.size())) {
            try {
                if (old.getFileKey() != null && !port.delete(old.getFileKey())) {
                    log.warn("Retenção de backup: o adaptador não apagou {}; os backups antigos ficam no storage", old.getFileKey());
                    return removed;
                }
                old.setStatus(EXPIRED);
                old.setNotes(clip("removido pela retenção (mantidos os " + retention + " mais recentes); " + old.getNotes()));
                records.save(old);
                removed++;
            } catch (RuntimeException ex) {
                log.warn("Retenção de backup: falha ao apagar {}: {}", old.getFileKey(), ex.getMessage());
            }
        }
        if (removed > 0) {
            log.info("Retenção de backup: {} backup(s) antigo(s) removido(s)", removed);
        }
        return removed;
    }

    static String clip(String notes) {
        if (notes == null) {
            return null;
        }
        return notes.length() <= NOTES_MAX ? notes : notes.substring(0, NOTES_MAX - 1) + "…";
    }
}
