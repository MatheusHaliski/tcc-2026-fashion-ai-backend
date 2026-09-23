package br.com.fashionai.application.audit;

/** Ações auditadas (RNF5): login, perfil, peças, edição, privacidade, vínculos e IA. */
public final class AuditActions {
    public static final String LOGIN_SUCESSO = "LOGIN_SUCESSO";
    public static final String LOGIN_FALHO = "LOGIN_FALHO";
    public static final String LOGIN_BLOQUEADO_TENTATIVAS = "LOGIN_BLOQUEADO_TENTATIVAS";
    public static final String LOGOUT = "LOGOUT";
    public static final String SESSAO_REVOGADA = "SESSAO_REVOGADA";
    public static final String REFRESH_REUTILIZADO = "REFRESH_REUTILIZADO";
    public static final String CADASTRO_CONTA = "CADASTRO_CONTA";
    public static final String EMAIL_CONFIRMADO = "EMAIL_CONFIRMADO";
    public static final String RECUPERACAO_SENHA = "RECUPERACAO_SENHA";
    public static final String ACESSO_NEGADO_403 = "ACESSO_NEGADO_403";
    public static final String ALTERACAO_DADO_PESSOAL_SENSIVEL = "ALTERACAO_DADO_PESSOAL_SENSIVEL";
    public static final String ALTERACAO_PERFIL = "ALTERACAO_PERFIL";
    public static final String ALTERACAO_PREFERENCIAS = "ALTERACAO_PREFERENCIAS";
    public static final String TROCA_SENHA = "TROCA_SENHA";
    public static final String CONSENTIMENTO_CONCEDIDO = "CONSENTIMENTO_CONCEDIDO";
    public static final String CONSENTIMENTO_REVOGADO = "CONSENTIMENTO_REVOGADO";
    public static final String EXPORTACAO_CONTA = "EXPORTACAO_CONTA";
    public static final String EXCLUSAO_CONTA = "EXCLUSAO_CONTA";
    public static final String EXCLUSAO_CANCELADA = "EXCLUSAO_CANCELADA";
    public static final String CADASTRO_PECA = "CADASTRO_PECA";
    public static final String EDICAO_PECA = "EDICAO_PECA";
    public static final String EXCLUSAO_PECA = "EXCLUSAO_PECA";
    public static final String CRIACAO_ESQUEMA = "CRIACAO_ESQUEMA";
    public static final String EDICAO_ESQUEMA = "EDICAO_ESQUEMA";
    public static final String PUBLICACAO_ESQUEMA = "PUBLICACAO_ESQUEMA";
    public static final String EXCLUSAO_FOTO = "EXCLUSAO_FOTO";
    public static final String MUDANCA_ESTADO_VINCULO_SELO = "MUDANCA_ESTADO_VINCULO_SELO";
    public static final String SELO_EDITADO = "SELO_EDITADO";
    public static final String PROMOCAO_RESGATADA = "PROMOCAO_RESGATADA";
    public static final String APROVACAO_PERFIL = "APROVACAO_PERFIL";
    public static final String MODERACAO_DECISAO = "MODERACAO_DECISAO";
    public static final String BACKUP = "BACKUP";
    public static final String CHAMADA_IA = "CHAMADA_IA";

    private AuditActions() {
    }
}
