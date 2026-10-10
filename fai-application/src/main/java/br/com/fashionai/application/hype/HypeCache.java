package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.RenderCachePort;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * HypeScore v2 — cache de leitura (Redis quando ligado, memória no fallback). O Hype é lido muito mais do que muda:
 * cada execução do job incrementa a GERAÇÃO e toda chave carrega a geração, então a invalidação é implícita (as chaves da
 * geração anterior expiram sozinhas pelo TTL) — sem varrer chaves e sem recalcular agregações a cada card renderizado.
 */
@Component
public class HypeCache {
    static final String GENERATION_KEY = "hype:generation";
    static final Duration TTL = Duration.ofMinutes(10);

    private final RenderCachePort cache;

    public HypeCache(RenderCachePort cache) {
        this.cache = cache;
    }

    public long generation() {
        return cache.get(GENERATION_KEY).map(v -> {
            try {
                return Long.parseLong(v);
            } catch (NumberFormatException e) {
                return 0L;
            }
        }).orElse(0L);
    }

    /** Chamado pelo job depois de gravar o estado novo. */
    public void bump() {
        cache.put(GENERATION_KEY, String.valueOf(generation() + 1), Duration.ofDays(30));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> get(String key, Supplier<Map<String, Object>> loader) {
        String full = "hype:g" + generation() + ":" + key;
        Optional<String> hit = cache.get(full);
        if (hit.isPresent()) {
            Map<String, Object> m = Json.map(hit.get());
            if (m != null) {
                return m;
            }
        }
        Map<String, Object> value = loader.get();
        cache.put(full, Json.write(value), TTL);
        return value;
    }
}
