package br.com.fashionai.application.ports;

/** RNF (backup) — gera o dump do banco e guarda no storage; o registro fica em backup_records. */
public interface BackupPort {
    Result run(String kind);

    /**
     * Apaga o arquivo de um backup antigo (retenção). Devolve {@code false} quando o adaptador não sabe apagar ou recusa
     * a chave (só chaves de backup podem ser apagadas por aqui).
     */
    default boolean delete(String fileKey) {
        return false;
    }

    record Result(boolean ok, String fileKey, long sizeBytes, String checksum, String notes) {
    }
}
