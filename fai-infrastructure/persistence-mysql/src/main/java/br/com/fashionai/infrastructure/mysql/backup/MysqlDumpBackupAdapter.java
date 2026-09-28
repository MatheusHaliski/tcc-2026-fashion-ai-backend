package br.com.fashionai.infrastructure.mysql.backup;

import br.com.fashionai.application.ports.BackupPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

/**
 * Backup completo via mysqldump (gzip) guardado no storage de mídia sob {@code restricted/backups/} — prefixo que só o
 * ADMIN lê (nunca sob um prefixo público de /media) — com sufixo aleatório no nome, para a chave não ser adivinhável.
 * <p>
 * A senha vai só pela variável MYSQL_PWD do processo filho (nunca na linha de comando, visível no ps) e não tem valor
 * padrão: sem MYSQL_PASSWORD/MYSQL_BACKUP_PASSWORD o backup falha com o motivo. O cliente precisa ser o da Oracle
 * (Dockerfile.backend instala o {@code mysql-client} do Ubuntu), que entende {@code --ssl-mode}; o modo TLS é o mesmo
 * da conexão JDBC (MYSQL_SSL_MODE). Toda falha volta como {@code ok=false} com o motivo em {@code notes}; quem chama
 * (AdminService) registra FAILED e loga ERROR. O script scripts/backup/mysql_backup.sh cobre o mesmo fluxo fora da JVM.
 */
@Component
public class MysqlDumpBackupAdapter implements BackupPort {
    private static final Logger log = LoggerFactory.getLogger(MysqlDumpBackupAdapter.class);
    /** Único prefixo em que o backup grava (e o único em que a retenção apaga). */
    static final String PREFIX = "restricted/backups/";
    /** Prefixo antigo (público em /media): a retenção ainda apaga o que tiver sobrado lá. */
    static final String LEGACY_PREFIX = "backups/";
    static final Set<String> SSL_MODES = Set.of("DISABLED", "PREFERRED", "REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY");
    private static final Pattern SAFE_ARG = Pattern.compile("[A-Za-z0-9_.$:%\\[\\]\\-]+");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final int STDERR_MAX = 4096;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MediaStoragePort storage;
    private final String command;
    private final String host;
    private final String port;
    private final String database;
    private final String user;
    private final String password;
    private final String sslMode;
    private final long timeoutMinutes;

    public MysqlDumpBackupAdapter(MediaStoragePort storage,
                                  @Value("${fashionai.backup.mysqldump-command:mysqldump}") String command,
                                  @Value("${MYSQL_HOST:localhost}") String host,
                                  @Value("${MYSQL_PORT:3306}") String port,
                                  @Value("${MYSQL_DATABASE:fashionai}") String database,
                                  @Value("${fashionai.backup.user:${MYSQL_USER:fashionai}}") String user,
                                  @Value("${fashionai.backup.password:${MYSQL_PASSWORD:}}") String password,
                                  @Value("${fashionai.backup.ssl-mode:${MYSQL_SSL_MODE:PREFERRED}}") String sslMode,
                                  @Value("${fashionai.backup.timeout-minutes:10}") long timeoutMinutes) {
        this.storage = storage;
        this.command = blankTo(command, "mysqldump");
        this.host = blankTo(host, "localhost");
        this.port = blankTo(port, "3306");
        this.database = blankTo(database, "fashionai");
        this.user = blankTo(user, "fashionai");
        this.password = password == null ? "" : password;
        this.sslMode = normalizeSslMode(sslMode);
        this.timeoutMinutes = Math.max(1, timeoutMinutes);
    }

    @Override
    public Result run(String kind) {
        if (password.isBlank()) {
            return fail("senha do MySQL ausente: defina MYSQL_PASSWORD (ou MYSQL_BACKUP_PASSWORD) no ambiente da API");
        }
        for (String arg : List.of(host, port, database, user)) {
            if (!SAFE_ARG.matcher(arg).matches()) {
                return fail("configuração inválida do MySQL (host, porta, banco ou usuário com caracteres não permitidos)");
            }
        }
        Process p;
        try {
            ProcessBuilder pb = new ProcessBuilder(command());
            pb.environment().put("MYSQL_PWD", password);
            p = pb.start();
        } catch (IOException ex) {
            return fail("mysqldump indisponível (" + ex.getMessage() + "): instale o cliente MySQL na imagem (Dockerfile.backend) "
                    + "ou use scripts/backup/mysql_backup.sh");
        }
        // stdout e stderr lidos em paralelo: um stderr cheio não trava o mysqldump, e o timeout vale de verdade
        try (ExecutorService pumps = Executors.newVirtualThreadPerTaskExecutor()) {
            p.getOutputStream().close();
            Future<Dump> out = pumps.submit(() -> gzip(p.getInputStream()));
            Future<String> err = pumps.submit(() -> head(p.getErrorStream()));
            if (!p.waitFor(timeoutMinutes, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                return fail("mysqldump excedeu " + timeoutMinutes + " min e foi interrompido");
            }
            Dump dump = out.get(1, TimeUnit.MINUTES);
            String stderr = err.get(1, TimeUnit.MINUTES);
            if (p.exitValue() != 0) {
                return fail("mysqldump falhou (exit " + p.exitValue() + ")" + (stderr.isBlank() ? "" : ": " + scrub(stderr)));
            }
            if (dump.rawBytes() == 0) {
                return fail("mysqldump não gerou saída");
            }
            String key = newKey();
            MediaStoragePort.StoredObject stored = storage.put(key, dump.gzip(), "application/gzip");
            String sha = sha256(dump.gzip());
            log.info("Backup MySQL gravado em {} ({} bytes gzip, sha256 {})", stored.key(), stored.size(), sha);
            return new Result(true, stored.key(), stored.size(), sha, "ok: " + dump.rawBytes() + " bytes de SQL; sha256 do .sql.gz");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            return fail("backup interrompido");
        } catch (Exception ex) {
            p.destroyForcibly();
            return fail("backup falhou: " + scrub(String.valueOf(ex.getMessage())));
        }
    }

    /** Só apaga backups (retenção): qualquer chave fora dos prefixos de backup é recusada. */
    @Override
    public boolean delete(String fileKey) {
        if (fileKey == null || fileKey.contains("..") || !(fileKey.startsWith(PREFIX) || fileKey.startsWith(LEGACY_PREFIX))) {
            log.warn("Retenção de backup: chave fora de {} recusada: {}", PREFIX, fileKey);
            return false;
        }
        storage.delete(fileKey);
        return true;
    }

    /** Linha de comando sem a senha (ela vai só em MYSQL_PWD). */
    List<String> command() {
        List<String> cmd = new ArrayList<>(List.of(command, "--host=" + host, "--port=" + port, "--user=" + user, "--protocol=TCP"));
        if (sslMode != null) {
            cmd.add("--ssl-mode=" + sslMode);
        }
        cmd.addAll(List.of("--single-transaction", "--routines", "--triggers", "--set-gtid-purged=OFF", "--no-tablespaces",
                "--default-character-set=utf8mb4", database));
        return cmd;
    }

    /** restricted/backups/&lt;banco&gt;-&lt;UTC&gt;-&lt;16 hex aleatórios&gt;.sql.gz */
    String newKey() {
        byte[] rnd = new byte[8];
        RANDOM.nextBytes(rnd);
        return PREFIX + database + "-" + STAMP.format(Instant.now()) + "-" + HexFormat.of().formatHex(rnd) + ".sql.gz";
    }

    static String normalizeSslMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return null;
        }
        String m = mode.trim().toUpperCase(Locale.ROOT);
        if (!SSL_MODES.contains(m)) {
            log.warn("MYSQL_SSL_MODE={} não reconhecido pelo mysqldump; usando o padrão do cliente (PREFERRED)", mode);
            return null;
        }
        return m;
    }

    private String scrub(String text) {
        String t = text == null ? "" : text.trim();
        if (password.length() >= 4) {
            t = t.replace(password, "***");
        }
        return t;
    }

    private static Result fail(String reason) {
        return new Result(false, null, 0, null, reason);
    }

    private static Dump gzip(InputStream in) {
        ByteArrayOutputStream gz = new ByteArrayOutputStream();
        long raw = 0;
        try (in; GZIPOutputStream out = new GZIPOutputStream(gz)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                raw += n;
            }
        } catch (IOException ex) {
            throw new IllegalStateException("leitura do mysqldump falhou: " + ex.getMessage(), ex);
        }
        return new Dump(gz.toByteArray(), raw);
    }

    private static String head(InputStream in) {
        try (in) {
            byte[] all = in.readAllBytes();
            String s = new String(all, 0, Math.min(all.length, STDERR_MAX), StandardCharsets.UTF_8);
            return s.trim();
        } catch (IOException ex) {
            return "";
        }
    }

    private static String sha256(byte[] data) throws NoSuchAlgorithmException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    }

    private static String blankTo(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v.trim();
    }

    private record Dump(byte[] gzip, long rawBytes) {
    }
}
