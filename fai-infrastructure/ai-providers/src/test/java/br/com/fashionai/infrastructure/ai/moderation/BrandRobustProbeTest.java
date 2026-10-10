package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalPieceRegions;
import br.com.fashionai.application.imaging.TextReaderPort;
import br.com.fashionai.application.imaging.WornPieceRegions;
import br.com.fashionai.application.moderation.ImageSafetyPorts;
import br.com.fashionai.infrastructure.ai.ocr.OnnxTextReader;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Sonda da leitura de marca em tecido dobrado (RF4, fora do repositório; -Dfai.probe.dir): para as 3 maiores peças de
 * cada foto (vestidas ou sobre a superfície), o que {@link BrandReader#findRobust} devolve com um catálogo fixo de
 * marcas, e quanto tempo leva. Escreve {@code <dir>/out/marcas.txt}. Nada de rede.
 */
class BrandRobustProbeTest {
    static final List<String> CATALOG = List.of("Under Armour", "Nike", "Adidas", "Puma", "Lacoste", "Polo Ralph Lauren",
            "Tommy Hilfiger", "Calvin Klein", "Hering", "Reserva", "Oakley", "Quiksilver", "Billabong", "Levi's", "Gap", "Vans",
            "Converse", "New Balance", "Asics", "Mizuno", "Olympikus", "Fila", "Umbro", "Kappa", "Hurley", "Rip Curl", "Osklen",
            "Colcci", "Forum", "Zara", "H&M", "C&A", "Renner", "Riachuelo", "The North Face", "Columbia", "Patagonia", "Hollister",
            "Abercrombie & Fitch", "American Eagle", "Banana Republic", "Guess", "Diesel", "Armani", "Hugo Boss", "Gucci",
            "Prada", "Burberry", "Champion", "Element", "Volcom", "DC Shoes", "Mormaii", "Aramis", "Dudalina", "Ellus",
            "John John", "Richards", "Vila Romana", "Le Lis Blanc", "Farm", "Animale", "Carhartt", "Dickies", "Superdry",
            "Jack & Jones", "Pull & Bear", "Bershka", "Stradivarius", "Uniqlo", "Everlast", "Penalty", "Topper", "Rainha");

    @Test
    void robust() throws Exception {
        String dir = System.getProperty("fai.probe.dir");
        Assumptions.assumeTrue(dir != null && !dir.isBlank());
        Path out = Path.of(dir, "out");
        Files.createDirectories(out);
        if (System.getProperty("fai.probe.debug") != null) {
            ((ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(BrandReader.class)).setLevel(ch.qos.logback.classic.Level.DEBUG);
        }
        OnnxPersonSegmenter seg = new OnnxPersonSegmenter();
        OnnxTextReader ocr = new OnnxTextReader();
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("ocr", (TextReaderPort) ocr);
        BrandReader reader = new BrandReader(beans.getBeanProvider(TextReaderPort.class), beans.getBeanProvider(br.com.fashionai.domain.repository.BrandRepository.class));
        Map<String, String> keys = new LinkedHashMap<>();
        for (String b : CATALOG) keys.put(b.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9&]", ""), b);
        reader.useCatalog(keys);
        List<String> report = new ArrayList<>();
        for (Path f : Files.list(Path.of(dir)).filter(p -> p.toString().matches("(?i).*\\.(jpe?g|png)$")).sorted().toList()) {
            BufferedImage img = ImageOps.decode(Files.readAllBytes(f));
            Optional<ImageSafetyPorts.ClassMap> map = seg.classes(img);
            List<double[]> boxes = new ArrayList<>();
            List<String> cats = new ArrayList<>();
            List<WornPieceRegions.Worn> worn = map.map(m -> WornPieceRegions.detect(img, m)).orElse(List.of());
            for (WornPieceRegions.Worn w : worn) {
                boxes.add(new double[]{w.x(), w.y(), w.width(), w.height()});
                cats.add(switch (w.kind()) { case UPPER, FULL -> "upper_piece"; case LOWER -> "lower_piece"; case SHOES -> "shoes_piece"; default -> "accessory_piece"; });
            }
            if (worn.isEmpty()) {
                for (LocalPieceRegions.Region r : LocalPieceRegions.detect(img)) {
                    boxes.add(new double[]{r.x(), r.y(), r.width(), r.height()});
                    cats.add("upper_piece");
                }
            }
            // as 3 maiores, como o serviço
            List<Integer> order = new ArrayList<>();
            for (int i = 0; i < boxes.size(); i++) order.add(i);
            order.sort((a, b) -> Double.compare(boxes.get(b)[2] * boxes.get(b)[3], boxes.get(a)[2] * boxes.get(a)[3]));
            for (int i : order.subList(0, Math.min(3, order.size()))) {
                double[] b = boxes.get(i);
                int x0 = (int) (b[0] * img.getWidth() / 100), y0 = (int) (b[1] * img.getHeight() / 100);
                int cw = (int) Math.min(img.getWidth() - x0, Math.ceil(b[2] * img.getWidth() / 100)), ch = (int) Math.min(img.getHeight() - y0, Math.ceil(b[3] * img.getHeight() / 100));
                if (cw < 120 || ch < 120) continue;
                BufferedImage crop = img.getSubimage(x0, y0, cw, ch);
                List<BrandRegions.Zone> zones = BrandRegions.zones(crop, cats.get(i));
                long t0 = System.currentTimeMillis();
                Optional<BrandReader.Found> plain = reader.find(crop, zones);
                long t1 = System.currentTimeMillis();
                Optional<BrandReader.Found> robust = reader.findRobust(crop, zones);
                long t2 = System.currentTimeMillis();
                String line = String.format(Locale.ROOT, "%s peça %d (%s %dx%d): normal=%s (%d ms) | robusta=%s (%d ms)", f.getFileName(), i, cats.get(i), cw, ch,
                        plain.map(BrandRobustProbeTest::fmt).orElse("-"), t1 - t0, robust.map(BrandRobustProbeTest::fmt).orElse("-"), t2 - t1);
                System.out.println("### " + line);
                report.add(line);
            }
        }
        Files.write(out.resolve("marcas.txt"), String.join("\n", report).getBytes());
    }

    static String fmt(BrandReader.Found f) {
        return String.format(Locale.ROOT, "%s[%s conf=%.2f zona=%s lido='%s' alt=%s]", f.brand(), f.confirmed() ? "confirmada" : f.brand() == null ? "ilegível" : "possível",
                f.confidence(), f.region(), f.evidence(), f.alternatives());
    }
}
