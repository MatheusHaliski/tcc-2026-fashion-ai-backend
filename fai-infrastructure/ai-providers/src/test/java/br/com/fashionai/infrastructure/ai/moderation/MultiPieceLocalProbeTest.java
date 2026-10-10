package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalPieceRegions;
import br.com.fashionai.application.imaging.TextReaderPort;
import br.com.fashionai.application.imaging.WornPieceRegions;
import br.com.fashionai.application.moderation.ImageSafetyPorts;
import br.com.fashionai.infrastructure.ai.ocr.OnnxTextReader;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Sonda do detector local de várias peças (RF4) com fotos reais, fora do repositório: roda só com
 * {@code -Dfai.probe.dir=<pasta com fotos>} e escreve, em {@code <pasta>/out}, um JSON por foto e a foto com as caixas
 * (pessoa: segmentador ONNX + faixas do corpo; superfície: regiões por contorno) e as linhas lidas pelo OCR em cada
 * recorte. Nada de rede; as fotos de teste não entram no repositório.
 */
class MultiPieceLocalProbeTest {
    @Test
    void probe() throws Exception {
        String dir = System.getProperty("fai.probe.dir");
        Assumptions.assumeTrue(dir != null && !dir.isBlank(), "defina -Dfai.probe.dir");
        Path out = Path.of(dir, "out");
        Files.createDirectories(out);
        OnnxPersonSegmenter segmenter = new OnnxPersonSegmenter();
        OnnxTextReader ocr = new OnnxTextReader();
        List<String> report = new ArrayList<>();
        try (Stream<Path> files = Files.list(Path.of(dir))) {
            for (Path f : files.filter(p -> p.toString().matches("(?i).*\\.(jpe?g|png|webp)$")).sorted().toList()) {
                long t0 = System.currentTimeMillis();
                BufferedImage img = ImageOps.decode(Files.readAllBytes(f));
                Optional<ImageSafetyPorts.ClassMap> map = segmenter.classes(img);
                List<WornPieceRegions.Worn> worn = map.map(m -> WornPieceRegions.detect(img, m)).orElse(List.of());
                List<LocalPieceRegions.Region> surface = worn.isEmpty() ? LocalPieceRegions.detect(img) : List.of();
                long t1 = System.currentTimeMillis();
                StringBuilder json = new StringBuilder("{\"file\":\"" + f.getFileName() + "\",\"width\":" + img.getWidth() + ",\"height\":" + img.getHeight()
                        + ",\"segmenter\":" + map.isPresent() + ",\"ms\":" + (t1 - t0) + ",\"worn\":[");
                BufferedImage overlay = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
                Graphics2D g = overlay.createGraphics();
                g.drawImage(img, 0, 0, null);
                g.setStroke(new BasicStroke(Math.max(3, img.getWidth() / 250f)));
                g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, Math.max(18, img.getWidth() / 40)));
                int i = 0;
                for (WornPieceRegions.Worn r : worn) {
                    String text = ocrText(ocr, crop(img, r.x(), r.y(), r.width(), r.height()));
                    json.append(i++ > 0 ? "," : "").append(String.format(Locale.ROOT,
                            "{\"kind\":\"%s\",\"box\":[%.1f,%.1f,%.1f,%.1f],\"rgb\":\"#%06x\",\"bottomFrac\":%.2f,\"coverage\":%.4f,\"ocr\":\"%s\"}",
                            r.kind(), r.x(), r.y(), r.width(), r.height(), r.rgb(), r.bottomFrac(), r.coverage(), text.replace("\"", "'")));
                    draw(g, img, r.x(), r.y(), r.width(), r.height(), r.rgb(), r.kind() + " " + text);
                }
                json.append("],\"surface\":[");
                i = 0;
                for (LocalPieceRegions.Region r : surface) {
                    json.append(i++ > 0 ? "," : "").append(String.format(Locale.ROOT, "{\"box\":[%.1f,%.1f,%.1f,%.1f],\"rgb\":\"#%06x\"}",
                            r.x(), r.y(), r.width(), r.height(), r.rgb()));
                    draw(g, img, r.x(), r.y(), r.width(), r.height(), r.rgb(), String.valueOf(i));
                }
                json.append("]}");
                g.dispose();
                String name = f.getFileName().toString().replaceAll("\\.[^.]+$", "");
                Files.write(out.resolve(name + ".json"), json.toString().getBytes());
                Files.write(out.resolve(name + "-caixas.jpg"), ImageOps.jpeg(overlay, 0.85f));
                report.add(json.toString());
                System.out.println(json);
            }
        }
        Files.write(out.resolve("resultado.json"), ("[" + String.join(",\n", report) + "]").getBytes());
    }

    private static String ocrText(TextReaderPort ocr, BufferedImage crop) {
        if (!ocr.available() || crop.getWidth() < 120 || crop.getHeight() < 120) {
            return "";
        }
        try {
            List<String> lines = new ArrayList<>();
            for (TextReaderPort.Line l : ocr.read(crop)) {
                if (l.confidence() >= 0.5 && l.text() != null && l.text().trim().length() >= 3) {
                    lines.add(l.text().trim() + String.format(Locale.ROOT, "(%.2f)", l.confidence()));
                }
            }
            return String.join(" | ", lines);
        } catch (RuntimeException ex) {
            return "ocr-erro: " + ex.getMessage();
        }
    }

    private static BufferedImage crop(BufferedImage img, double x, double y, double w, double h) {
        int x0 = (int) Math.max(0, x * img.getWidth() / 100), y0 = (int) Math.max(0, y * img.getHeight() / 100);
        int cw = (int) Math.min(img.getWidth() - x0, Math.ceil(w * img.getWidth() / 100)), ch = (int) Math.min(img.getHeight() - y0, Math.ceil(h * img.getHeight() / 100));
        return img.getSubimage(x0, y0, Math.max(1, cw), Math.max(1, ch));
    }

    private static void draw(Graphics2D g, BufferedImage img, double x, double y, double w, double h, int rgb, String label) {
        int x0 = (int) (x * img.getWidth() / 100), y0 = (int) (y * img.getHeight() / 100);
        int cw = (int) (w * img.getWidth() / 100), ch = (int) (h * img.getHeight() / 100);
        g.setColor(new Color(0, 230, 120));
        g.drawRect(x0, y0, cw, ch);
        g.setColor(new Color(rgb));
        g.fillRect(x0, y0, Math.max(24, img.getWidth() / 30), Math.max(24, img.getWidth() / 30));
        g.setColor(Color.BLACK);
        g.drawString(label, x0 + Math.max(28, img.getWidth() / 30) + 2, y0 + Math.max(20, img.getWidth() / 40));
    }
}
