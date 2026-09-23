package br.com.fashionai.application.ports;

/** RNF (backup) — gera o dump do banco e guarda no storage; o registro fica em backup_records. */
public interface BackupPort {
    Result run(String kind);

    record Result(boolean ok, String fileKey, long sizeBytes, String checksum, String notes) {
    }
}
