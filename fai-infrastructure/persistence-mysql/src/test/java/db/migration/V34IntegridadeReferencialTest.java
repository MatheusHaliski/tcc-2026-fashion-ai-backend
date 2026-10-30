package db.migration;

import db.migration.V34__integridade_referencial_por_dominio.Fk;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** V34: cada FK da política é mantida, recriada ou adiada conforme o estado real do banco. */
class V34IntegridadeReferencialTest {

    /** Banco falso: FKs atuais, colunas (tipo, collation, nullable) e órfãos por tabela filha. */
    private final Map<String, List<String[]>> fks = new HashMap<>();
    private final Map<String, String[]> columns = new HashMap<>();
    private final Map<String, Long> orphans = new HashMap<>();
    private final List<String> executed = new ArrayList<>();

    private static ResultSet rows(List<String[]> rows, long count) throws Exception {
        ResultSet rs = mock(ResultSet.class);
        Iterator<String[]> it = rows.iterator();
        String[][] current = new String[1][];
        when(rs.next()).thenAnswer(inv -> {
            if (!it.hasNext()) return false;
            current[0] = it.next();
            return true;
        });
        when(rs.getString(anyInt())).thenAnswer(inv -> current[0][(int) inv.getArgument(0) - 1]);
        when(rs.getLong(1)).thenReturn(count);
        return rs;
    }

    private Connection connection() throws Exception {
        Connection c = mock(Connection.class);
        when(c.getCatalog()).thenReturn("fashionai");
        when(c.prepareStatement(anyString())).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            PreparedStatement ps = mock(PreparedStatement.class);
            String[] params = new String[5];
            doAnswer(a -> {
                params[(int) a.getArgument(0)] = a.getArgument(1);
                return null;
            }).when(ps).setString(anyInt(), anyString());
            when(ps.executeQuery()).thenAnswer(q -> {
                if (sql.contains("KEY_COLUMN_USAGE")) {
                    return rows(fks.getOrDefault(params[2] + "." + params[3] + ">" + params[4], List.of()), 0);
                }
                String[] col = columns.getOrDefault(params[2] + "." + params[3], new String[]{"char(36)", "utf8mb4_bin", "YES"});
                return rows(col == null ? List.of() : List.<String[]>of(col), 0);
            });
            return ps;
        });
        when(c.createStatement()).thenAnswer(inv -> {
            Statement st = mock(Statement.class);
            when(st.executeQuery(anyString())).thenAnswer(q -> {
                String sql = q.getArgument(0);
                String table = sql.substring(sql.indexOf("FROM `") + 6, sql.indexOf("` c"));
                return rows(List.of(), orphans.getOrDefault(table, 0L));
            });
            when(st.execute(anyString())).thenAnswer(q -> executed.add(q.getArgument(0)));
            return st;
        });
        return c;
    }

    private void migrate() throws Exception {
        Context context = mock(Context.class);
        Connection c = connection();
        when(context.getConnection()).thenReturn(c);
        new V34__integridade_referencial_por_dominio().migrate(context);
    }

    private static String key(Fk fk) {
        return fk.table() + "." + fk.column() + ">" + fk.refTable();
    }

    @Test
    void fkInvalidaNaPoliticaEhRejeitada() {
        assertThatThrownBy(() -> new Fk("users`", "id", "x", "CASCADE"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("identificador inválido");
        assertThatThrownBy(() -> new Fk("users", "id", "x", "SET DEFAULT"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("ON DELETE inválido");
    }

    @Test
    void nomeDaConstraintCurtoOuComHashQuandoPassaDe64() {
        assertThat(new Fk("photos", "user_id", "users", "CASCADE").constraintName()).isEqualTo("fkp_photos__user_id");
        String longo = new Fk("tabela_com_um_nome_bem_comprido_mesmo", "coluna_tambem_bem_comprida_xx", "users", "CASCADE")
                .constraintName();
        assertThat(longo).hasSize(64).startsWith("fkp_tabela_com_um_nome_bem_comprido_mesmo__coluna_tamb").matches(".*_[0-9a-f]{8}");
        assertThat(new Fk("a", "b", "c", "uuid", "RESTRICT")).hasToString("a.b → c.uuid ON DELETE RESTRICT");
        assertThat(new Fk("a", "b", "c", "RESTRICT")).hasToString("a.b → c ON DELETE RESTRICT");
    }

    @Test
    void regraNoActionEquivaleARestrictEIgnoraCaixaENulo() {
        assertThat(V34__integridade_referencial_por_dominio.sameRule("no action", "RESTRICT")).isTrue();
        assertThat(V34__integridade_referencial_por_dominio.sameRule(" cascade ", "CASCADE")).isTrue();
        assertThat(V34__integridade_referencial_por_dominio.sameRule(null, "CASCADE")).isFalse();
        assertThat(V34__integridade_referencial_por_dominio.sameRule(null, null)).isTrue();
    }

    @Test
    void naoRodaEmTransacao() {
        assertThat(new V34__integridade_referencial_por_dominio().canExecuteInTransaction()).isFalse();
    }

    @Test
    void mantemAplicaRecriaEAdiaConformeOBanco() throws Exception {
        List<Fk> policy = V34__integridade_referencial_por_dominio.POLICY;
        Fk ok = policy.get(0);                                    // já na regra certa
        Fk setNull = policy.get(1);                               // SET NULL em coluna NOT NULL
        Fk semColuna = policy.get(2);                             // coluna inexistente
        Fk tipo = policy.get(3);                                  // tipo diferente do pai
        Fk orfaos = policy.get(4);                                // órfãos impedem
        Fk duplicada = policy.get(5);                             // duas constraints antigas
        Fk regraErrada = policy.get(6);                           // uma constraint com outra regra
        assertThat(setNull.onDelete()).isEqualTo("SET NULL");

        fks.put(key(ok), List.<String[]>of(new String[]{"fk_old", ok.onDelete()}));
        columns.put(setNull.table() + "." + setNull.column(), new String[]{"char(36)", "utf8mb4_bin", "NO"});
        fks.put(key(setNull), List.<String[]>of(new String[]{"fk_ai", "CASCADE"}));
        columns.put(semColuna.table() + "." + semColuna.column(), null);
        columns.put(tipo.table() + "." + tipo.column(), new String[]{"varchar(64)", "utf8mb4_bin", "YES"});
        orphans.put(orfaos.table(), 3L);
        fks.put(key(duplicada), List.of(new String[]{"a_ibfk_1", "CASCADE"}, new String[]{"fk_`b`", "RESTRICT"}));
        String outra = regraErrada.onDelete().equals("CASCADE") ? "RESTRICT" : "CASCADE";
        fks.put(key(regraErrada), List.<String[]>of(new String[]{"fk_x", outra}));

        migrate();

        assertThat(executed).hasSize(policy.size() - 5);
        assertThat(executed).noneMatch(s -> s.startsWith("ALTER TABLE `" + ok.table() + "` ") && s.contains("`" + ok.column() + "`"));
        assertThat(executed).noneMatch(s -> s.contains("ADD CONSTRAINT `" + setNull.constraintName() + "`"));
        assertThat(executed).noneMatch(s -> s.contains("ADD CONSTRAINT `" + semColuna.constraintName() + "`"));
        assertThat(executed).noneMatch(s -> s.contains("ADD CONSTRAINT `" + tipo.constraintName() + "`"));
        assertThat(executed).noneMatch(s -> s.contains("ADD CONSTRAINT `" + orfaos.constraintName() + "`"));
        assertThat(executed).contains("ALTER TABLE `" + duplicada.table() + "` DROP FOREIGN KEY `a_ibfk_1`, DROP FOREIGN KEY `fk_b`, "
                + "ADD CONSTRAINT `" + duplicada.constraintName() + "` FOREIGN KEY (`" + duplicada.column() + "`) REFERENCES `"
                + duplicada.refTable() + "` (`" + duplicada.refColumn() + "`) ON DELETE " + duplicada.onDelete() + " ON UPDATE RESTRICT");
        assertThat(executed).anyMatch(s -> s.startsWith("ALTER TABLE `" + regraErrada.table() + "` DROP FOREIGN KEY `fk_x`, ADD CONSTRAINT `"
                + regraErrada.constraintName() + "`"));
    }

    @Test
    void bancoJaNaPoliticaNaoAlteraNada() throws Exception {
        for (Fk fk : V34__integridade_referencial_por_dominio.POLICY) {
            fks.put(key(fk), List.<String[]>of(new String[]{"fk", fk.onDelete().equals("RESTRICT") ? "NO ACTION" : fk.onDelete()}));
        }
        migrate();
        assertThat(executed).isEmpty();
    }
}
