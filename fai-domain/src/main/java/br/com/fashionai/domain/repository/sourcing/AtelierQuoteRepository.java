package br.com.fashionai.domain.repository.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierQuote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AtelierQuoteRepository extends JpaRepository<AtelierQuote, UUID> {
    List<AtelierQuote> findByQuoteRequestIdOrderByCreatedAtDesc(UUID quoteRequestId);

    Optional<AtelierQuote> findByQuoteRequestIdAndSupplierIdAndCommandKey(UUID quoteRequestId, UUID supplierId, String commandKey);
}
