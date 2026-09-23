package br.com.fashionai.application.audit;

public final class AuditActions {
    public static final String LOGIN_SUCESSO = "LOGIN_SUCESSO";
    public static final String LOGIN_FALHO = "LOGIN_FALHO";
    public static final String LOGIN_BLOQUEADO_TENTATIVAS = "LOGIN_BLOQUEADO_TENTATIVAS";
    public static final String ACESSO_NEGADO_403 = "ACESSO_NEGADO_403";
    public static final String ALTERACAO_DADO_PESSOAL_SENSIVEL = "ALTERACAO_DADO_PESSOAL_SENSIVEL";
    public static final String TROCA_SENHA = "TROCA_SENHA";
    public static final String CONSENTIMENTO_CONCEDIDO = "CONSENTIMENTO_CONCEDIDO";
    public static final String CONSENTIMENTO_REVOGADO = "CONSENTIMENTO_REVOGADO";
    public static final String EXPORTACAO_CONTA = "EXPORTACAO_CONTA";
    public static final String EXCLUSAO_CONTA = "EXCLUSAO_CONTA";
    public static final String MUDANCA_ESTADO_VINCULO_SELO = "MUDANCA_ESTADO_VINCULO_SELO";
    public static final String CHAMADA_IA = "CHAMADA_IA";

    private AuditActions() {
    }
}
