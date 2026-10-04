package br.com.fashionai.application.ports;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Operações em SQL do Demo/Test Data Pipeline (plano e reset por cascata, verificação de integridade). Nunca desliga
 * FOREIGN_KEY_CHECKS: o reset apaga as contas de teste e as cascatas da V34 levam os dados de que elas são donas.
 */
public interface DemoDataAdminPort {

    /**
     * Plano de um reset, calculado a partir das FKs reais do banco (INFORMATION_SCHEMA), não de uma lista no código:
     * o dry-run mostra o que o InnoDB vai fazer.
     *
     * @param cascade     linhas apagadas por tabela (users inclusive), via ON DELETE CASCADE
     * @param setNull     linhas que só perdem a referência ("tabela.coluna"), via ON DELETE SET NULL
     * @param polymorphic linhas de outras contas que apontam para conteúdo das contas de teste (reações, comentários,
     *                    salvos, compartilhamentos, notificações) — apagadas antes, pois não têm FK
     * @param blockers    referências RESTRICT/NO ACTION que fariam o DELETE falhar (o reset aborta antes)
     */
    record ResetCounts(Map<String, Long> cascade, Map<String, Long> setNull, Map<String, Long> polymorphic,
                       List<String> blockers) {
    }

    /** Contas de teste: account_origin IN ('TEST_SEED', 'DEMO'), em ordem de id. */
    List<UUID> testAccountIds();

    /** Quantas das contas informadas NÃO são de teste (precisa ser 0 para o reset seguir). */
    long realAccountsAmong(List<UUID> ids);

    ResetCounts plan(List<UUID> ids);

    /** Trava as linhas das contas (SELECT ... FOR UPDATE) dentro da transação do reset. */
    void lockAccounts(List<UUID> ids);

    /** Ids das peças e dos looks das contas (para limpar busca depois do commit). */
    List<UUID> pieceIdsOf(List<UUID> ids);

    List<UUID> schemeIdsOf(List<UUID> ids);

    /** Chaves de mídia no storage que pertencem às contas (fotos enviadas). */
    List<String> storageKeysOf(List<UUID> ids);

    /** Interações das contas de teste num conteúdo de conta REAL: quanto descontar dos contadores dele. */
    record CounterDelta(String targetType, UUID targetId, long likes, long comments, long saves, long shares) {
    }

    /**
     * Curtidas, comentários ativos, salvos e compartilhamentos das contas de teste em conteúdo de contas reais. O
     * reset desconta exatamente isso (nunca recalcula do zero: contador legado de conta real não é reescrito).
     */
    List<CounterDelta> interactionsOnRealContent(List<UUID> ids);

    /** like/comment/save/share = GREATEST(0, atual − delta); devolve quantas linhas mudaram. */
    int subtractCounters(List<CounterDelta> deltas);

    /** Apaga as linhas polimórficas que apontam para conteúdo das contas (reações, comentários, salvos...). */
    Map<String, Long> deletePolymorphicTargeting(List<UUID> ids);

    /** DELETE FROM users WHERE id IN (...) AND account_origin IN ('TEST_SEED','DEMO'); devolve as contas apagadas. */
    long deleteTestAccounts(List<UUID> ids);

    /** Marcas DEMO do catálogo e quantas referências cada uma tem (peças, produtos de catálogo). */
    List<Map<String, Object>> demoCatalogBrands();

    /** Apaga as marcas DEMO sem nenhuma referência; as referenciadas ficam (RESTRICT), nunca há DELETE forçado. */
    long deleteUnreferencedDemoBrands();

    /** Contagens globais para o relatório [KEEP] (contas reais, marcas, catálogo). */
    Map<String, Long> globalCounts();

    /** Verificação: problemas encontrados (vazio = ok). */
    List<String> integrityProblems(List<String> expectedFixtureKeys);
}
