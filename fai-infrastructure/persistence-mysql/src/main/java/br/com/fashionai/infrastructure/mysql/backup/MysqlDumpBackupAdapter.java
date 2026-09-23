package br.com.fashionai.infrastructure.mysql.backup;

import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPOutputStream;

/**
 * Backup completo via mysqldump (gzip) guardado no storage de mídia sob backups/. Sem o binário no PATH, registra a
 * falha com instrução — o script scripts/backup/mysql_backup.sh cobre o mesmo fluxo fora da JVM.
 */
@Component
public class MysqlDumpBackupAdapter implements BackupPort {
    private final MediaStoragePort storage;
    private final String host;
    private final String port;
    private final String database;
    private final String user;
    private final String password;

    public MysqlDumpBackupAdapter(MediaStoragePort storage, @Value("${MYSQL_HOST:localhost}") String host, @Value("${MYSQL_PORT:3306}") String port,
                                  @Value("${MYSQL_DATABASE:fashionai}") String database, @Value("${MYSQL_USER:fashionai}") String user,
                                  @Value("${MYSQL_PASSWORD:change-me}") String password) {
        this.storage = storage;
        this.host = host;
        this.port = port;
        this.database = database;
        this.user = user;
        this.password = password;
    }

    @Override
    public Result run(String kind) {
        List<String> cmd = new ArrayList<>(List.of("mysqldump", "--host=" + host, "--port=" + port, "--user=" + user, "--single-transaction",
                "--routines", "--triggers", database));
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.environment().put("MYSQL_PWD", password);
            pb.redirectErrorStream(false);
            Process p = pb.start();
            ByteArrayOutputStream gz = new ByteArrayOutputStream();
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            try (InputStream in = p.getInputStream(); GZIPOutputStream out = new GZIPOutputStream(gz)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    sha.update(buf, 0, n);
                }
            }
            String err = new String(p.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!p.waitFor(10, TimeUnit.MINUTES) || p.exitValue() != 0) {
                return new Result(false, null, 0, null, "mysqldump falhou: " + (err.isBlank() ? "exit " + p.exitValue() : err.trim()));
            }
            String key = "backups/" + database + "-" + Instant.now().toString().replace(':', '-') + ".sql.gz";
            MediaStoragePort.StoredObject stored = storage.put(key, gz.toByteArray(), "application/gzip");
            return new Result(true, stored.key(), stored.size(), HexFormat.of().formatHex(sha.digest()), "ok");
        } catch (Exception ex) {
            return new Result(false, null, 0, null, "mysqldump indisponível (" + ex.getMessage() + "). Use scripts/backup/mysql_backup.sh.");
        }
    }
}
