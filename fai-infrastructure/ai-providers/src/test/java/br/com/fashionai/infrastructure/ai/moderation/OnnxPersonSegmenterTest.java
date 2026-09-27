package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafety;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Segmentador local da moderação (modelo selfie_multiclass em ONNX, no próprio servidor). Os testes usam só imagens sem
 * nudez: o modelo carrega, roda rápido e não retém foto de peça nem imagem sem pessoa. A calibração com fotos reais de
 * pessoas vestidas roda à parte ({@code FAI_MOD_CALIB_DIR}), porque as fotos não ficam no repositório.
 */
class OnnxPersonSegmenterTest {
    private final OnnxPersonSegmenter seg = new OnnxPersonSegmenter();

    private static BufferedImage flat(Color c) {
        BufferedImage img = new BufferedImage(640, 480, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillRect(0, 0, 640, 480);
        g.dispose();
        return img;
    }

    @Test
    void modeloCarregaERodaNoServidor() {
        long t0 = System.nanoTime();
        PersonParts p = seg.segment(flat(new Color(0x2A6FDB))).orElseThrow();
        long ms = (System.nanoTime() - t0) / 1_000_000;
        assertTrue(seg.available());
        assertTrue(p.person() < 0.05, "imagem lisa não tem pessoa: " + p);
        assertTrue(ms < 20_000, "carregar + inferir em " + ms + " ms");
        long t1 = System.nanoTime();
        seg.segment(flat(Color.WHITE)).orElseThrow();
        assertTrue((System.nanoTime() - t1) / 1_000_000 < 2_000, "inferência depois de carregado");
    }

    @Test
    void fotoDePecaNaoEhRetida() throws IOException {
        Path root = Path.of("../../public/assets_pecas");
        assumeTrue(Files.isDirectory(root), "assets de peças do FashionAI");
        List<Path> files;
        try (Stream<Path> s = Files.walk(root)) {
            files = s.filter(f -> f.toString().endsWith(".png")).sorted().limit(12).toList();
        }
        assertTrue(files.size() >= 6);
        for (Path f : files) {
            BufferedImage img = ImageOps.scaleToFit(ImageOps.decode(Files.readAllBytes(f)), 1024, 1024);
            PersonParts p = seg.segment(img).orElseThrow();
            assertEquals(ImageSafety.Decision.ALLOW, ImageSafety.fromParts(p).decision(), f.getFileName() + " " + p);
        }
    }

    /**
     * Calibração com fotos reais de pessoas vestidas (fora do repositório):
     * {@code FAI_MOD_CALIB_DIR=/pasta/com/fotos mvn -pl fai-infrastructure/ai-providers test -Dtest=OnnxPersonSegmenterTest}.
     * Imprime as medidas de cada foto e falha se alguma foto vestida for retida.
     */
    @Test
    void calibracaoComFotosVestidas() throws IOException {
        String dirs = System.getenv("FAI_MOD_CALIB_DIR");
        assumeTrue(dirs != null && !dirs.isBlank(), "FAI_MOD_CALIB_DIR não definida");
        int n = 0, held = 0;
        double maxSkin = 0;
        for (String d : dirs.split(":")) {
            try (Stream<Path> s = Files.list(Path.of(d))) {
                for (Path f : s.filter(x -> x.toString().toLowerCase().matches(".*\\.(jpe?g|png|webp)$")).sorted().toList()) {
                    BufferedImage img = ImageOps.scaleToFit(ImageOps.decode(Files.readAllBytes(f)), 1024, 1024);
                    PersonParts p = seg.segment(img).orElseThrow();
                    ImageSafety.Verdict v = ImageSafety.fromParts(p);
                    n++;
                    if (v.held()) {
                        held++;
                    }
                    if (p.person() >= 0.10) {
                        maxSkin = Math.max(maxSkin, p.bodySkin());
                    }
                    System.out.printf("CALIB %-40s person=%.3f bodySkin=%.3f faceSkin=%.3f clothes=%.3f -> %s%n",
                            f.getFileName(), p.person(), p.bodySkin(), p.faceSkin(), p.clothes(), v.decision());
                }
            }
        }
        System.out.println("CALIB " + Map.of("fotos", n, "retidas", held, "maiorPeleDoCorpo", Math.round(maxSkin * 1000) / 1000.0));
        assertEquals(0, held, "nenhuma foto vestida pode ser retida");
    }
}
