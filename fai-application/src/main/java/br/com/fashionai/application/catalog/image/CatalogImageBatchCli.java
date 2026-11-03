package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogBatchInput.Failure;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;

import javax.imageio.ImageIO;
import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ServiceLoader;

import static br.com.fashionai.application.catalog.image.CatalogBatchArgs.env;
import static br.com.fashionai.application.catalog.image.CatalogBatchArgs.personSegmenter;
import static br.com.fashionai.application.catalog.image.CatalogBatchArgs.threads;
import static br.com.fashionai.application.catalog.image.CatalogBatchReport.error;
import static br.com.fashionai.application.catalog.image.CatalogBatchInput.imageType;
import static br.com.fashionai.application.catalog.image.CatalogBatchInput.read;
import static br.com.fashionai.application.catalog.image.CatalogBatchInput.text;

/**
 * Entrada de lote do pipeline de imagens da Busca Catalogada para o orquestrador
 * {@code scripts/catalog/process_catalog_images.py} (docs/catalogo/PROCESSAR_ACERVO_IMAGENS.md). Pura: sem rede, sem banco,
 * sem storage; só lê os arquivos locais (caminho absoluto) que o orquestrador já baixou com as regras de download seguro.
 * Nunca grava pixel: devolve só os metadados da análise (nível A, RN47.03), exatamente as colunas que
 * {@link CatalogImageWorker#apply}/{@code finish} gravariam com {@code persist=false}.
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
 *
 * <p>Argumentos e ambiente ficam em {@link CatalogBatchArgs}, o laço em {@link CatalogBatchLoop}, a leitura dos pedidos
 * em {@link CatalogBatchInput} e as respostas em {@link CatalogBatchReport}.
 */
public final class CatalogImageBatchCli {
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

    /**
     * Laço do protocolo: anuncia {@code ready}, lê uma linha por pedido e despacha para {@code threads} workers; no EOF
     * espera os pedidos em andamento. Devolve o código de saída (0 = EOF normal; 1 = stdin ou stdout quebrou).
     */
    public int run(InputStream in, PrintStream out, int threads) {
        return CatalogBatchLoop.run(ready(), this::handle, in, out, threads);
    }

    String ready() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("op", "ready");
        m.put("pipelineVersion", CatalogImagePipeline.VERSION);
        m.put("registryVersion", registry.version());
        m.put("fabricFrameVersion", FabricFrame.VERSION);
        // capacidade do lote V3 (scripts/catalog/category_frame.py confere antes de aplicar): quadro pela regra do produto
        m.put("productFrameVersion", ProductRuleFrame.VERSION);
        return Json.write(m);
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
        Path path = CatalogBatchInput.path(req);
        String category = text(req, "category", false);
        String subcategory = text(req, "subcategory", false);
        String imageType = imageType(text(req, "imageType", false));
        byte[] bytes = read(path);
        CatalogImagePipeline.Analysis a = pipelines.get().run(new CatalogImagePipeline.Request(bytes, category, subcategory, imageType, false));
        return CatalogBatchReport.analyzed(id, a, t0);
    }

    /**
     * Colunas de catalog_images que a API grava para esta análise no nível A (apply + finish com persist=false), pelos
     * mesmos helpers do {@link CatalogImagePipelineService} (ver {@link CatalogBatchReport#columns}).
     */
    public static Map<String, Object> columns(CatalogImagePipeline.Analysis a) {
        return CatalogBatchReport.columns(a);
    }

    private String rank(String id, JsonNode req) {
        List<ImageCandidateRanker.Candidate> candidates = CatalogBatchInput.candidates(req);
        return CatalogBatchReport.ranked(id, ranker.rank(candidates, PieceType.of(text(req, "category", false))));
    }
}
