package br.com.fashionai.application.service;

import br.com.fashionai.application.ports.ExchangeRatePort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RF23.CA13 — valores monetários internacionalizados: os preços ficam gravados na moeda de origem (price_currency,
 * BRL por padrão) e a interface mostra o equivalente na moeda do usuário (BRL, USD ou EUR) com a cotação de referência
 * do BCE. Cache de 6 h; se a fonte cair, vale a última cotação boa e, sem nenhuma, a taxa de reserva — o preço nunca
 * some da tela por causa do câmbio. A conversão é só informativa: nada é cobrado em outra moeda.
 */
@Service
public class ExchangeRateService {
    public static final String BASE = "BRL";
    public static final List<String> SUPPORTED = List.of("BRL", "USD", "EUR");
    static final Duration TTL = Duration.ofHours(6);
    static final Duration RETRY = Duration.ofMinutes(10);
    /** Reserva (BCE de 19/10/2026) para quando a fonte nunca respondeu; a resposta sai marcada como FALLBACK. */
    static final Map<String, BigDecimal> FALLBACK = Map.of("BRL", BigDecimal.ONE, "USD", new BigDecimal("0.1982"), "EUR", new BigDecimal("0.1766"));

    public record Rates(String base, LocalDate date, String source, Map<String, BigDecimal> rates, Instant fetchedAt) {
    }

    private final ObjectProvider<ExchangeRatePort> port;
    private final Clock clock;
    private volatile Rates cached;
    private volatile Instant lastAttempt;

    @Autowired
    public ExchangeRateService(ObjectProvider<ExchangeRatePort> port) {
        this(port, Clock.systemUTC());
    }

    ExchangeRateService(ObjectProvider<ExchangeRatePort> port, Clock clock) {
        this.port = port;
        this.clock = clock;
    }

    public static boolean supported(String currency) {
        return currency != null && SUPPORTED.contains(currency.toUpperCase(Locale.ROOT));
    }

    /** Cotações com base BRL (1 BRL = x moeda), da fonte se o cache venceu, senão do cache. */
    public Rates rates() {
        Rates c = cached;
        Instant now = clock.instant();
        if (c != null && "ECB".equals(c.source()) && c.fetchedAt().plus(TTL).isAfter(now)) {
            return c;
        }
        Instant last = lastAttempt;
        if (last != null && last.plus(RETRY).isAfter(now)) {
            return c != null ? c : fallback(now);   // fonte fora do ar há pouco: não tenta de novo a cada requisição
        }
        lastAttempt = now;
        ExchangeRatePort p = port.getIfAvailable();
        Optional<ExchangeRatePort.Quote> quote = p == null ? Optional.empty()
                : p.latest(BASE, Set.copyOf(SUPPORTED.stream().filter(s -> !s.equals(BASE)).toList()));
        if (quote.isPresent() && quote.get().rates().keySet().containsAll(List.of("USD", "EUR"))) {
            Map<String, BigDecimal> r = new LinkedHashMap<>();
            r.put(BASE, BigDecimal.ONE);
            SUPPORTED.stream().filter(s -> !s.equals(BASE)).forEach(s -> r.put(s, quote.get().rates().get(s)));
            cached = new Rates(BASE, quote.get().date(), "ECB", Map.copyOf(r), now);
            return cached;
        }
        return c != null ? c : fallback(now);   // última cotação boa, mesmo vencida; sem nenhuma, a reserva
    }

    private static Rates fallback(Instant now) {
        Map<String, BigDecimal> r = new LinkedHashMap<>();
        SUPPORTED.forEach(s -> r.put(s, FALLBACK.get(s)));
        return new Rates(BASE, null, "FALLBACK", r, now);
    }

    /** Converte entre duas moedas suportadas passando pela base; devolve vazio se alguma não for suportada. */
    public Optional<BigDecimal> convert(BigDecimal amount, String from, String to) {
        if (amount == null || !supported(from) || !supported(to)) {
            return Optional.empty();
        }
        String f = from.toUpperCase(Locale.ROOT);
        String t = to.toUpperCase(Locale.ROOT);
        if (f.equals(t)) {
            return Optional.of(amount);
        }
        Map<String, BigDecimal> r = rates().rates();
        BigDecimal inBase = amount.divide(r.get(f), MathContext.DECIMAL64);
        return Optional.of(inBase.multiply(r.get(t)).setScale(2, RoundingMode.HALF_EVEN));
    }

    public Map<String, Object> view() {
        Rates r = rates();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("base", r.base());
        out.put("date", r.date());
        out.put("source", r.source());
        out.put("rates", r.rates());
        out.put("supported", SUPPORTED);
        return out;
    }
}
