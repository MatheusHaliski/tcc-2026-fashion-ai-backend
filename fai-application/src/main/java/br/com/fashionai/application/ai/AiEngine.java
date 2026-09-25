package br.com.fashionai.application.ai;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.domain.model.AiInferenceLog;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Motor transversal de IA (RF24). Um motor, não dez requisitos: toda capacidade passa pelo mesmo
 * funil de governança — validação de prompt (CA16/HU-RF6.CA19), cota por usuário (CA14), consentimento
 * por finalidade (CA15), provedor primário → alternativo → fallback local (CA13/RNF8), registro da
 * inferência (CA16/RNF5) e explicação "por quê?" (CA12/RNF6).
 */
@Service
public class AiEngine {
    private static final Logger log = LoggerFactory.getLogger(AiEngine.class);
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("America/Sao_Paulo"));

    private final Map<String, AiProviderPort> providers = new LinkedHashMap<>();
    private final RateLimitPort rateLimit;
    private final UserConsentRepository consents;
    private final AiInferenceLogRepository inferenceLogs;
    private final AuditService auditService;
    private final boolean remoteEnabled;
    private final boolean feature3d;

    public AiEngine(List<AiProviderPort> providerPorts, RateLimitPort rateLimit, UserConsentRepository consents,
                    AiInferenceLogRepository inferenceLogs, AuditService auditService,
                    @Value("${fashionai.ai.remote-enabled:true}") boolean remoteEnabled,
                    @Value("${fashionai.features.rf16-3d:false}") boolean feature3d) {
        providerPorts.forEach(p -> providers.put(p.providerId(), p));
        this.rateLimit = rateLimit;
        this.consents = consents;
        this.inferenceLogs = inferenceLogs;
        this.auditService = auditService;
        this.remoteEnabled = remoteEnabled;
        this.feature3d = feature3d;
    }

    /** Um passo remoto (provedor textual, de imagem ou 3D) avaliado dentro da governança. */
    public interface RemoteStep<T> {
        String provider();

        String model();

        boolean available();

        RemoteResult<T> call() throws Exception;
    }

    public record RemoteResult<T>(T value, BigDecimal costUsd, String outputSummary) {
    }

    /** Chamada textual/multimodal padrão: prompt → provedor (catálogo) → parser → valor. */
    public record TextCall<T>(UUID userId, AiCapability capability, String system, String prompt,
                              List<AiRequest.AiImage> images, long maxTokens, List<String> inputsUsed,
                              Function<String, T> parser, Supplier<T> local, Collection<String> protectedNames,
                              boolean webSearch) {
        public TextCall(UUID userId, AiCapability capability, String system, String prompt, List<AiRequest.AiImage> images,
                        long maxTokens, List<String> inputsUsed, Function<String, T> parser, Supplier<T> local,
                        Collection<String> protectedNames) {
            this(userId, capability, system, prompt, images, maxTokens, inputsUsed, parser, local, protectedNames, false);
        }
    }

    public <T> AiOutcome<T> text(TextCall<T> call) {
        AiCatalog.CapabilitySpec spec = AiCatalog.spec(call.capability());
        List<RemoteStep<T>> steps = new ArrayList<>();
        for (AiCatalog.ProviderOption option : new AiCatalog.ProviderOption[]{spec.primary(), spec.alternative()}) {
            if (option == null || "local".equals(option.providerId())) {
                continue;
            }
            AiProviderPort port = providers.get(option.providerId());
            if (port == null) {
                continue;
            }
            steps.add(new RemoteStep<>() {
                @Override
                public String provider() {
                    return option.providerId();
                }

                @Override
                public String model() {
                    return option.model();
                }

                @Override
                public boolean available() {
                    return port.available();
                }

                @Override
                public RemoteResult<T> call() {
                    AiResponse response = port.invoke(new AiRequest(call.userId(), call.capability(), option.model(),
                            call.system(), call.prompt(), call.images(), call.maxTokens(), true, call.webSearch()));
                    T value = call.parser().apply(response.text());
                    if (value == null) {
                        throw new IllegalStateException("Resposta do provedor fora do contrato JSON");
                    }
                    String summary = response.text() == null ? "" : response.text();
                    return new RemoteResult<>(value, response.estimatedCostUsd(), summary);
                }
            });
        }
        return execute(call.userId(), call.capability(), call.inputsUsed(), call.prompt(), call.protectedNames(),
                steps, call.local());
    }

    public <T> AiOutcome<T> execute(UUID userId, AiCapability capability, List<String> inputsUsed, String prompt,
                                    Collection<String> protectedNames, List<RemoteStep<T>> remotes, Supplier<T> local) {
        AiCatalog.CapabilitySpec spec = AiCatalog.spec(capability);
        String correlationId = UUID.randomUUID().toString();
        List<String> inputs = inputsUsed == null ? List.of() : inputsUsed;

        if (prompt != null && (capability == AiCapability.BACKGROUND_GENERATOR || protectedNames != null)) {
            CelebrityPromptValidator.Verdict verdict = CelebrityPromptValidator.validate(prompt, protectedNames);
            if (!verdict.accepted()) {
                UUID id = record(userId, capability, "none", "none", 0, BigDecimal.ZERO, AiCallResult.PROMPT_REJECTED,
                        false, inputs, String.join("; ", verdict.violations()), "n/a", correlationId);
                throw new ApiException(422, "PROMPT_REJEITADO",
                        Msg.t("ai.a_arte_trabalha_a_atmosfera"),
                        Map.of("violations", verdict.violations(), "inferenceId", id.toString()));
            }
        }

        if (!capability.inScope() && !(capability == AiCapability.THREE_D_GENERATOR && feature3d)) {
            return localOutcome(userId, capability, inputs, local, AiCallResult.FALLBACK_LOCAL,
                    Msg.t("ai.e_tema_futuro_recurso_desligado", (capability.hostRf())), "n/a", null, correlationId);
        }

        String consentState = consentState(userId, capability.consentPurpose());
        boolean anyRemote = remoteEnabled && remotes.stream().anyMatch(RemoteStep::available);
        if (!anyRemote) {
            return localOutcome(userId, capability, inputs, local, AiCallResult.FALLBACK_LOCAL, null, consentState, null,
                    correlationId);
        }
        if ("NEGADO".equals(consentState)) {
            return localOutcome(userId, capability, inputs, local, AiCallResult.CONSENT_DENIED,
                    Msg.t("ai.voce_nao_autorizou_o_envio", capability.consentPurpose()),
                    consentState, null, correlationId);
        }

        AiOutcome.Quota quota = null;
        if (userId != null) {
            String bucket = "ai:" + capability.name();
            Duration window = Duration.ofDays(1);
            RateLimitPort.QuotaStatus status = rateLimit.status(userId, bucket, spec.dailyQuotaPerUser(), window);
            if (status.exhausted() || !rateLimit.tryAcquire(userId, bucket, spec.dailyQuotaPerUser(), window)) {
                RateLimitPort.QuotaStatus now = rateLimit.status(userId, bucket, spec.dailyQuotaPerUser(), window);
                AiOutcome.Quota q = new AiOutcome.Quota(now.limit(), now.used(), now.resetAt());
                return localOutcome(userId, capability, inputs, local, AiCallResult.RATE_LIMITED,
                        Msg.t("ai.cota_diaria_de_usos_de", now.limit(), capability.officialName(), HOUR.format(now.resetAt())),
                        consentState, q, correlationId);
            }
            RateLimitPort.QuotaStatus after = rateLimit.status(userId, bucket, spec.dailyQuotaPerUser(), window);
            quota = new AiOutcome.Quota(after.limit(), after.used(), after.resetAt());
        }

        AiCallResult failure = AiCallResult.ERROR;
        for (RemoteStep<T> step : remotes) {
            if (!step.available()) {
                continue;
            }
            long started = System.nanoTime();
            try {
                RemoteResult<T> result = step.call();
                long latency = (System.nanoTime() - started) / 1_000_000;
                BigDecimal cost = result.costUsd() == null ? BigDecimal.ZERO : result.costUsd();
                UUID id = record(userId, capability, step.provider(), step.model(), latency, cost, AiCallResult.SUCCESS,
                        false, inputs, result.outputSummary(), consentState, correlationId);
                return new AiOutcome<>(result.value(), id, AiCallResult.SUCCESS, false, step.provider(), step.model(),
                        latency, cost, null, explanation(capability, step.provider(), step.model(), inputs, consentState,
                        Msg.t("ai.provedor_respondeu_dentro_do_tempo", step.provider())), quota);
            } catch (Exception ex) {
                long latency = (System.nanoTime() - started) / 1_000_000;
                failure = classify(ex, latency, spec.timeoutSeconds());
                log.warn("IA {} falhou no provedor {} ({}): {}", capability, step.provider(), failure, ex.getMessage());
                record(userId, capability, step.provider(), step.model(), latency, BigDecimal.ZERO, failure, true, inputs,
                        String.valueOf(ex.getMessage()), consentState, correlationId);
            }
        }
        AiOutcome<T> fallback = localOutcome(userId, capability, inputs, local, AiCallResult.FALLBACK_LOCAL,
                Msg.t("ai.o_servico_de_ia_externo", failure),
                consentState, quota, correlationId);
        return fallback;
    }

    private <T> AiOutcome<T> localOutcome(UUID userId, AiCapability capability, List<String> inputs, Supplier<T> local,
                                          AiCallResult result, String message, String consentState,
                                          AiOutcome.Quota quota, String correlationId) {
        long started = System.nanoTime();
        T value = local == null ? null : local.get();
        long latency = (System.nanoTime() - started) / 1_000_000;
        UUID id = record(userId, capability, "local", "local", latency, BigDecimal.ZERO, result, true, inputs,
                value == null ? "" : String.valueOf(value), consentState, correlationId);
        String reason = switch (result) {
            case CONSENT_DENIED -> Msg.t("ai.consentimento_para_nao_concedido", capability.consentPurpose());
            case RATE_LIMITED -> Msg.t("ai.cota_diaria_atingida_processamento_local");
            default -> message == null ? Msg.t("ai.nenhum_provedor_externo_configurado")
                    : Msg.t("ai.provedor_externo_indisponivel");
        };
        return new AiOutcome<>(value, id, result, true, "local", "local", latency, BigDecimal.ZERO, message,
                explanation(capability, "local", "local", inputs, consentState, reason), quota);
    }

    private AiOutcome.Explanation explanation(AiCapability capability, String provider, String model, List<String> inputs,
                                              String consentState, String reason) {
        return new AiOutcome.Explanation(capability.officialName(), capability.hostRf(), provider, model, inputs,
                consentState, reason);
    }

    private AiCallResult classify(Exception ex, long latencyMs, int timeoutSeconds) {
        String name = ex.getClass().getSimpleName().toLowerCase();
        String message = String.valueOf(ex.getMessage()).toLowerCase();
        if (name.contains("callnotpermitted") || message.contains("circuitbreaker")) {
            return AiCallResult.CIRCUIT_OPEN;
        }
        if (name.contains("timeout") || message.contains("timed out") || latencyMs >= timeoutSeconds * 1000L) {
            return AiCallResult.TIMEOUT;
        }
        if (name.contains("ratelimit") || message.contains("429")) {
            return AiCallResult.RATE_LIMITED;
        }
        return AiCallResult.ERROR;
    }

    private String consentState(UUID userId, ConsentPurpose purpose) {
        if (purpose == null) {
            return "NAO_APLICAVEL";
        }
        if (userId == null) {
            return "SISTEMA";
        }
        return consents.findByUserIdAndPurpose(userId, purpose).filter(c -> c.isGranted()).map(c -> "CONCEDIDO")
                .orElse("NEGADO");
    }

    private UUID record(UUID userId, AiCapability capability, String provider, String model, long latency,
                        BigDecimal cost, AiCallResult result, boolean fallback, List<String> inputs, String output,
                        String consentState, String correlationId) {
        AiInferenceLog entry = new AiInferenceLog();
        entry.setId(UUID.randomUUID());
        entry.setUserId(userId);
        entry.setCapability(capability.name());
        entry.setHostRf(capability.hostRf());
        entry.setProvider(provider);
        entry.setModel(model);
        entry.setLatencyMs(latency);
        entry.setEstimatedCostUsd(cost);
        entry.setResult(result);
        entry.setFallbackUsed(fallback);
        entry.setInputSummaryJson(Json.write(inputs));
        entry.setOutputSummary(output == null ? null : output.length() > 900 ? output.substring(0, 900) + "…" : output);
        entry.setConsentState(consentState);
        entry.setCorrelationId(correlationId);
        entry.setCreatedAt(Instant.now());
        try {
            inferenceLogs.save(entry);
        } catch (RuntimeException ex) {
            log.warn("Falha ao gravar ai_inference_log: {}", ex.getMessage());
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("capability", capability.name());
        meta.put("hostRf", capability.hostRf());
        meta.put("provider", provider);
        meta.put("model", model);
        meta.put("latencyMs", latency);
        meta.put("estimatedCostUsd", cost);
        meta.put("fallbackUsed", fallback);
        meta.put("inferenceId", entry.getId().toString());
        auditService.record(new AuditEvent(userId == null ? "system" : userId.toString(), AuditActions.CHAMADA_IA,
                capability.name(), result.name(), null, null, Instant.now(), correlationId, meta));
        return entry.getId();
    }

    /**
     * Capacidade cujo motor primário é local (SealBond Matcher, Acervo Grouping, Affinity, Category Fallback
     * Compositor, Photo Curator): registra a inferência como sucesso do provedor local, com o "por quê?".
     */
    public <T> AiOutcome<T> local(UUID userId, AiCapability capability, List<String> inputsUsed, Supplier<T> engine) {
        String correlationId = UUID.randomUUID().toString();
        List<String> inputs = inputsUsed == null ? List.of() : inputsUsed;
        long started = System.nanoTime();
        T value = engine.get();
        long latency = (System.nanoTime() - started) / 1_000_000;
        String consent = consentState(userId, capability.consentPurpose());
        UUID id = record(userId, capability, "local", "local", latency, BigDecimal.ZERO, AiCallResult.SUCCESS, false, inputs,
                value == null ? "" : String.valueOf(value), consent, correlationId);
        return new AiOutcome<>(value, id, AiCallResult.SUCCESS, false, "local", "local", latency, BigDecimal.ZERO, null,
                explanation(capability, "local", "local", inputs, consent,
                        Msg.t("ai.motor_local_deterministico_primario")), null);
    }

    public Optional<AiProviderPort> provider(String id) {
        return Optional.ofNullable(providers.get(id));
    }

    public boolean remoteEnabled() {
        return remoteEnabled;
    }

    public Map<String, Boolean> providerAvailability() {
        Map<String, Boolean> map = new LinkedHashMap<>();
        providers.forEach((k, v) -> map.put(k, remoteEnabled && v.available()));
        return map;
    }
}
