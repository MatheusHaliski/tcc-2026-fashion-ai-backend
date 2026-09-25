package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.ReliefModelGenerator;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF16 — geração 3D da peça como job assíncrono com estado visível e recuperável do servidor (CA01/CA04):
 * <pre>enfileirado (QUEUED) → processando (PROCESSING) → concluído (COMPLETED) | falhou (FAILED)</pre>
 * O worker escolhe o provedor dentro da governança de IA (RF24): Meshy (assíncrono, PBR) → Stable Fast 3D
 * (síncrono) → relevo local ({@link ReliefModelGenerator}). Tempo limite ou erro sem saída viram FAILED com motivo
 * legível e um reprocessamento grátis (CA03). O modelo vai para o storage próprio e aparece na página da peça e no
 * Meu Quarto 3D (CA02).
 */
@Service
public class Model3dService {
    private static final Logger log = LoggerFactory.getLogger(Model3dService.class);
    static final int MAX_GLB_BYTES = 40 * 1024 * 1024;

    private final WardrobeItemRepository pieces;
    private final PipelineJobRepository jobs;
    private final MediaService media;
    private final List<ImageProviderPorts.Model3dPort> providers;
    private final WebFetchPort web;
    private final AiEngine ai;
    private final FaiPointsService points;
    private final NotificationService notifications;
    private final TransactionTemplate tx;
    private final boolean enabled;
    private final Duration timeout;

    public Model3dService(WardrobeItemRepository pieces, PipelineJobRepository jobs, MediaService media,
                          List<ImageProviderPorts.Model3dPort> providers, WebFetchPort web, AiEngine ai, FaiPointsService points,
                          NotificationService notifications, TransactionTemplate tx,
                          @Value("${fashionai.features.rf16-3d:true}") boolean enabled,
                          @Value("${fashionai.features.rf16-3d-timeout-minutes:10}") int timeoutMinutes) {
        this.pieces = pieces;
        this.jobs = jobs;
        this.media = media;
        this.providers = providers;
        this.web = web;
        this.ai = ai;
        this.points = points;
        this.notifications = notifications;
        this.tx = tx;
        this.enabled = enabled;
        this.timeout = Duration.ofMinutes(Math.max(1, timeoutMinutes));
    }

    // ================================================================== pedido e estado

    /** CA01 — cria o job (enfileirado). Chamado dentro da transação do WardrobeService, com a posse já validada. */
    public Map<String, Object> request(WardrobeItem w) {
        if (!enabled) {
            throw new ApiException(409, "RECURSO_DESLIGADO", Msg.t("model3d.a_geracao_3d_esta_desligada"));
        }
        if (w.getImageUrl() == null || w.isDefaultImage()) {
            throw new ApiException(422, "SEM_FOTO", Msg.t("model3d.a_peca_precisa_de_uma"));
        }
        if (w.getModel3dStatus() == Model3dStatus.QUEUED || w.getModel3dStatus() == Model3dStatus.PROCESSING) {
            return status(w);
        }
        PipelineJob last = latest(w.getId()).orElse(null);
        // CA03: depois de uma falha, o primeiro reprocessamento é grátis (não consome a cota diária de 3D)
        boolean freeRetry = w.getModel3dStatus() == Model3dStatus.FAILED && last != null && last.getRetryCount() == 0;
        PipelineJob job = new PipelineJob();
        job.setUser(w.getUser());
        job.setType(PipelineJobType.THREE_D_GENERATION);
        job.setStatus(PipelineJobStatus.PENDING);
        job.setTargetType("PIECE");
        job.setInputResourceId(w.getId());
        job.setQueuedAt(Instant.now());
        job.setRetryCount(freeRetry ? 1 : last != null ? last.getRetryCount() : 0);
        job.setInputJson(Json.write(Map.of("freeRetry", freeRetry, "image", w.getImageUrl())));
        jobs.save(job);
        w.setModel3dStatus(Model3dStatus.QUEUED);
        Map<String, Object> out = status(w, job);
        out.put("freeRetry", freeRetry);
        return out;
    }

    public Map<String, Object> status(WardrobeItem w) {
        return status(w, latest(w.getId()).orElse(null));
    }

    Map<String, Object> status(WardrobeItem w, PipelineJob job) {
        Map<String, Object> out = new LinkedHashMap<>();
        Model3dStatus st = w.getModel3dStatus();
        out.put("status", st == null ? null : st.name());
        out.put("label", label(st));
        out.put("modelUrl", w.getModel3dUrl());
        out.put("featureEnabled", enabled);
        out.put("providers", providers.stream().filter(ImageProviderPorts.Model3dPort::available).map(ImageProviderPorts.Model3dPort::providerId).toList());
        if (job != null) {
            Map<String, Object> result = Json.map(job.getResultJson());
            out.put("jobId", job.getId());
            out.put("provider", job.getProvider());
            out.put("progress", st == Model3dStatus.COMPLETED ? 100 : st == Model3dStatus.QUEUED ? 5 : result.getOrDefault("progress", 15));
            out.put("stages", Json.list(job.getStagesJson()));
            out.put("queuedAt", job.getQueuedAt());
            out.put("startedAt", job.getStartedAt());
            out.put("finishedAt", job.getFinishedAt());
            out.put("fallbackUsed", job.isFallbackUsed());
            out.put("error", job.getErrorMessage());
            out.put("canRetryFree", st == Model3dStatus.FAILED && job.getRetryCount() == 0);
            out.put("model", result.get("model"));
        }
        return out;
    }

    static String label(Model3dStatus s) {
        if (s == null) {
            return Msg.t("model3d.sem_modelo_3d");
        }
        return switch (s) {
            case QUEUED -> "enfileirado";
            case PROCESSING -> "processando";
            case COMPLETED -> Msg.t("model3d.concluido");
            case FAILED -> "falhou";
        };
    }

    Optional<PipelineJob> latest(UUID pieceId) {
        return jobs.findByTypeAndInputResourceIdOrderByCreatedAtDesc(PipelineJobType.THREE_D_GENERATION, pieceId).stream().findFirst();
    }

    // ================================================================== worker

    /** Processa a fila a cada 5 s: inicia os pendentes e acompanha os que estão no provedor externo (CA04). */
    @Scheduled(fixedDelayString = "${fashionai.features.rf16-3d-poll-ms:5000}", initialDelay = 8000)
    public void tick() {
        if (!enabled) {
            return;
        }
        for (PipelineJob job : jobs.findByStatusOrderByQueuedAtAsc(PipelineJobStatus.PENDING)) {
            if (job.getType() == PipelineJobType.THREE_D_GENERATION) {
                safely(job.getId(), this::start);
            }
        }
        for (PipelineJob job : jobs.findByStatusOrderByQueuedAtAsc(PipelineJobStatus.RUNNING)) {
            if (job.getType() == PipelineJobType.THREE_D_GENERATION) {
                safely(job.getId(), this::follow);
            }
        }
    }

    private void safely(UUID jobId, java.util.function.Consumer<UUID> step) {
        try {
            step.accept(jobId);
        } catch (RuntimeException e) {
            log.warn("job 3D {} falhou: {}", jobId, e.toString());
            tx.executeWithoutResult(s -> jobs.findById(jobId).ifPresent(j -> fail(j, "ERRO_INTERNO",
                    Msg.t("model3d.nao_conseguimos_gerar_o_3d", e.getClass().getSimpleName()))));
        }
    }

    /** Resultado da escolha de provedor: tarefa externa em andamento ou o GLB já pronto. */
    record Started(String provider, String taskId, byte[] glb, BigDecimal costUsd, boolean local, ReliefModelGenerator.Model relief) {
    }

    void start(UUID jobId) {
        record Input(UUID pieceId, UUID userId, byte[] png, String category, String subcategory, SchemeSlot slot, boolean freeRetry) {
        }
        Input in = tx.execute(s -> {
            PipelineJob job = jobs.findById(jobId).orElseThrow();
            WardrobeItem w = pieces.findById(job.getInputResourceId()).orElse(null);
            if (w == null) {
                fail(job, "PECA_REMOVIDA", Msg.t("model3d.a_peca_foi_excluida_antes"));
                return null;
            }
            byte[] bytes = media.read(w.getImageUrl()).orElse(null);
            if (bytes == null) {
                fail(job, "SEM_ARQUIVO", Msg.t("model3d.a_foto_da_peca_nao"));
                return null;
            }
            job.setStatus(PipelineJobStatus.RUNNING);
            job.setStartedAt(Instant.now());
            job.setAttempts(job.getAttempts() + 1);
            w.setModel3dStatus(Model3dStatus.PROCESSING);
            // só o job criado como "reprocessamento grátis" fica fora da cota (o retryCount segue ≥ 1 nos pedidos seguintes)
            boolean free = Boolean.TRUE.equals(Json.map(job.getInputJson()).get("freeRetry"));
            return new Input(w.getId(), w.getUser().getId(), bytes, w.getCategory(), w.getSubcategory(), LocalSchemeComposer.slotOf(w), free);
        });
        if (in == null) {
            return;
        }
        BufferedImage cutout = ImageOps.toArgb(ImageOps.decode(in.png()));
        double heightM = heightOf(in.slot(), in.subcategory());
        List<AiEngine.RemoteStep<Started>> steps = new ArrayList<>();
        for (ImageProviderPorts.Model3dPort p : providers) {
            steps.add(new AiEngine.RemoteStep<>() {
                public String provider() {
                    return p.providerId();
                }

                public String model() {
                    return p.async() ? "image-to-3d" : "stable-fast-3d";
                }

                public boolean available() {
                    return p.available();
                }

                public AiEngine.RemoteResult<Started> call() {
                    if (p.async()) {
                        String task = p.submit(in.png()).orElseThrow(() -> new IllegalStateException(p.providerId() + " recusou a tarefa"));
                        return new AiEngine.RemoteResult<>(new Started(p.providerId(), task, null, p.costUsd(), false, null), p.costUsd(), "tarefa " + task);
                    }
                    byte[] glb = p.generateNow(in.png()).filter(ReliefModelGenerator::isGlb)
                            .orElseThrow(() -> new IllegalStateException(p.providerId() + " não devolveu um GLB válido"));
                    return new AiEngine.RemoteResult<>(new Started(p.providerId(), null, glb, p.costUsd(), false, null), p.costUsd(), glb.length / 1024 + " KB");
                }
            });
        }
        // o reprocessamento grátis não consome cota: a chamada entra sem usuário no controle de cota (fica no log)
        AiOutcome<Started> outcome = ai.execute(in.freeRetry() ? null : in.userId(), AiCapability.THREE_D_GENERATOR,
                List.of(Msg.t("common.recorte_da_peca_png_sem"), "categoria " + in.category()), null, null, steps,
                () -> {
                    ReliefModelGenerator.Model m = ReliefModelGenerator.generate(cutout, heightM);
                    return new Started("local-relevo", null, m.glb(), BigDecimal.ZERO, true, m);
                });
        Started st = outcome.value();
        tx.executeWithoutResult(s -> {
            PipelineJob job = jobs.findById(jobId).orElseThrow();
            job.setProvider(st.provider());
            job.setFallbackUsed(outcome.fallbackUsed() || st.local());
            job.setTotalCostUsd(st.costUsd());
            List<Map<String, Object>> stages = new ArrayList<>();
            stages.add(stage("FOTO", "local", Msg.t("model3d.recorte_sem_fundo_do_rf4", cutout.getWidth(), cutout.getHeight())));
            if (st.taskId() != null) {
                job.setExternalJobId(st.taskId());
                stages.add(stage("ENVIO", st.provider(), "tarefa " + st.taskId()));
                job.setStagesJson(Json.write(stages));
                job.setResultJson(Json.write(Map.of("progress", 10)));
                return;
            }
            if (st.local()) {
                stages.add(stage("SILHUETA", "local", Msg.t("model3d.mascara_celulas_distancia_a_borda", ReliefModelGenerator.GRID)));
                stages.add(stage("MALHA", "local", Msg.t("model3d.vertices_triangulos", (st.relief().vertices()), st.relief().triangles())));
                stages.add(stage("TEXTURA", "local", Msg.t("model3d.foto_da_peca_como_basecolor")));
            } else {
                stages.add(stage("RECONSTRUCAO", st.provider(), Msg.t("model3d.glb_sincrono")));
            }
            complete(job, st.glb(), stages, st.relief());
        });
    }

    void follow(UUID jobId) {
        record Poll(String provider, String taskId, Instant startedAt) {
        }
        Poll p = tx.execute(s -> {
            PipelineJob job = jobs.findById(jobId).orElseThrow();
            return new Poll(job.getProvider(), job.getExternalJobId(), job.getStartedAt());
        });
        if (p == null || p.taskId() == null) {
            return;
        }
        boolean late = p.startedAt() != null && p.startedAt().plus(timeout).isBefore(Instant.now());
        ImageProviderPorts.Model3dPort port = providers.stream().filter(x -> x.providerId().equals(p.provider())).findFirst().orElse(null);
        ImageProviderPorts.TaskStatus status = port == null ? null : port.poll(p.taskId()).orElse(null);
        byte[] glb = null;
        String error = null;
        if (status != null && "SUCCEEDED".equals(status.state()) && status.glbUrl() != null) {
            glb = web.get(status.glbUrl(), MAX_GLB_BYTES, null).map(WebFetchPort.Fetched::body).filter(ReliefModelGenerator::isGlb).orElse(null);
            if (glb == null) {
                error = Msg.t("model3d.o_modelo_ficou_pronto_no");
            }
        } else if (status != null && "FAILED".equals(status.state())) {
            error = status.error() == null ? Msg.t("model3d.o_provedor_nao_conseguiu_reconstruir") : status.error();
        } else if (late) {
            error = Msg.t("model3d.passou_do_tempo_limite_de", timeout.toMinutes());
        } else {
            int progress = status == null ? 15 : Math.max(10, Math.min(95, status.progress()));
            tx.executeWithoutResult(s -> jobs.findById(jobId).ifPresent(j -> j.setResultJson(Json.write(Map.of("progress", progress)))));
            return;
        }
        byte[] ready = glb;
        String why = error;
        tx.executeWithoutResult(s -> {
            PipelineJob job = jobs.findById(jobId).orElseThrow();
            List<Map<String, Object>> stages = new ArrayList<>(Json.list(job.getStagesJson()));
            if (ready != null) {
                stages.add(stage("RECONSTRUCAO", p.provider(), Msg.t("model3d.glb_texturizado_pronto")));
                complete(job, ready, stages, null);
                return;
            }
            // RNF8: o provedor falhou → relevo local, para o usuário não ficar sem modelo
            WardrobeItem w = pieces.findById(job.getInputResourceId()).orElse(null);
            byte[] bytes = w == null ? null : media.read(w.getImageUrl()).orElse(null);
            if (bytes != null) {
                try {
                    ReliefModelGenerator.Model m = ReliefModelGenerator.generate(ImageOps.toArgb(ImageOps.decode(bytes)),
                            heightOf(LocalSchemeComposer.slotOf(w), w.getSubcategory()));
                    stages.add(stage("RECONSTRUCAO", p.provider(), "falhou: " + why));
                    stages.add(stage("MALHA", "local-relevo", Msg.t("model3d.vertices_plano_b", (m.vertices()))));
                    job.setFallbackUsed(true);
                    job.setProvider(p.provider() + "→local-relevo");
                    complete(job, m.glb(), stages, m);
                    return;
                } catch (RuntimeException ignored) {
                    // cai para a falha com motivo
                }
            }
            job.setStagesJson(Json.write(stages));
            fail(job, late ? "TEMPO_LIMITE" : "PROVEDOR_FALHOU", Msg.t("model3d.a_geracao_3d_nao_terminou", why, (job.getRetryCount() == 0 ? Msg.t("model3d.uma_vez_sem_custo") : ".")));
        });
    }

    private void complete(PipelineJob job, byte[] glb, List<Map<String, Object>> stages, ReliefModelGenerator.Model relief) {
        WardrobeItem w = pieces.findById(job.getInputResourceId()).orElse(null);
        if (w == null) {
            fail(job, "PECA_REMOVIDA", Msg.t("model3d.a_peca_foi_excluida_antes"));
            return;
        }
        String url = media.put("users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/model-" + System.currentTimeMillis() + ".glb",
                glb, "model/gltf-binary").url();
        stages.add(stage("ARMAZENAMENTO", "storage", Msg.t("model3d.kb_glb", (glb.length / 1024))));
        w.setModel3dUrl(url);
        w.setModel3dStatus(Model3dStatus.COMPLETED);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setOutputUrl(url);
        job.setFinishedAt(Instant.now());
        job.setTotalTimeMs(job.getStartedAt() == null ? null : (int) Duration.between(job.getStartedAt(), job.getFinishedAt()).toMillis());
        job.setStagesJson(Json.write(stages));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("progress", 100);
        result.put("bytes", glb.length);
        if (relief != null) {
            result.put("model", Map.of("kind", "relevo", "vertices", relief.vertices(), "triangles", relief.triangles(),
                    "widthM", round(relief.widthM()), "heightM", round(relief.heightM()), "depthM", round(relief.depthM())));
        } else {
            result.put("model", Map.of("kind", "reconstrucao"));
        }
        job.setResultJson(Json.write(result));
        notifications.notify(w.getUser().getId(), null, NotificationType.AI_JOB_FINISHED, "PIECE", w.getId(),
                Msg.k("model3d.modelo_3d_pronto"), Msg.k("model3d.ja_pode_ser_girada_em", w.getName()), Map.of("href", "/pieces/" + w.getId()));
        try {
            points.awardIsolated(w.getUser().getId(), "PIECE_3D", "PIECE", w.getId().toString(), null);   // +15, 1× por peça (§5.2)
        } catch (RuntimeException e) {
            log.debug("FAI Points do 3D não concedidos: {}", e.getMessage());
        }
    }

    private void fail(PipelineJob job, String code, String message) {
        job.setStatus(PipelineJobStatus.FAILED);
        job.setErrorCode(code);
        job.setErrorMessage(message);
        job.setFinishedAt(Instant.now());
        pieces.findById(job.getInputResourceId()).ifPresent(w -> w.setModel3dStatus(Model3dStatus.FAILED));
    }

    private static Map<String, Object> stage(String name, String provider, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("provider", provider);
        m.put("note", note);
        m.put("at", Instant.now().toString());
        return m;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }

    /** Altura real aproximada por tipo de peça (escala do modelo no quarto e no visualizador). */
    static double heightOf(SchemeSlot slot, String subcategory) {
        String sub = subcategory == null ? "" : subcategory;
        return switch (slot) {
            case TOP -> 0.68;
            case OUTERWEAR -> 0.78;
            case FULL_BODY -> 1.15;
            case BOTTOM -> sub.contains("short") || sub.contains("skirt") ? 0.5 : 1.0;
            case SHOES -> 0.14;
            case ACCESSORY -> sub.contains("bag") || sub.contains("tote") || sub.contains("backpack") ? 0.35 : 0.12;
        };
    }
}
