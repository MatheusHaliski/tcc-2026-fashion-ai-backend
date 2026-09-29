package br.com.fashionai.application.ai;

import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Teto de gasto com IA externa (RF24/RNF8). A cota por capacidade (CA14) limita quantas vezes cada pessoa usa um
 * recurso, mas não o quanto o sistema gasta: aqui entram dois tetos em dólar por dia UTC, somados a partir do custo
 * já gravado em {@code ai_inference_log} mais o custo estimado da chamada pendente:
 * <ul>
 *   <li>global ({@code fashionai.ai.daily-budget-usd} / {@code AI_DAILY_BUDGET_USD}) — inclui chamadas do sistema
 *       (jobs sem usuário, como a busca de logos pendentes);</li>
 *   <li>por usuário ({@code fashionai.ai.user-daily-budget-usd} / {@code AI_USER_DAILY_BUDGET_USD}).</li>
 * </ul>
 * Teto zero ou negativo = sem teto. Estourado, o motor pula os provedores remotos e usa o fallback local, sem expor
 * provedor nem valores ao cliente.
 */
@Component
public class AiBudget {
    private static final Logger log = LoggerFactory.getLogger(AiBudget.class);

    public enum Verdict { OK, GLOBAL_EXHAUSTED, USER_EXHAUSTED }

    private final AiInferenceLogRepository logs;
    private final BigDecimal globalDaily;
    private final BigDecimal userDaily;
    private final Clock clock;

    @Autowired
    public AiBudget(AiInferenceLogRepository logs,
                    @Value("${fashionai.ai.daily-budget-usd:5.00}") BigDecimal globalDaily,
                    @Value("${fashionai.ai.user-daily-budget-usd:0.50}") BigDecimal userDaily) {
        this(logs, globalDaily, userDaily, Clock.systemUTC());
    }

    AiBudget(AiInferenceLogRepository logs, BigDecimal globalDaily, BigDecimal userDaily, Clock clock) {
        this.logs = logs;
        this.globalDaily = globalDaily;
        this.userDaily = userDaily;
        this.clock = clock;
    }

    /** Cabe mais uma chamada de custo estimado {@code pending}? userId nulo = chamada do sistema (só o teto global). */
    public Verdict check(UUID userId, BigDecimal pending) {
        BigDecimal next = pending == null ? BigDecimal.ZERO : pending;
        Instant since = startOfUtcDay(clock.instant());
        try {
            if (capped(globalDaily) && exceeds(globalDaily, orZero(logs.sumEstimatedCostSince(since)), next)) {
                return Verdict.GLOBAL_EXHAUSTED;
            }
            if (userId != null && capped(userDaily) && exceeds(userDaily, orZero(logs.sumEstimatedCostByUserSince(userId, since)), next)) {
                return Verdict.USER_EXHAUSTED;
            }
            return Verdict.OK;
        } catch (RuntimeException ex) {
            // sem como somar o gasto, não arriscamos uma conta sem teto: segue o processamento local
            log.warn("Orçamento de IA indisponível ({}); chamada remota pulada", ex.getMessage());
            return capped(globalDaily) ? Verdict.GLOBAL_EXHAUSTED : Verdict.OK;
        }
    }

    public BigDecimal globalDaily() {
        return globalDaily;
    }

    public BigDecimal userDaily() {
        return userDaily;
    }

    static boolean capped(BigDecimal cap) {
        return cap != null && cap.signum() > 0;
    }

    /** Gasto do dia + chamada pendente passa do teto? */
    static boolean exceeds(BigDecimal cap, BigDecimal spent, BigDecimal pending) {
        return spent.add(pending).compareTo(cap) > 0;
    }

    static Instant startOfUtcDay(Instant now) {
        return now.atOffset(ZoneOffset.UTC).toLocalDate().atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
