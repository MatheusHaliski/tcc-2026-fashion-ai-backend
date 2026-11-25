package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A partir da V110, toda migração convive com objetos que podem ter sido criados à mão no banco do Railway (os
 * exercícios de banco de dados entregam o SQL antes do deploy: docs/banco-de-dados/MIGRACOES_DOS_EXERCICIOS.md).
 * Um passo que não confere antes de criar derruba o deploy ("Table already exists", "Duplicate foreign key") e deixa
 * a versão marcada como falha no histórico do Flyway. Por isso cada comando precisa ser um destes:
 * CREATE TABLE IF NOT EXISTS; ALTER dentro de SET @ddl = IF((SELECT COUNT(*) FROM information_schema...) ...);
 * INSERT com ON DUPLICATE KEY UPDATE ou WHERE NOT EXISTS; UPDATE/DELETE com WHERE.
 */
class MigrationIdempotencyTest {
    private static final int PRIMEIRA_VERSAO_IDEMPOTENTE = 110;
    private static final Pattern NOME = Pattern.compile("^V(\\d+)__.+\\.sql$");
    private static final Pattern CREATE_SEM_GUARDA = Pattern.compile("CREATE\\s+TABLE\\s+(?!IF\\s+NOT\\s+EXISTS)");
    private static final Pattern DDL_GUARDADO = Pattern.compile(
            "^SET\\s+@\\w+\\s*=\\s*IF\\s*\\(\\s*\\(\\s*SELECT\\s+COUNT\\s*\\(\\s*\\*\\s*\\)\\s+FROM\\s+INFORMATION_SCHEMA\\.");

    @Test
    void migracoesDesdeAV110ConferemAntesDeCriar() throws Exception {
        List<String> verificadas = new ArrayList<>();
        List<String> problemas = new ArrayList<>();
        for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath*:db/migration/V*__*.sql")) {
            Matcher m = r.getFilename() == null ? null : NOME.matcher(r.getFilename());
            if (m == null || !m.matches() || Integer.parseInt(m.group(1)) < PRIMEIRA_VERSAO_IDEMPOTENTE) {
                continue;
            }
            verificadas.add(r.getFilename());
            String sql = new String(r.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            for (String comando : comandos(sql)) {
                String problema = problema(comando);
                if (problema != null) {
                    problemas.add(r.getFilename() + ": " + problema + " -> " + resumo(comando));
                }
            }
        }
        assertThat(verificadas).as("migrações a partir da V%d", PRIMEIRA_VERSAO_IDEMPOTENTE)
                .contains("V110__nivel_termico.sql", "V111__estacoes_exercicio_06.sql", "V112__tipos_iluminacao_acervo.sql");
        assertThat(problemas).as("comandos que não conferem antes de criar (ver o javadoc desta classe)").isEmpty();
    }

    @Test
    void reconheceComandosQueQuebrariamOReDeploy() {
        assertThat(problema("CREATE TABLE estacoes (codigo VARCHAR(10) PRIMARY KEY)")).isNotNull();
        assertThat(problema("ALTER TABLE schemes ADD CONSTRAINT fk FOREIGN KEY (season) REFERENCES estacoes (codigo)")).isNotNull();
        assertThat(problema("SET @ddl = 'ALTER TABLE schemes ADD COLUMN x INT'")).isNotNull();
        assertThat(problema("INSERT INTO estacoes (codigo) VALUES ('SPRING')")).isNotNull();
        assertThat(problema("CREATE INDEX ix ON schemes (season)")).isNotNull();
        assertThat(problema("UPDATE schemes SET season = NULL")).isNotNull();
        assertThat(problema("CREATE TABLE IF NOT EXISTS estacoes (codigo VARCHAR(10) PRIMARY KEY)")).isNull();
        assertThat(problema("SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME = 'a') = 0, "
                + "'ALTER TABLE a ADD COLUMN b INT', 'SELECT 1')")).isNull();
        assertThat(problema("INSERT INTO estacoes (codigo) VALUES ('SPRING') ON DUPLICATE KEY UPDATE codigo = codigo")).isNull();
        assertThat(problema("INSERT INTO t (c) SELECT o.c FROM o WHERE NOT EXISTS (SELECT 1 FROM t WHERE t.c = o.c)")).isNull();
        assertThat(comandos("-- a; b\nSELECT 'x;y'; /* c; */ SELECT 2;")).containsExactly("SELECT 'x;y'", "SELECT 2");
    }

    /** Motivo pelo qual o comando não é idempotente, ou null quando ele confere antes de criar. */
    static String problema(String comando) {
        String c = comando.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        if (CREATE_SEM_GUARDA.matcher(c).find()) {
            return "CREATE TABLE sem IF NOT EXISTS";
        }
        if (c.startsWith("ALTER ") || c.startsWith("CREATE INDEX") || c.startsWith("CREATE UNIQUE INDEX") || c.startsWith("DROP ")) {
            return "DDL fora de SET @ddl = IF((SELECT COUNT(*) FROM information_schema...) ...)";
        }
        if (c.startsWith("SET @") && c.contains("'ALTER ") && !DDL_GUARDADO.matcher(c).find()) {
            return "ALTER preparado sem conferir o information_schema antes";
        }
        if (c.startsWith("INSERT ") && !c.contains("ON DUPLICATE KEY UPDATE") && !c.contains("WHERE NOT EXISTS")) {
            return "INSERT sem ON DUPLICATE KEY UPDATE nem WHERE NOT EXISTS";
        }
        if ((c.startsWith("UPDATE ") || c.startsWith("DELETE ")) && !c.contains(" WHERE ")) {
            return "UPDATE/DELETE sem WHERE";
        }
        return null;
    }

    /** Separa o script em comandos por ';', ignorando o que está dentro de aspas e de comentários. */
    static List<String> comandos(String sql) {
        List<String> saida = new ArrayList<>();
        StringBuilder atual = new StringBuilder();
        char aspas = 0;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            char prox = i + 1 < sql.length() ? sql.charAt(i + 1) : 0;
            if (aspas != 0) {
                atual.append(ch);
                if (ch == aspas) {
                    aspas = 0;
                }
            } else if (ch == '-' && prox == '-' || ch == '#') {
                i = fimDaLinha(sql, i);
            } else if (ch == '/' && prox == '*') {
                int fim = sql.indexOf("*/", i + 2);
                i = fim < 0 ? sql.length() : fim + 1;
            } else if (ch == ';') {
                adicionar(saida, atual);
            } else {
                if (ch == '\'' || ch == '"' || ch == '`') {
                    aspas = ch;
                }
                atual.append(ch);
            }
        }
        adicionar(saida, atual);
        return saida;
    }

    private static int fimDaLinha(String sql, int i) {
        int fim = sql.indexOf('\n', i);
        return fim < 0 ? sql.length() : fim;
    }

    private static void adicionar(List<String> saida, StringBuilder atual) {
        String comando = atual.toString().trim();
        if (!comando.isEmpty()) {
            saida.add(comando);
        }
        atual.setLength(0);
    }

    private static String resumo(String comando) {
        String c = comando.replaceAll("\\s+", " ").trim();
        return c.length() > 140 ? c.substring(0, 140) + "…" : c;
    }
}
