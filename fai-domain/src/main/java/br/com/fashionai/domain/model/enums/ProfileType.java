package br.com.fashionai.domain.model.enums;

public enum ProfileType {
    PESSOAL,
    MARCA,
    CELEBRIDADE,
    /** Conta de administração: criada pela inicialização (FAI_ADMIN_EMAIL), nunca pelo cadastro público. */
    ADMIN
}
