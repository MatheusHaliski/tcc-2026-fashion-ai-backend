package br.com.fashionai.infrastructure.mysql;

import br.com.fashionai.application.security.RequestActor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;

import static org.assertj.core.api.Assertions.assertThat;

/** Auditoria JPA: o autor é o ator da requisição atual, ou "system" fora de uma requisição. */
class MysqlPersistenceConfigTest {
    private final AuditorAware<String> auditor = new MysqlPersistenceConfig().fashionAuditorAware();

    @AfterEach
    void limpa() {
        RequestActor.clear();
    }

    @Test
    void autorEhOAtorDaRequisicao() {
        RequestActor.set("ana");
        assertThat(auditor.getCurrentAuditor()).contains("ana");
    }

    @Test
    void foraDeRequisicaoEhSystem() {
        RequestActor.clear();
        assertThat(auditor.getCurrentAuditor()).contains("system");
    }
}
