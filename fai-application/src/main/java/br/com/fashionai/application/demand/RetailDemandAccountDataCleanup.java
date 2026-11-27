package br.com.fashionai.application.demand;

import br.com.fashionai.application.privacy.AccountDataCleanup;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Na exclusão da conta, as contribuições de demanda (HMAC do usuário) são apagadas. */
@Component
public class RetailDemandAccountDataCleanup implements AccountDataCleanup {
    private final RetailDemandService demand;

    public RetailDemandAccountDataCleanup(RetailDemandService demand) {
        this.demand = demand;
    }

    @Override
    @Transactional
    public void purge(UUID userId) {
        demand.purgeContributions(userId);
    }
}
