package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.UserGuide;
import br.com.fashionai.domain.repository.UserGuideRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Orientação "Como funciona" (docs/ux/ORIENTACAO.md). Regras de abertura automática, decididas aqui e não no navegador:
 *
 * <ul>
 *   <li>abre sozinho na primeira visita pertinente daquela versão;</li>
 *   <li>"Entendi" sem marcar: não reabre na mesma visita e volta no máximo mais uma vez, depois de um dia;</li>
 *   <li>"Não mostrar novamente": não abre sozinho até a versão do tutorial subir (mudança relevante de funcionamento);</li>
 *   <li>"Como funciona" reabre sempre, sem contar como abertura automática.</li>
 * </ul>
 * Cada tutorial é independente: esconder um nunca esconde os outros.
 */
@Service
public class GuideService {
    public static final int MAX_AUTO = 2;
    public static final Duration AUTO_GAP = Duration.ofDays(1);
    static final Set<String> EVENTS = Set.of("AUTO_SHOWN", "MANUAL_SHOWN", "CLOSED", "HIDDEN", "UNHIDDEN");

    private final UserGuideRepository guides;
    private Clock clock = Clock.systemUTC();

    public GuideService(UserGuideRepository guides) {
        this.guides = guides;
    }

    public void useClock(Clock clock) {
        this.clock = clock;
    }

    public record GuideEvent(Integer version, String event) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (UserGuide g : guides.findByUserId(user.id())) {
            out.put(g.getGuideKey(), view(g));
        }
        return Map.of("guides", out, "maxAuto", MAX_AUTO, "autoGapHours", AUTO_GAP.toHours());
    }

    /** Pode abrir sozinho agora? (o cliente pergunta com a versão atual do tutorial) */
    public static boolean shouldAutoOpen(UserGuide g, int version, Instant now) {
        if (g == null || g.getVersion() < version) {
            return true;                         // nunca viu esta versão
        }
        if (g.isHidden() || g.getAutoCount() >= MAX_AUTO) {
            return false;
        }
        return g.getLastShownAt() == null || g.getLastShownAt().plus(AUTO_GAP).isBefore(now);
    }

    @Transactional
    public Map<String, Object> record(CurrentUser user, String key, GuideEvent e) {
        if (key == null || !key.matches("[a-z0-9][a-z0-9.-]{1,59}")) {
            throw ApiException.badRequest("TUTORIAL_INVALIDO", Msg.t("guide.tutorial_invalido"));
        }
        int version = e == null || e.version() == null ? 1 : e.version();
        String event = e == null || e.event() == null ? "" : e.event();
        if (version < 1 || version > 1000 || !EVENTS.contains(event)) {
            throw ApiException.badRequest("TUTORIAL_INVALIDO", Msg.t("guide.tutorial_invalido"));
        }
        Instant now = Instant.now(clock);
        UserGuide g = guides.findByUserIdAndGuideKey(user.id(), key).orElseGet(() -> {
            UserGuide n = new UserGuide();
            n.setUserId(user.id());
            n.setGuideKey(key);
            n.setVersion(version);
            return n;
        });
        if (g.getVersion() < version) {
            // mudança relevante de funcionamento: recomeça a contagem e desfaz o "não mostrar" da versão antiga
            g.setVersion(version);
            g.setHidden(false);
            g.setAutoCount(0);
        }
        switch (event) {
            case "AUTO_SHOWN" -> {
                g.setAutoCount(g.getAutoCount() + 1);
                g.setLastShownAt(now);
            }
            case "MANUAL_SHOWN", "CLOSED" -> g.setLastShownAt(now);
            case "HIDDEN" -> {
                g.setHidden(true);
                g.setLastShownAt(now);
            }
            case "UNHIDDEN" -> g.setHidden(false);
            default -> {
            }
        }
        guides.save(g);
        return view(g);
    }

    Map<String, Object> view(UserGuide g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", g.getVersion());
        m.put("hidden", g.isHidden());
        m.put("autoCount", g.getAutoCount());
        m.put("lastShownAt", g.getLastShownAt());
        m.put("autoOpen", shouldAutoOpen(g, g.getVersion(), Instant.now(clock)));
        return m;
    }
}
