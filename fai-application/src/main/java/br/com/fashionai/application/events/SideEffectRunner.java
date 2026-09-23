package br.com.fashionai.application.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Executa efeitos colaterais de eventos de domínio (pontos, conquistas, desafios, diário de uso, endereço no quarto)
 * em transação própria (REQUIRES_NEW). Usado pelos listeners {@code @TransactionalEventListener(AFTER_COMMIT)}: a
 * ação principal já foi confirmada, e uma falha aqui só é registrada — nunca vira 500 nem desfaz a ação do usuário.
 * Antes, os listeners rodavam dentro da transação de quem publicou o evento: um erro engolido marcava a transação
 * como rollback-only e o comentário/curtida/look falhava inteiro ("Transaction silently rolled back").
 */
@Component
public class SideEffectRunner {
    private static final Logger log = LoggerFactory.getLogger(SideEffectRunner.class);

    private final TransactionTemplate tx;

    public SideEffectRunner(PlatformTransactionManager transactionManager) {
        this.tx = new TransactionTemplate(transactionManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void run(String what, Runnable effect) {
        try {
            tx.executeWithoutResult(status -> effect.run());
        } catch (RuntimeException ex) {
            log.warn("efeito colateral {} falhou (a ação principal já foi confirmada): {}", what, ex.getMessage());
        }
    }
}
