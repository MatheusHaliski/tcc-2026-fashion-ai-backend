package br.com.fashionai.application.ports;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** RF23 — cotações de câmbio de referência (BCE via Frankfurter, sem chave) para mostrar preços na moeda do usuário. */
public interface ExchangeRatePort {
    Optional<Quote> latest(String base, Set<String> symbols);

    /** {@code rates}: quanto vale 1 {@code base} em cada moeda; {@code date}: dia da cotação publicada. */
    record Quote(String base, LocalDate date, Map<String, BigDecimal> rates) {
    }
}
