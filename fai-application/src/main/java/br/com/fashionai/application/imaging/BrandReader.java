package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.repository.BrandRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RF4 — marca pelo texto do logo, lida no próprio servidor (OCR local, {@link TextReaderPort}). Procura primeiro na peça
 * inteira (logo grande no peito), depois em cada região ampliada (etiqueta da gola, peito, sub-retângulos da grade).
 * <ul>
 *   <li><b>confirmada</b> — o texto lido é uma marca do catálogo (igual, a uma letra de distância em nomes longos, ou
 *   sem a primeira/última letra — logo parcialmente escondido);</li>
 *   <li><b>possível</b> — palavra de logo (maiúsculas, 4+ letras, leitura firme) fora do catálogo: a pessoa confirma.</li>
 * </ul>
 */
@Component
public class BrandReader {
    private static final Logger log = LoggerFactory.getLogger(BrandReader.class);
    private static final Duration CATALOG_TTL = Duration.ofMinutes(10);
    /** Palavras que aparecem em estampa e etiqueta mas não são marca. */
    private static final Set<String> NOT_BRAND = Set.of("since", "the", "and", "official", "original", "originals", "collection",
            "limited", "edition", "classic", "made", "size", "cotton", "polyester", "wash", "care", "team", "club", "sport",
            "sports", "world", "brand", "paris", "london", "milano", "italy", "france", "usa", "new", "york", "city", "vintage",
            "premium", "quality", "authentic", "genuine", "established", "estd", "design", "designed", "registered", "number",
            "lot", "only", "love", "best", "free", "life", "style", "fashion", "wear", "apparel", "company", "athletic",
            "university", "college", "engineering", "school", "champions", "champion", "league", "rookie", "allstar",
            "good", "vibes", "vibe", "happy", "summer", "beach", "surf", "dream", "dreams", "cool", "peace", "just", "have",
            "your", "with", "from", "this", "that", "more", "less", "time", "wild", "girl", "girls", "boys", "baby", "star",
            "stars", "hello", "yeah", "crew", "gang", "squad", "mood", "weekend", "hustle", "energy", "positive", "stay",
            "keep", "calm", "never", "give", "better", "together", "smile", "sunshine", "tropical", "paradise", "vacation");

    public record Found(String brand, String region, String evidence, double confidence, boolean confirmed, double[] box) {
    }

    private final ObjectProvider<TextReaderPort> readers;
    private final ObjectProvider<BrandRepository> catalog;
    private volatile Map<String, String> keys = Map.of();
    private volatile Instant loadedAt = Instant.EPOCH;

    public BrandReader(ObjectProvider<TextReaderPort> readers, ObjectProvider<BrandRepository> catalog) {
        this.readers = readers;
        this.catalog = catalog;
    }

    public boolean available() {
        TextReaderPort r = readers.getIfAvailable();
        return r != null && r.available();
    }

    /**
     * @param piece   peça recortada (fundo transparente ou branco)
     * @param regions regiões onde procurar, além da peça inteira (caixa relativa 0–1)
     */
    public Optional<Found> find(BufferedImage piece, List<BrandRegions.Zone> regions) {
        TextReaderPort reader = readers.getIfAvailable();
        if (reader == null || !reader.available()) {
            return Optional.empty();
        }
        List<BrandRegions.Zone> views = new ArrayList<>();
        views.add(new BrandRegions.Zone("peca", new double[]{0, 0, 1, 1}));
        views.addAll(regions);
        Found possible = null;
        long started = System.nanoTime();
        for (BrandRegions.Zone z : views) {
            BufferedImage img = "peca".equals(z.id()) ? piece : BrandRegions.crop(piece, z, 768);
            for (TextReaderPort.Line line : reader.read(img)) {
                double[] box = toPiece(z.box(), line.box());
                Optional<String> brand = match(line.text());
                if (brand.isPresent() && line.confidence() >= 0.6) {
                    log.info("Marca lida no servidor: {} ({}, {} ms)", brand.get(), z.id(), (System.nanoTime() - started) / 1_000_000);
                    return Optional.of(new Found(brand.get(), z.id(), line.text(), line.confidence(), true, box));
                }
                if (possible == null) {
                    String word = wordmark(line);
                    if (word != null) {
                        possible = new Found(word, z.id(), line.text(), line.confidence(), false, box);
                    }
                }
            }
        }
        return Optional.ofNullable(possible);
    }

    /**
     * RF4 · OCR estratégico: todas as linhas lidas numa foto de texto (etiqueta, língua do tênis, verso do relógio,
     * haste dos óculos), para o parser de composição, tamanho e códigos. Vazio sem leitor local.
     */
    public List<TextReaderPort.Line> readAll(BufferedImage image) {
        TextReaderPort reader = readers.getIfAvailable();
        if (reader == null || !reader.available()) {
            return List.of();
        }
        return reader.read(image);
    }

    /** Marca do catálogo num texto qualquer (OCR de etiqueta, resposta da IA). */
    public Optional<String> brandIn(String text) {
        return text == null || text.isBlank() ? Optional.empty() : match(text);
    }

    /** Caixa do texto (relativa ao recorte) → relativa à peça. */
    static double[] toPiece(double[] zone, double[] inCrop) {
        if (inCrop == null) {
            return zone;
        }
        double zw = zone[2] - zone[0], zh = zone[3] - zone[1];
        return new double[]{zone[0] + inCrop[0] * zw, zone[1] + inCrop[1] * zh, zone[0] + inCrop[2] * zw, zone[1] + inCrop[3] * zh};
    }

    /** Marca do catálogo no texto lido: por palavra, por palavras vizinhas juntas, ou contida no texto sem espaços. */
    Optional<String> match(String text) {
        Map<String, String> k = keys();
        List<String> tokens = tokens(text);
        String joined = String.join("", tokens);
        String best = null;
        for (int i = 0; i < tokens.size(); i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = i; j < Math.min(tokens.size(), i + 3); j++) {
                sb.append(tokens.get(j));
                String hit = k.get(sb.toString());
                if (hit != null && sb.length() >= 3 && (best == null || hit.length() > best.length())) {
                    best = hit;
                }
            }
        }
        if (best != null) {
            return Optional.of(best);
        }
        for (Map.Entry<String, String> e : k.entrySet()) {
            String key = e.getKey();
            if (key.length() >= 5 && joined.contains(key)) {
                return Optional.of(e.getValue());
            }
            if (key.length() >= 6) {
                for (String t : tokens) {
                    if (t.length() >= 6 && t.charAt(0) == key.charAt(0) && Math.abs(t.length() - key.length()) <= 1 && distance(t, key) <= 1) {
                        return Optional.of(e.getValue());
                    }
                    // logo com a primeira ou a última letra escondida (dobra do tecido, borda da foto): "ACOSTE" → Lacoste
                    if (t.length() >= 5 && t.length() == key.length() - 1 && (key.endsWith(t) || key.startsWith(t))) {
                        return Optional.of(e.getValue());
                    }
                }
            }
        }
        return Optional.empty();
    }

    /** Palavra com cara de logo (maiúsculas, 4–16 letras, leitura firme, não é palavra comum de estampa). */
    static String wordmark(TextReaderPort.Line line) {
        if (line.confidence() < 0.9) {
            return null;
        }
        for (String raw : line.text().split("[^\\p{L}]+")) {
            if (raw.length() < 4 || raw.length() > 16 || !raw.equals(raw.toUpperCase(Locale.ROOT))) {
                continue;
            }
            String n = norm(raw);
            // frase colada pelo OCR ("GOODVIBESONLY") ou cortada pelo recorte ("DVIBES"): com uma palavra comum de
            // estampa dentro, não é logo (marca do catálogo já foi casada antes; aqui é só a sugestão "possível")
            boolean phrase = NOT_BRAND.stream().anyMatch(w -> w.length() >= 4 && n.contains(w));
            if (n.length() == raw.length() && !NOT_BRAND.contains(n) && !phrase) {
                return raw.charAt(0) + raw.substring(1).toLowerCase(Locale.ROOT);
            }
        }
        return null;
    }

    private Map<String, String> keys() {
        if (Duration.between(loadedAt, Instant.now()).compareTo(CATALOG_TTL) < 0 && !keys.isEmpty()) {
            return keys;
        }
        BrandRepository repo = catalog.getIfAvailable();
        if (repo == null) {
            return keys;
        }
        Map<String, String> m = new LinkedHashMap<>();
        try {
            for (Brand b : repo.findAllByOrderByName()) {
                String key = norm(b.getName());
                if (key.length() >= 3) {
                    m.putIfAbsent(key, b.getName());
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Catálogo de marcas indisponível para o OCR: {}", ex.getMessage());
            return keys;
        }
        keys = Map.copyOf(m);
        loadedAt = Instant.now();
        return keys;
    }

    /** Para testes: catálogo fixo. */
    void useCatalog(Map<String, String> fixed) {
        keys = Map.copyOf(fixed);
        loadedAt = Instant.now().plus(Duration.ofDays(365));
    }

    static String norm(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9&]", "");
    }

    static List<String> tokens(String text) {
        List<String> out = new ArrayList<>();
        for (String p : (text == null ? "" : text).split("[^\\p{L}\\p{N}&]+")) {
            String n = norm(p);
            if (!n.isEmpty()) {
                out.add(n);
            }
        }
        return out;
    }

    static int distance(String a, String b) {
        int[] prev = new int[b.length() + 1], cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()];
    }
}
