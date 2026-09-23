package br.com.fashionai.infrastructure.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resiliência mínima e explícita por provedor (RF24.CA13 / RNF8): 1 nova tentativa com espera curta e
 * circuit breaker que abre por 60 s após 5 falhas seguidas — enquanto aberto, o provedor se declara indisponível
 * e o AiEngine segue direto para a alternativa ou para o motor local.
 */
public final class ProviderCircuit {
    private static final Logger log = LoggerFactory.getLogger(ProviderCircuit.class);
    private static final int FAILURES_TO_OPEN = 5;
    private static final Duration OPEN_FOR = Duration.ofSeconds(60);

    private record State(int failures, Instant openUntil) {
    }

    private static final Map<String, State> STATES = new ConcurrentHashMap<>();

    private ProviderCircuit() {
    }

    public static boolean closed(String provider) {
        State s = STATES.get(provider);
        return s == null || s.openUntil == null || !s.openUntil.isAfter(Instant.now());
    }

    public static <T> T run(String provider, Callable<T> call) throws Exception {
        if (!closed(provider)) {
            throw new IllegalStateException("Circuito aberto para " + provider);
        }
        Exception last = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                T result = call.call();
                STATES.remove(provider);
                return result;
            } catch (Exception e) {
                last = e;
                State s = STATES.compute(provider, (k, old) -> {
                    int failures = (old == null ? 0 : old.failures) + 1;
                    return new State(failures, failures >= FAILURES_TO_OPEN ? Instant.now().plus(OPEN_FOR) : null);
                });
                log.warn("{}: tentativa {} falhou ({}){}", provider, attempt, e.getMessage(),
                        s.openUntil != null ? " — circuito aberto por 60 s" : "");
                if (attempt == 1 && s.openUntil == null && retryable(e)) {
                    Thread.sleep(500);
                    continue;
                }
                break;
            }
        }
        throw last;
    }

    private static boolean retryable(Exception e) {
        String m = e.getMessage() == null ? "" : e.getMessage();
        return e instanceof java.io.IOException || m.contains("timeout") || m.contains("529") || m.contains("503")
                || m.contains("502") || m.contains("429");
    }
}
