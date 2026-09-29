package br.com.fashionai.infrastructure.mysql.backup;

import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Backup via mysqldump: chave restrita e imprevisível, senha fora da linha de comando, falhas com o motivo. */
class MysqlDumpBackupAdapterTest {
    private static final String SECRET = "s3nh4-do-banco";
    private static final String KEY_RE = "restricted/backups/fashionai-\\d{8}T\\d{6}Z-[0-9a-f]{16}\\.sql\\.gz";

    private final MediaStoragePort storage = mock(MediaStoragePort.class);

    private MysqlDumpBackupAdapter adapter(String command, String password, String sslMode) {
        return new MysqlDumpBackupAdapter(storage, command, "mysql.railway.internal", "3306", "fashionai", "fashionai_backup",
                password, sslMode, 1);
    }

    /** mysqldump falso: imprime o SQL (com a senha que recebeu por MYSQL_PWD) e sai com o código pedido. */
    private static String fakeDump(Path dir, int exit, String stderr) throws Exception {
        Path script = dir.resolve("mysqldump");
        Files.writeString(script, "#!/bin/sh\n"
                + "echo \"-- args: $*\"\n"
                + "echo \"-- pwd: $MYSQL_PWD\"\n"
                + "echo 'CREATE TABLE users (id CHAR(36));'\n"
                + (stderr.isEmpty() ? "" : "echo \"" + stderr + "\" >&2\n")
                + "exit " + exit + "\n");
        assertThat(script.toFile().setExecutable(true)).isTrue();
        return script.toString();
    }

    @Test
    void linhaDeComandoSemSenhaComTlsENoTablespaces() {
        var cmd = adapter("mysqldump", SECRET, "required").command();
        assertThat(cmd).contains("--ssl-mode=REQUIRED", "--no-tablespaces", "--single-transaction", "--set-gtid-purged=OFF", "--protocol=TCP")
                .noneMatch(a -> a.contains(SECRET)).noneMatch(a -> a.startsWith("--password") || a.startsWith("-p"));
        assertThat(cmd.getLast()).isEqualTo("fashionai");
    }

    @Test
    void modoTlsDesconhecidoFicaNoPadraoDoCliente() {
        assertThat(adapter("mysqldump", SECRET, "talvez").command()).noneMatch(a -> a.startsWith("--ssl-mode"));
        assertThat(adapter("mysqldump", SECRET, "").command()).noneMatch(a -> a.startsWith("--ssl-mode"));
    }

    @Test
    void chaveFicaEmRestrictedComSufixoAleatorio() {
        MysqlDumpBackupAdapter a = adapter("mysqldump", SECRET, "PREFERRED");
        String k1 = a.newKey();
        String k2 = a.newKey();
        assertThat(k1).matches(KEY_RE);
        assertThat(k2).matches(KEY_RE).isNotEqualTo(k1);
    }

    @Test
    void semSenhaNaoRodaENaoUsaSenhaPadrao() {
        BackupPort.Result r = adapter("mysqldump", "", "PREFERRED").run("MYSQL_FULL");
        assertThat(r.ok()).isFalse();
        assertThat(r.notes()).contains("MYSQL_PASSWORD");
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void binarioAusenteFalhaComInstrucao(@TempDir Path dir) {
        BackupPort.Result r = adapter(dir.resolve("nao-existe").toString(), SECRET, "PREFERRED").run("MYSQL_FULL");
        assertThat(r.ok()).isFalse();
        assertThat(r.notes()).contains("mysqldump indisponível");
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void dumpVaiGzipadoParaRestrictedComSenhaSoNoAmbiente(@TempDir Path dir) throws Exception {
        when(storage.put(anyString(), any(), eq("application/gzip"))).thenAnswer(inv ->
                new MediaStoragePort.StoredObject(inv.getArgument(0), "https://x/" + inv.getArgument(0), ((byte[]) inv.getArgument(1)).length, "application/gzip"));

        BackupPort.Result r = adapter(fakeDump(dir, 0, ""), SECRET, "REQUIRED").run("MYSQL_FULL");

        assertThat(r.ok()).as(r.notes()).isTrue();
        assertThat(r.fileKey()).matches(KEY_RE);
        ArgumentCaptor<byte[]> gz = ArgumentCaptor.forClass(byte[].class);
        verify(storage).put(eq(r.fileKey()), gz.capture(), eq("application/gzip"));
        String sql = new String(new GZIPInputStream(new ByteArrayInputStream(gz.getValue())).readAllBytes(), StandardCharsets.UTF_8);
        assertThat(sql).contains("CREATE TABLE users").contains("-- pwd: " + SECRET).contains("--ssl-mode=REQUIRED");
        assertThat(sql.lines().filter(l -> l.startsWith("-- args:")).findFirst().orElseThrow()).doesNotContain(SECRET);
        // checksum confere com o arquivo guardado (sha256sum do .sql.gz)
        assertThat(r.checksum()).isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(gz.getValue())));
        assertThat(r.sizeBytes()).isEqualTo(gz.getValue().length);
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void falhaDoMysqldumpVoltaComMotivoSemASenha(@TempDir Path dir) throws Exception {
        BackupPort.Result r = adapter(fakeDump(dir, 2, "Access denied for user fashionai_backup (" + SECRET + ")"), SECRET, "PREFERRED").run("MYSQL_FULL");

        assertThat(r.ok()).isFalse();
        assertThat(r.notes()).contains("exit 2").contains("Access denied").doesNotContain(SECRET);
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void retencaoSoApagaChavesDeBackup() {
        MysqlDumpBackupAdapter a = adapter("mysqldump", SECRET, "PREFERRED");
        assertThat(a.delete("restricted/backups/fashionai-20260101T030000Z-0123456789abcdef.sql.gz")).isTrue();
        assertThat(a.delete("backups/fashionai-2026-01-01T03-00-00Z.sql.gz")).isTrue();
        assertThat(a.delete("users/abc/foto.jpg")).isFalse();
        assertThat(a.delete("restricted/backups/../users/abc/foto.jpg")).isFalse();
        assertThat(a.delete(null)).isFalse();
        verify(storage).delete("restricted/backups/fashionai-20260101T030000Z-0123456789abcdef.sql.gz");
        verify(storage).delete("backups/fashionai-2026-01-01T03-00-00Z.sql.gz");
        verify(storage, never()).delete("users/abc/foto.jpg");
    }
}
