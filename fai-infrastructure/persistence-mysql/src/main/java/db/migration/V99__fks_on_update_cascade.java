package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Libera a edição de registros referenciados: toda FK do schema passa a {@code ON UPDATE CASCADE} (trocar o id do pai
 * propaga para os filhos) e as que estavam {@code RESTRICT/NO ACTION} no DELETE passam a {@code ON DELETE CASCADE}.
 * {@code SET NULL} é mantido: já não bloqueia a exclusão e trocá-lo por CASCADE apagaria dados que hoje sobrevivem.
 *
 * <p>Lê as FKs do INFORMATION_SCHEMA (inclusive as compostas), então cobre as criadas por qualquer migration.
 * Idempotente (FK já na regra é pulada); uma ALTER por FK (DROP + ADD juntos); nunca desliga FOREIGN_KEY_CHECKS.
 * FK cuja coluna está num CHECK (erro MySQL 3823: ação referencial proibida) fica como está e vai para o log.
 */
public class V99__fks_on_update_cascade extends BaseJavaMigration {
    private static final Logger log = LoggerFactory.getLogger(V99__fks_on_update_cascade.class);
    /** ER_CHECK_CONSTRAINT_CLAUSE_USING_FK_REFER_ACTION_COLUMN: coluna usada num CHECK não aceita CASCADE/SET NULL. */
    static final int CHECK_USES_FK_COLUMN = 3823;

    /** Uma FK do schema: colunas na ordem do índice. */
    public record Fk(String name, String table, List<String> columns, String refTable, List<String> refColumns,
                     String deleteRule, String updateRule) {
    }

    @Override
    public boolean canExecuteInTransaction() {
        return false;   // DDL no MySQL faz commit implícito; cada ALTER é atômica sozinha
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        List<Fk> fks = load(c, c.getCatalog());
        Set<String> names = new HashSet<>();
        fks.forEach(fk -> names.add(fk.name().toLowerCase(Locale.ROOT)));
        int applied = 0;
        List<String> kept = new ArrayList<>();
        for (Fk fk : fks) {
            if (alreadyUnrestricted(fk)) {
                continue;
            }
            String newName = newName(fk, names);
            names.add(newName.toLowerCase(Locale.ROOT));
            try (Statement st = c.createStatement()) {
                st.execute(alterSql(fk, newName));
            } catch (SQLException e) {
                if (!keepsCurrentRule(e)) {
                    throw e;
                }
                kept.add(fk.table() + "." + fk.name());   // a ALTER é atômica: a FK antiga continua valendo
                continue;
            }
            applied++;
        }
        log.info("V99: {} de {} FKs recriadas com ON UPDATE CASCADE; mantidas por CHECK na coluna: {}", applied,
                fks.size(), kept);
    }

    /** Erro em que o MySQL proíbe a ação referencial nesta FK: mantê-la como está em vez de derrubar a migration. */
    public static boolean keepsCurrentRule(SQLException e) {
        return e.getErrorCode() == CHECK_USES_FK_COLUMN;
    }

    public static boolean alreadyUnrestricted(Fk fk) {
        return "CASCADE".equals(norm(fk.updateRule())) && targetDeleteRule(fk.deleteRule()).equals(norm(fk.deleteRule()));
    }

    /** SET NULL e CASCADE ficam; RESTRICT/NO ACTION (o que bloqueia) vira CASCADE. */
    public static String targetDeleteRule(String current) {
        String r = norm(current);
        return "SET NULL".equals(r) || "CASCADE".equals(r) ? r : "CASCADE";
    }

    public static String alterSql(Fk fk, String newName) {
        return "ALTER TABLE " + q(fk.table()) + " DROP FOREIGN KEY " + q(fk.name()) + ", ADD CONSTRAINT " + q(newName)
                + " FOREIGN KEY (" + cols(fk.columns()) + ") REFERENCES " + q(fk.refTable()) + " ("
                + cols(fk.refColumns()) + ") ON DELETE " + targetDeleteRule(fk.deleteRule()) + " ON UPDATE CASCADE";
    }

    /** fkc_ + nome antigo sem prefixo; nome diferente do antigo (o MySQL não aceita DROP e ADD do mesmo nome juntos). */
    public static String newName(Fk fk, Set<String> taken) {
        String base = "fkc_" + fk.name().replaceFirst("^(fkc_|fkp_|fk_)", "");
        String n = base.length() <= 64 ? base : base.substring(0, 55) + "_" + sha(base).substring(0, 8);
        if (taken.contains(n.toLowerCase(Locale.ROOT))) {
            n = "fkc_" + sha(fk.table() + "." + fk.name()).substring(0, 16);
        }
        return n;
    }

    static List<Fk> load(Connection c, String schema) throws SQLException {
        String sql = "SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, "
                + "k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k "
                + "JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA "
                + "AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME "
                + "WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL "
                + "ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION";
        Map<String, Fk> byName = new LinkedHashMap<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, schema);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Fk fk = byName.computeIfAbsent(rs.getString(2) + "." + rs.getString(1), k -> {
                        try {
                            return new Fk(rs.getString(1), rs.getString(2), new ArrayList<>(), rs.getString(4),
                                    new ArrayList<>(), rs.getString(6), rs.getString(7));
                        } catch (SQLException e) {
                            throw new IllegalStateException(e);
                        }
                    });
                    fk.columns().add(rs.getString(3));
                    fk.refColumns().add(rs.getString(5));
                }
            }
        }
        return new ArrayList<>(byName.values());
    }

    private static String norm(String rule) {
        String r = rule == null ? "" : rule.trim().toUpperCase(Locale.ROOT);
        return "NO ACTION".equals(r) ? "RESTRICT" : r;   // no InnoDB, NO ACTION = RESTRICT
    }

    private static String cols(List<String> columns) {
        return String.join(", ", columns.stream().map(V99__fks_on_update_cascade::q).toList());
    }

    private static String q(String ident) {
        return "`" + ident.replace("`", "``") + "`";
    }

    private static String sha(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
