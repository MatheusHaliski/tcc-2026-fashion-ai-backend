package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do {@link CatalogImageBatchCli} (lote R93): argumentos, cada resposta do protocolo JSONL (analyze,
 * rank e todos os erros) e o laço {@code run} com uma thread, gravados no código original em
 * {@code catalog/image/batch-cli-retrato.txt}. Caminhos temporários viram {@code <dir>}.
 */
class CatalogImageBatchCliRetratoTest {
    @TempDir
    Path dir;

    private String line(String json) {
        return json.replace("<dir>", dir.toString());
    }

    private String clean(String text) {
        return text.replace(dir.toString(), "<dir>");
    }

    @Test
    void retratoDoProtocoloEDosArgumentos() throws Exception {
        Files.write(dir.resolve("tee.jpg"), jpeg(tee(200, 200, 1.0)));
        Files.write(dir.resolve("jeans.jpg"), jpeg(jeans()));
        Files.write(dir.resolve("person.jpg"), jpeg(teeOnPerson()));
        Files.write(dir.resolve("bad.bin"), new byte[]{1, 2, 3});
        Files.createDirectory(dir.resolve("folder"));
        try (RandomAccessFile big = new RandomAccessFile(dir.resolve("big.jpg").toFile(), "rw")) {
            big.setLength(ImageOps.MAX_UPLOAD_BYTES + 1);
        }
        CatalogImageBatchCli cli = new CatalogImageBatchCli(SemanticRegionRegistry.get(), null);
        CatalogImageRetrato r = CatalogImageRetrato.start();
        r.line("ready", cli.ready());
        r.line("usage", CatalogImageBatchCli.USAGE);
        for (List<String> args : List.of(List.<String>of(), List.of("--threads", "3"), List.of("--threads=7"), List.of("-h"),
                List.of("--help"), List.of("--threads"), List.of("--threads=x"), List.of("--threads", "0"), List.of("--threads=257"),
                List.of("--fast"), List.of("--threads", " 12 "))) {
            String value;
            try {
                int n = CatalogBatchArgs.threads(args.toArray(String[]::new));
                value = args.isEmpty() ? (n == Math.max(1, Runtime.getRuntime().availableProcessors() - 1) ? "padrão" : "?") : String.valueOf(n);
            } catch (IllegalArgumentException e) {
                value = "erro: " + e.getMessage();
            }
            r.line("threads " + args, value);
        }
        List<String> requests = List.of(
                "{\"op\":\"analyze\",\"id\":\"a1\",\"path\":\"<dir>/tee.jpg\",\"category\":\"upper_piece\",\"subcategory\":\"t_shirt\",\"imageType\":\"packshot\"}",
                "{\"op\":\"analyze\",\"id\":\"a2\",\"path\":\"<dir>/jeans.jpg\",\"category\":\"lower_piece\",\"subcategory\":\"jeans\"}",
                "{\"op\":\"analyze\",\"id\":\"a3\",\"path\":\"<dir>/person.jpg\",\"category\":\"upper_piece\",\"imageType\":\" FRONT \"}",
                "{\"op\":\"analyze\",\"id\":\"a4\",\"path\":\"<dir>/bad.bin\",\"category\":\"upper_piece\",\"imageType\":\"\"}",
                "{\"op\":\"analyze\",\"id\":\"a5\",\"path\":\"<dir>/missing.jpg\"}",
                "{\"op\":\"analyze\",\"id\":\"a6\",\"path\":\"<dir>/folder\"}",
                "{\"op\":\"analyze\",\"id\":\"a7\",\"path\":\"<dir>/big.jpg\"}",
                "{\"op\":\"analyze\",\"id\":\"a8\",\"path\":\"relative/tee.jpg\"}",
                "{\"op\":\"analyze\",\"id\":\"a9\",\"path\":\"<dir>/tee.jpg\",\"imageType\":\"SELFIE\"}",
                "{\"op\":\"analyze\",\"id\":\"a10\",\"path\":\"\\u0000bad\"}",
                "{\"op\":\"analyze\",\"id\":\"a11\"}",
                "{\"op\":\"analyze\",\"id\":\"a12\",\"path\":5}",
                "{\"op\":\"rank\",\"id\":\"p1\",\"category\":\"upper_piece\",\"candidates\":[{\"id\":\"x\",\"imageType\":\"FRONT\",\"outcome\":\"approved\",\"quality\":0.9,\"detailView\":false,\"phash\":\"ffff0000ffff0000\"},"
                        + "{\"id\":\"y\",\"imageType\":\"BACK\",\"outcome\":\"APPROVED\",\"quality\":0.95},{\"id\":\"z\",\"imageType\":\"DETAIL\",\"outcome\":\"NEEDS_REPROCESSING\",\"detailView\":true,\"quality\":null},"
                        + "{\"id\":\"w\",\"outcome\":\"REJECTED\",\"phash\":\"ffff0000ffff0000\"},{\"id\":\"v\",\"imageType\":\"FRONT\",\"outcome\":\"APPROVED\",\"quality\":0.9,\"phash\":\"ffff0000ffff0000\"}]}",
                "{\"op\":\"rank\",\"id\":\"p2\",\"candidates\":[]}",
                "{\"op\":\"rank\",\"id\":\"p3\",\"candidates\":{}}",
                "{\"op\":\"rank\",\"id\":\"p4\",\"candidates\":[1]}",
                "{\"op\":\"rank\",\"id\":\"p5\",\"candidates\":[{\"id\":\"x\",\"outcome\":\"APPROVED\"},{\"id\":\"x\",\"outcome\":\"APPROVED\"}]}",
                "{\"op\":\"rank\",\"id\":\"p6\",\"candidates\":[{\"id\":\"x\",\"outcome\":\"MAYBE\"}]}",
                "{\"op\":\"rank\",\"id\":\"p7\",\"candidates\":[{\"id\":\"x\",\"outcome\":\"APPROVED\",\"quality\":\"alta\"}]}",
                "{\"op\":\"rank\",\"id\":\"p8\",\"candidates\":[{\"id\":\"x\",\"outcome\":\"APPROVED\",\"detailView\":\"sim\"}]}",
                "{\"op\":\"rank\",\"id\":\"p9\",\"candidates\":[{\"outcome\":\"APPROVED\"}]}",
                "{\"op\":\"delete\",\"id\":\"d1\"}",
                "{\"op\":\"analyze\"}",
                "{\"id\":\"  \",\"op\":\"analyze\"}",
                "{\"id\":1,\"op\":\"rank\"}",
                "[1,2]",
                "null",
                "{nope");
        for (String request : requests) {
            r.line("handle " + clean(line(request)), clean(cli.handle(line(request))));
        }
        StringBuilder stdin = new StringBuilder();
        for (String request : requests.subList(0, 6)) {
            stdin.append(line(request)).append("\n\n");
        }
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        int code = cli.run(new ByteArrayInputStream(stdin.toString().getBytes(StandardCharsets.UTF_8)),
                new PrintStream(stdout, false, StandardCharsets.UTF_8), 1);
        r.line("run code", String.valueOf(code));
        r.line("run stdout", List.of(clean(stdout.toString(StandardCharsets.UTF_8)).split("\n")));
        ByteArrayOutputStream closed = new ByteArrayOutputStream();
        PrintStream broken = new PrintStream(closed, false, StandardCharsets.UTF_8);
        broken.close();
        r.line("run stdout fechado", String.valueOf(cli.run(new ByteArrayInputStream(stdin.toString().getBytes(StandardCharsets.UTF_8)), broken, 2)));
        r.line("error", CatalogBatchReport.error("i", "op", "CODE", null));
        assertThat(r.text()).isEqualTo(CatalogImageRetrato.golden(r.text(), "batch-cli-retrato.txt"));
    }
}
