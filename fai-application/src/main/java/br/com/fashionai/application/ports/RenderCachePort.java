package br.com.fashionai.application.ports;

import java.time.Duration;
import java.util.Optional;

/** Redis — cache de renderização do provador 2D (render_cache:{schemeId}:{manequim}, TTL 1h — RFC RF18). */
public interface RenderCachePort {
    Optional<String> get(String key);

    void put(String key, String value, Duration ttl);

    void evict(String key);
}
