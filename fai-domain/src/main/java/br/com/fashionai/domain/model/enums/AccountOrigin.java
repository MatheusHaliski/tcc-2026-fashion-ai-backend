package br.com.fashionai.domain.model.enums;

/**
 * De onde a conta veio. Só {@link #TEST_SEED} e {@link #DEMO} são "de teste": ficam fora da vitrine para contas reais
 * (coluna gerada {@code users.test_account}) e são as únicas que o reset do ambiente demo apaga.
 */
public enum AccountOrigin {
    /** Cadastro de uma pessoa de verdade. */
    REAL,
    /** Teste automatizado (cadastro com o prefixo {@code e2e_}). */
    TEST_SEED,
    /** Fixture do Demo/Test Data Pipeline ({@code fixture_key} preenchido). */
    DEMO,
    /** Conta técnica do próprio sistema. */
    SYSTEM;

    public boolean isTest() {
        return this == TEST_SEED || this == DEMO;
    }
}
