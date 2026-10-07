package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;

import javax.imageio.ImageIO;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Entrada de lote do pipeline de imagens da Busca Catalogada para o orquestrador
 * {@code scripts/catalog/process_catalog_images.py} (docs/catalogo/PROCESSAR_ACERVO_IMAGENS.md). Pura: sem rede, sem banco,
 * sem storage; só lê os arquivos locais (caminho absoluto) que o orquestrador já baixou com as regras de download seguro.
 * Nunca grava pixel: devolve só os metadados da análise (nível A, RN47.03), exatamente as colunas que
 * {@link CatalogImagePipelineService#apply}/{@code finish} gravariam com {@code persist=false}.
 *
 * <p>Protocolo JSONL em UTF-8 (um objeto JSON por linha) sobre stdin/stdout. O stdout leva só linhas do protocolo
 * ({@code System.out} vai para o stderr na subida; log e avisos ficam no stderr). Primeira linha:
 * {@code {"op":"ready","pipelineVersion":"CATALOG_IMAGE_PIPELINE_V3","registryVersion":"2.0.0"}}. Pedidos:
 * <ul>
 *   <li>{@code {"op":"analyze","id":..,"path":"/abs/foto","category":"upper_piece","subcategory":"t_shirt","imageType":"PACKSHOT"}}
 *       → veredito, regra de enquadramento, conformidade e {@code columns} (mime, width, height, source_sha256, phash,
 *       processing_status, pipeline_version, quality_score como texto com 4 casas, gate_reasons, crop_json e
 *       metrics_json como texto JSON);</li>
 *   <li>{@code {"op":"rank","id":<produto>,"category":..,"candidates":[{id,imageType,outcome,quality,detailView,phash}]}}
 *       → papel de cada foto ({@link ImageCandidateRanker#rank(List, PieceType)}).</li>
 * </ul>
 * Respostas ecoam o {@code id} e podem sair fora de ordem ({@code --threads N} em paralelo). Falha:
 * {@code {"id":..,"op":..,"ok":false,"error":"FILE_NOT_FOUND|FILE_TOO_LARGE|BAD_REQUEST|UNKNOWN_OP|INTERNAL: <msg>","message":..}}.
 * EOF no stdin: termina o que está em andamento e sai com 0.
 *
 * <p>Concorrência: os colaboradores do pipeline não guardam estado entre chamadas, mas por garantia cada thread do lote
 * tem o próprio {@link CatalogImagePipeline} ({@link ThreadLocal}); o registro e o ranqueador são imutáveis. O
 * segmentador de pessoa (ONNX, o mesmo da API) entra só se algum módulo no classpath o registrar via
 * {@link ServiceLoader}; sem ele vale só a evidência de pele do próprio segmentador da peça.
 */
public final class CatalogImageBatchCli {
    /** pedidos aceitos por thread antes de a leitura do stdin esperar (contrapressão: memória limitada) */
    static final int IN_FLIGHT_PER_THREAD = 4;
    static final String USAGE = "uso: java -cp <classpath> " + CatalogImageBatchCli.class.getName() + " [--threads N]";

    private final SemanticRegionRegistry registry;
    private final ThreadLocal<CatalogImagePipeline> pipelines;
    private final ImageCandidateRanker ranker = new ImageCandidateRanker();

    public CatalogImageBatchCli(SemanticRegionRegistry registry, PersonSegmentationPort persons) {
        this.registry = registry;
        this.pipelines = ThreadLocal.withInitial(() -> new CatalogImagePipeline(registry, persons));
    }

    public static void main(String[] args) {
        // stdout é do protocolo: o PrintStream do descritor 1 fica só para as respostas; qualquer System.out vira stderr
        PrintStream protocol = new PrintStream(new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), 1 << 16), false,
                StandardCharsets.UTF_8);
        System.setOut(System.err);
        System.setProperty("java.awt.headless", "true");
        int threads;
        try {
            threads = threads(args);
        } catch (IllegalArgumentException e) {
            System.err.println(e.getMessage());
            System.err.println(USAGE);
            System.exit(2);
            return;
        }
        if (threads == 0) {                        // --help
            System.err.println(USAGE);
            System.exit(0);
            return;
        }
        ImageIO.setUseCache(false);
        ImageOps.configureLimits(env("IMAGE_MAX_PIXELS", ImageOps.DEFAULT_MAX_PIXELS), (int) env("IMAGE_MAX_SIDE", ImageOps.DEFAULT_MAX_SIDE));
        PersonSegmentationPort persons = personSegmenter();
        System.err.println("catalog-batch: " + CatalogImagePipeline.VERSION + " threads=" + threads + " segmentadorDePessoa="
                + (persons == null ? "ausente" : persons.getClass().getSimpleName()) + " tetoPixels=" + ImageOps.maxPixels());
        int code = new CatalogImageBatchCli(SemanticRegionRegistry.get(), persons).run(System.in, protocol, threads);
        System.exit(code);
    }

    /** {@code --threads N} ou {@code --threads=N}; padrão max(1, núcleos − 1); 0 = pediu ajuda. */
    static int threads(String[] args) {
        int threads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
        for (int i = 0; i < args.length; i++) {
            String a = args[i], value;
            if (a.equals("-h") || a.equals("--help")) {
                return 0;
            } else if (a.equals("--threads")) {
                if (i + 1 >= args.length) {
                    throw new IllegalArgumentException("--threads exige um número");
                }
                value = args[++i];
            } else if (a.startsWith("--threads=")) {
                value = a.substring("--threads=".length());
            } else {
                throw new IllegalArgumentException("argumento desconhecido: " + a);
            }
            try {
                threads = Integer.parseInt(value.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("--threads inválido: " + value);
            }
            if (threads < 1 || threads > 256) {
                throw new IllegalArgumentException("--threads deve ficar entre 1 e 256: " + value);
            }
        }
        return threads;
    }

    /** Mesmo teto de decodificação da API (IMAGE_MAX_PIXELS / IMAGE_MAX_SIDE do application.yml). */
    private static long env(String name, long fallback) {
        String v = System.getenv(name);
        try {
            return v == null || v.isBlank() ? fallback : Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** Segmentador de pessoa registrado por outro módulo (ServiceLoader); null quando não há nenhum no classpath. */
    static PersonSegmentationPort personSegmenter() {
        try {
            return ServiceLoader.load(PersonSegmentationPort.class).findFirst().filter(PersonSegmentationPort::available).orElse(null);
        } catch (RuntimeException | LinkageError | ServiceConfigurationError e) {
            System.err.println("catalog-batch: segmentador de pessoa indisponível: " + e);
            return null;
        }
    }

    /**
     * Laço do protocolo: anuncia {@code ready}, lê uma linha por pedido e despacha para {@code threads} workers; no EOF
     * espera os pedidos em andamento. Devolve o código de saída (0 = EOF normal; 1 = stdin ou stdout quebrou).
     */
    public int run(InputStream in, PrintStream out, int threads) {
        Object lock = new Object();
        emit(out, lock, ready());
        AtomicInteger seq = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(threads, r -> {
            Thread t = new Thread(r, "catalog-batch-" + seq.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
        Semaphore slots = new Semaphore(threads * IN_FLIGHT_PER_THREAD);
        int code = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                if (out.checkError()) {
                    System.err.println("catalog-batch: stdout fechado; encerrando");
                    code = 1;
                    break;
                }
                slots.acquireUninterruptibly();
                String request = line;
                try {
                    pool.execute(() -> {
                        try {
                            emit(out, lock, handle(request));
                        } catch (Throwable e) {     // nem a resposta de erro saiu: devolve o mínimo que der
                            emit(out, lock, "{\"id\":null,\"op\":null,\"ok\":false,\"error\":\"INTERNAL: " + e.getClass().getSimpleName() + "\"}");
                        } finally {
                            slots.release();
                        }
                    });
                } catch (RejectedExecutionException e) {
                    slots.release();
                    emit(out, lock, handle(request));
                }
            }
        } catch (IOException e) {
            System.err.println("catalog-batch: falha lendo stdin: " + e.getMessage());
            code = 1;
        } finally {
            pool.shutdown();
            try {
                while (!pool.awaitTermination(1, TimeUnit.MINUTES)) {
                    System.err.println("catalog-batch: aguardando pedidos em andamento");
                }
            } catch (InterruptedException e) {
                pool.shutdownNow();
                Thread.currentThread().interrupt();
                code = 1;
            }
        }
        synchronized (lock) {
            out.flush();
        }
        return out.checkError() ? 1 : code;
    }

    String ready() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("op", "ready");
        m.put("pipelineVersion", CatalogImagePipeline.VERSION);
        m.put("registryVersion", registry.version());
        return Json.write(m);
    }

    private static void emit(PrintStream out, Object lock, String json) {
        synchronized (lock) {
            out.print(json);
            out.print('\n');
            out.flush();
        }
    }

    /** Um pedido (uma linha JSON) → uma resposta (uma linha JSON). Seguro para chamar de várias threads. */
    public String handle(String line) {
        long t0 = System.nanoTime();
        JsonNode req;
        try {
            req = Json.MAPPER.readTree(line);
        } catch (JacksonException e) {
            return error(null, null, "BAD_REQUEST", "JSON inválido: " + e.getOriginalMessage());
        }
        if (req == null || !req.isObject()) {
            return error(null, null, "BAD_REQUEST", "cada linha deve ser um objeto JSON");
        }
        String id = null, op = null;
        try {
            id = text(req, "id", true);
            op = text(req, "op", true);
            return switch (op) {
                case "analyze" -> analyze(id, req, t0);
                case "rank" -> rank(id, req);
                default -> error(id, op, "UNKNOWN_OP", "operação desconhecida: " + op + " (use analyze ou rank)");
            };
        } catch (Failure f) {
            return error(id, op, f.code, f.getMessage());
        } catch (Throwable e) {                       // inclui OutOfMemoryError de uma foto: a thread segue para a próxima
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getClass().getSimpleName() + ": " + e.getMessage();
            return error(id, op, "INTERNAL: " + msg, null);
        }
    }

    private String analyze(String id, JsonNode req, long t0) {
        Path path;
        try {
            path = Path.of(text(req, "path", true));
        } catch (InvalidPathException e) {
            throw new Failure("BAD_REQUEST", "path inválido: " + e.getMessage());
        }
        if (!path.isAbsolute()) {
            throw new Failure("BAD_REQUEST", "path deve ser absoluto: " + path);
        }
        String category = text(req, "category", false);
        String subcategory = text(req, "subcategory", false);
        String imageType = imageType(text(req, "imageType", false));
        byte[] bytes = read(path);
        CatalogImagePipeline.Analysis a = pipelines.get().run(new CatalogImagePipeline.Request(bytes, category, subcategory, imageType, false));
        SemanticCropper.Result crop = a.crop();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", "analyze");
        m.put("ok", true);
        m.put("outcome", a.outcome().name());
        m.put("reasons", a.reasons());
        m.put("qualityScore", a.qualityScore());
        m.put("pieceType", a.pieceType() == null ? null : a.pieceType().name());
        m.put("detailView", a.detailView());
        m.put("focus", a.focus() == null ? null : a.focus().name());
        m.put("rule", crop == null || crop.rule() == null ? null : crop.rule().toMap());
        m.put("compliance", crop == null || crop.rule() == null ? Map.of() : crop.compliance());
        m.put("ms", (System.nanoTime() - t0) / 1_000_000);
        m.put("columns", columns(a));
        return Json.write(m);
    }

    /** Lê o arquivo com o mesmo teto de bytes do download da API (ImageOps.MAX_UPLOAD_BYTES), sem passar dele. */
    static byte[] read(Path path) {
        try {
            if (!Files.isRegularFile(path)) {
                throw new Failure("FILE_NOT_FOUND", "arquivo não encontrado: " + path);
            }
            if (Files.size(path) > ImageOps.MAX_UPLOAD_BYTES) {
                throw new Failure("FILE_TOO_LARGE", "arquivo maior que " + ImageOps.MAX_UPLOAD_BYTES + " bytes: " + path);
            }
            try (InputStream in = Files.newInputStream(path)) {
                byte[] bytes = in.readNBytes((int) ImageOps.MAX_UPLOAD_BYTES + 1);
                if (bytes.length > ImageOps.MAX_UPLOAD_BYTES) {
                    throw new Failure("FILE_TOO_LARGE", "arquivo maior que " + ImageOps.MAX_UPLOAD_BYTES + " bytes: " + path);
                }
                return bytes;
            }
        } catch (NoSuchFileException | AccessDeniedException e) {
            throw new Failure("FILE_NOT_FOUND", "arquivo não encontrado ou sem permissão de leitura: " + path);
        } catch (IOException e) {
            throw new Failure("INTERNAL: " + e.getClass().getSimpleName() + ": " + e.getMessage(), null);
        }
    }

    /**
     * Colunas de catalog_images que a API grava para esta análise no nível A (apply + finish com persist=false), pelos
     * mesmos helpers do {@link CatalogImagePipelineService}. Fora daqui ficam processed_at, review_status, view_role e
     * is_canonical, que dependem do estado da linha no banco (o orquestrador aplica as mesmas regras da API).
     */
    public static Map<String, Object> columns(CatalogImagePipeline.Analysis a) {
        BigDecimal quality = CatalogImagePipelineService.qualityScore(a.qualityScore());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mime", a.mime());
        m.put("width", CatalogImagePipelineService.dimension(a.width()));
        m.put("height", CatalogImagePipelineService.dimension(a.height()));
        m.put("source_sha256", a.sha256());
        m.put("phash", a.phash());
        m.put("processing_status", a.outcome().name());
        m.put("pipeline_version", CatalogImagePipeline.VERSION);
        m.put("quality_score", quality == null ? null : quality.toPlainString());
        m.put("gate_reasons", CatalogImagePipelineService.gateReasons(a.reasons()));
        m.put("crop_json", CatalogImagePipelineService.cropJson(a));
        m.put("metrics_json", CatalogImagePipelineService.metricsJson(a));
        return m;
    }

    private String rank(String id, JsonNode req) {
        JsonNode list = req.get("candidates");
        if (list == null || !list.isArray()) {
            throw new Failure("BAD_REQUEST", "candidates deve ser uma lista");
        }
        List<ImageCandidateRanker.Candidate> candidates = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode c : list) {
            if (!c.isObject()) {
                throw new Failure("BAD_REQUEST", "cada candidato deve ser um objeto");
            }
            String cid = text(c, "id", true);
            if (!ids.add(cid)) {
                throw new Failure("BAD_REQUEST", "candidato repetido: " + cid);
            }
            CatalogImageValidator.Outcome outcome;
            try {
                outcome = CatalogImageValidator.Outcome.valueOf(text(c, "outcome", true).toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new Failure("BAD_REQUEST", "outcome inválido em " + cid + " (APPROVED, NEEDS_REPROCESSING ou REJECTED)");
            }
            JsonNode q = c.get("quality");
            if (q != null && !q.isNull() && !q.isNumber()) {
                throw new Failure("BAD_REQUEST", "quality deve ser número em " + cid);
            }
            JsonNode detail = c.get("detailView");
            if (detail != null && !detail.isNull() && !detail.isBoolean()) {
                throw new Failure("BAD_REQUEST", "detailView deve ser booleano em " + cid);
            }
            candidates.add(new ImageCandidateRanker.Candidate(cid, imageType(text(c, "imageType", false)), outcome,
                    q == null || q.isNull() ? 0 : q.asDouble(), detail != null && detail.asBoolean(false), text(c, "phash", false)));
        }
        List<Map<String, Object>> roles = new ArrayList<>();
        for (ImageCandidateRanker.Ranked r : ranker.rank(candidates, PieceType.of(text(req, "category", false)))) {
            Map<String, Object> role = new LinkedHashMap<>();
            role.put("id", r.candidate().id());
            role.put("role", r.role().name());
            role.put("score", r.score());
            roles.add(role);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", "rank");
        m.put("ok", true);
        m.put("roles", roles);
        return Json.write(m);
    }

    /** Vista declarada como o nome do enum do banco (CatalogImageType); vazia = sem vista. */
    static String imageType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim().toUpperCase(Locale.ROOT);
        try {
            return CatalogImageType.valueOf(t).name();
        } catch (IllegalArgumentException e) {
            throw new Failure("BAD_REQUEST", "imageType inválido: " + raw);
        }
    }

    /** Campo texto do pedido; obrigatório ausente ou de outro tipo = BAD_REQUEST. */
    static String text(JsonNode node, String field, boolean required) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            if (required) {
                throw new Failure("BAD_REQUEST", "campo obrigatório ausente: " + field);
            }
            return null;
        }
        if (!v.isString()) {
            throw new Failure("BAD_REQUEST", "campo " + field + " deve ser texto");
        }
        String s = v.asString();
        if (required && s.isBlank()) {
            throw new Failure("BAD_REQUEST", "campo obrigatório vazio: " + field);
        }
        return s;
    }

    static String error(String id, String op, String code, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", op);
        m.put("ok", false);
        m.put("error", code);
        if (message != null) {
            m.put("message", message);
        }
        return Json.write(m);
    }

    /** Falha esperada de um pedido: vira {@code ok:false} com o código do protocolo. */
    static final class Failure extends RuntimeException {
        final String code;

        Failure(String code, String message) {
            super(message, null, false, false);
            this.code = code;
        }
    }
}
