package br.com.fashionai.infrastructure.platform.fx;

import br.com.fashionai.application.ports.ExchangeRatePort;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Câmbio de referência do Banco Central Europeu pela Frankfurter (gratuita, sem chave, atualizada nos dias úteis).
 * Qualquer falha vira Optional.empty(): o serviço de câmbio cai na última cotação boa ou na taxa de reserva.
 */
@Component
@ConditionalOnProperty(name = "fashionai.fx.enabled", havingValue = "true", matchIfMissing = true)
public class FrankfurterExchangeRateAdapter implements ExchangeRatePort {
    private static final Logger log = LoggerFactory.getLogger(FrankfurterExchangeRateAdapter.class);
    private final RestClient client;

    public FrankfurterExchangeRateAdapter(@Value("${fashionai.fx.base-url:https://api.frankfurter.dev}") String baseUrl) {
        this.client = Http.client(baseUrl, 8);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<Quote> latest(String base, Set<String> symbols) {
        try {
            Map<String, Object> body = client.get()
                    .uri(u -> u.path("/v1/latest").queryParam("base", base).queryParam("symbols", String.join(",", symbols)).build())
                    .retrieve().body(Map.class);
            Map<String, Object> raw = body == null ? null : (Map<String, Object>) body.get("rates");
            if (raw == null || raw.isEmpty()) {
                return Optional.empty();
            }
            Map<String, BigDecimal> rates = new LinkedHashMap<>();
            raw.forEach((code, v) -> {
                if (v instanceof Number n) rates.put(code, new BigDecimal(n.toString()));
            });
            LocalDate date = body.get("date") == null ? LocalDate.now() : LocalDate.parse(String.valueOf(body.get("date")));
            return Optional.of(new Quote(base, date, rates));
        } catch (RuntimeException e) {
            log.warn("Câmbio (Frankfurter) indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
