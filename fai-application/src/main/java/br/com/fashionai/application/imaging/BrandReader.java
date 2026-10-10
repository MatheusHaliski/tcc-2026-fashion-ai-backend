package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.repository.BrandRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RF4 — marca pelo texto do logo, lida no próprio servidor (OCR local, {@link TextReaderPort}). Procura primeiro na peça
 * inteira (logo grande no peito), depois em cada região ampliada (etiqueta da gola, peito, sub-retângulos da grade).
 * <ul>
 *   <li><b>confirmada</b> — o texto lido é uma marca do catálogo (igual, a uma letra de distância em nomes longos, sem a
 *   primeira/última letra — logo parcialmente escondido — ou duas palavras distintas da mesma marca lidas em separado);</li>
 *   <li><b>possível</b> — uma palavra só de uma marca com várias palavras ("UNDER" de Under Armour), leituras parciais que
 *   votam na mesma marca do catálogo (tecido dobrado) ou palavra de logo fora do catálogo: a pessoa confirma;</li>
 *   <li><b>ilegível</b> — há texto na peça mas nada casou ({@code brand} nulo): a tela pede a marca ou outra foto.</li>
 * </ul>
 * <p>{@link #findRobust} é a leitura em tecido dobrado/amassado: além da leitura normal, cada zona do peito é detectada
 * também com a polaridade invertida (letra clara sobre faixa escura) e cada caixa de texto achada é reconhecida de novo
 * em variações baratas (só o reconhecedor, sem detector): normal e invertida, inclinada ±{@value #ROTATION_DEG}° (a
 * dobra inclina a linha) e, nas caixas altas, a metade de cima e a de baixo (duas linhas do logo que o detector juntou).
 * As leituras de todas as variações votam no catálogo; nada é preenchido sozinho sem confirmação do catálogo.
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
            "keep", "calm", "never", "give", "better", "together", "smile", "sunshine", "tropical", "paradise", "vacation",
            "american", "republic", "national", "international");

    /** Inclinação (graus) das leituras extras: a dobra do tecido inclina a linha do logo. */
    static final int ROTATION_DEG = 8;
    /** Lado maior (px) do recorte da zona nas leituras extras: letras pequenas ampliadas antes do OCR. */
    static final int ROBUST_SIZE = 768;
    /** Tempo máximo (ms) das leituras extras por peça — detecção de várias peças não pode esperar o OCR para sempre. */
    static final long ROBUST_BUDGET_MS = 6_000;
    /** Caixas de texto por zona que recebem as variações de reconhecimento. */
    static final int MAX_BOXES_PER_ZONE = 6;
    /** Confiança mínima de uma linha para os seus pedaços votarem no catálogo. */
    static final double VOTE_MIN_CONF = 0.35;
    /** Semelhança mínima pedaço × palavra da marca para votar; "forte" é a que sozinha já sugere a marca. */
    static final double VOTE_MIN_SIMILARITY = 0.5, VOTE_STRONG_SIMILARITY = 0.6;
    /** Soma mínima dos votos (semelhança × confiança) e vantagem mínima sobre a segunda marca para sugerir a primeira. */
    static final double VOTE_MIN_TOTAL = 0.9, VOTE_LEAD = 1.3;
    /** Caixa alta assim (altura/largura) com pelo menos esta altura em px tem duas linhas juntas: lê cada metade. */
    static final double TALL_BOX = 0.45;
    static final int TALL_MIN_PX = 24;

    /**
     * @param brand        marca (nome do catálogo ou palavra de logo); nula = texto achado mas ilegível
     * @param region       zona em que foi lida ("peca" = peça inteira)
     * @param evidence     texto lido
     * @param confirmed    marca do catálogo com certeza; falsa = a pessoa confirma
     * @param box          caixa relativa à peça (0–1)
     * @param alternatives outras marcas do catálogo em que as leituras também votaram (a pessoa escolhe)
     */
    public record Found(String brand, String region, String evidence, double confidence, boolean confirmed, double[] box,
                        List<String> alternatives) {
        public Found {
            alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        }

        public Found(String brand, String region, String evidence, double confidence, boolean confirmed, double[] box) {
            this(brand, region, evidence, confidence, confirmed, box, List.of());
        }
    }

    /**
     * Uma linha lida numa zona, numa variação da imagem (normal, invertida, inclinada, metade de caixa alta).
     *
     * @param box      caixa relativa à peça
     * @param detected veio do detector de texto (não só do reconhecedor numa caixa já achada)
     */
    record Reading(BrandRegions.Zone zone, TextReaderPort.Line line, String variant, double[] box, boolean detected) {
    }

    /** Recorte de uma caixa de texto numa variação, com a caixa (relativa ao recorte da zona) que ele cobre. */
    record LineCrop(String variant, BufferedImage image, double[] box) {
    }

    private final ObjectProvider<TextReaderPort> readers;
    private final ObjectProvider<BrandRepository> catalog;
    private volatile Map<String, String> keys = Map.of();
    private volatile Map<String, List<String>> words = Map.of();
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
     * Leitura normal: peça inteira e cada zona ampliada, na posição em que está.
     *
     * @param piece   peça recortada (fundo transparente ou branco)
     * @param regions regiões onde procurar, além da peça inteira (caixa relativa 0–1)
     */
    public Optional<Found> find(BufferedImage piece, List<BrandRegions.Zone> regions) {
        return scan(piece, regions, false);
    }

    /**
     * Leitura em tecido dobrado/amassado (RF4): a leitura normal e, se ela não confirmar a marca, as variações de cada zona
     * do peito (ampliada, invertida, inclinada, caixas altas em duas linhas), com os pedaços lidos votando no catálogo.
     * Custa até {@value #ROBUST_BUDGET_MS} ms a mais por peça; use só nas peças maiores da foto.
     */
    public Optional<Found> findRobust(BufferedImage piece, List<BrandRegions.Zone> regions) {
        return scan(piece, regions, true);
    }

    private Optional<Found> scan(BufferedImage piece, List<BrandRegions.Zone> regions, boolean robust) {
        TextReaderPort reader = readers.getIfAvailable();
        if (reader == null || !reader.available()) {
            return Optional.empty();
        }
        long started = System.nanoTime();
        List<BrandRegions.Zone> views = new ArrayList<>();
        views.add(new BrandRegions.Zone("peca", new double[]{0, 0, 1, 1}));
        views.addAll(regions);
        List<Reading> readings = new ArrayList<>();
        for (BrandRegions.Zone z : views) {
            BufferedImage img = "peca".equals(z.id()) ? piece : BrandRegions.crop(piece, z, ROBUST_SIZE);
            List<Reading> here = new ArrayList<>();
            for (TextReaderPort.Line line : reader.read(img)) {
                here.add(new Reading(z, line, "normal", toPiece(z.box(), line.box()), true));
            }
            readings.addAll(here);
            Optional<Found> sure = confirmedIn(here, robust);
            if (sure.isPresent()) {
                log.info("Marca lida no servidor: {} ({}, {} ms)", sure.get().brand(), z.id(), ms(started));
                return sure;
            }
        }
        if (robust) {
            for (BrandRegions.Zone z : robustZones(regions)) {
                if (ms(started) > ROBUST_BUDGET_MS) {
                    log.debug("Leitura robusta da marca interrompida pelo tempo ({} ms)", ms(started));
                    break;
                }
                BufferedImage base = BrandRegions.crop(piece, z, ROBUST_SIZE);
                BufferedImage inverted = invert(base);
                List<double[]> boxes = new ArrayList<>();
                for (Reading r : readings) {
                    if (r.zone() == z && r.detected() && r.line().box() != null) {
                        boxes.add(r.line().box());
                    }
                }
                // detector na polaridade invertida: a linha clara sobre a faixa escura que o detector normal não vê
                List<Reading> here = new ArrayList<>();
                for (TextReaderPort.Line line : reader.read(inverted)) {
                    here.add(new Reading(z, line, "invertida", toPiece(z.box(), line.box()), true));
                    if (line.box() != null && boxes.stream().noneMatch(b -> overlap(b, line.box()) > 0.5)) {
                        boxes.add(line.box());
                    }
                }
                readings.addAll(here);
                Optional<Found> sure = confirmedIn(here, true);
                if (sure.isPresent()) {
                    log.info("Marca lida no servidor em tecido dobrado: {} ({}, invertida, {} ms)", sure.get().brand(), z.id(), ms(started));
                    return sure;
                }
                // cada caixa achada, reconhecida de novo nas variações (sem detector: barato)
                int n = 0;
                for (double[] b : boxes) {
                    if (n++ >= MAX_BOXES_PER_ZONE || ms(started) > ROBUST_BUDGET_MS) {
                        break;
                    }
                    List<Reading> variants = new ArrayList<>();
                    for (LineCrop v : lineVariants(base, inverted, b)) {
                        reader.recognize(v.image()).ifPresent(l -> variants.add(new Reading(z,
                                new TextReaderPort.Line(l.text(), l.confidence(), v.box()), v.variant(), toPiece(z.box(), v.box()), false)));
                    }
                    readings.addAll(variants);
                    sure = confirmedIn(variants, true);
                    if (sure.isPresent()) {
                        log.info("Marca lida no servidor em tecido dobrado: {} ({}, {}, {} ms)", sure.get().brand(), z.id(), sure.get().evidence(), ms(started));
                        return sure;
                    }
                }
            }
        }
        if (log.isDebugEnabled()) {
            for (Reading r : readings) {
                log.debug("OCR {} {} [{}] '{}' {}", r.zone().id(), r.variant(), r.detected() ? "det" : "rec", r.line().text(),
                        String.format(Locale.ROOT, "%.2f", r.line().confidence()));
            }
        }
        Optional<Found> out = decide(readings, robust);
        out.ifPresent(f -> log.info("Marca {} no servidor: {} ({}, {} ms)", f.confirmed() ? "lida" : f.brand() == null ? "ilegível" : "possível",
                f.brand(), f.region(), ms(started)));
        return out;
    }

    private static long ms(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    /** Zonas que valem a leitura extra: o peito (e o centro/logo das outras categorias); nunca a gola (etiqueta interna). */
    static List<BrandRegions.Zone> robustZones(List<BrandRegions.Zone> regions) {
        List<BrandRegions.Zone> out = new ArrayList<>();
        for (BrandRegions.Zone z : regions) {
            String id = z.id();
            if (id.startsWith("centro") || id.equals("logo")) {
                out.add(0, z);
            } else if (id.startsWith("peito") || id.startsWith("quadril") || id.startsWith("lateral") || id.startsWith("cano")) {
                out.add(z);
            }
        }
        if (out.isEmpty()) {
            out.addAll(regions.subList(0, Math.min(3, regions.size())));
        }
        return out.subList(0, Math.min(3, out.size()));
    }

    /** Interseção sobre união de duas caixas relativas (x0, y0, x1, y1). */
    static double overlap(double[] a, double[] b) {
        double ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
        double iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        double inter = ix * iy;
        double union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
        return union <= 0 ? 0 : inter / union;
    }

    /**
     * Variações de uma caixa de texto (caixa relativa ao recorte da zona) para o reconhecedor: normal e invertida, cada
     * uma reta e inclinada ±{@value #ROTATION_DEG}°; caixa alta (altura > {@value #TALL_BOX} da largura, duas linhas
     * juntas) também a metade de cima e a de baixo, nas duas polaridades.
     */
    static List<LineCrop> lineVariants(BufferedImage base, BufferedImage inverted, double[] box) {
        List<LineCrop> out = new ArrayList<>();
        int w = base.getWidth(), h = base.getHeight();
        int x0 = (int) Math.floor(box[0] * w), y0 = (int) Math.floor(box[1] * h);
        int x1 = (int) Math.ceil(box[2] * w), y1 = (int) Math.ceil(box[3] * h);
        int bw = x1 - x0, bh = y1 - y0;
        if (bw < 4 || bh < 4) {
            return out;
        }
        int pad = Math.max(2, bh / 8);
        for (boolean inv : new boolean[]{false, true}) {
            BufferedImage src = inv ? inverted : base;
            String tag = inv ? "-inv" : "";
            BufferedImage line = cut(src, x0 - pad, y0 - pad, bw + 2 * pad, bh + 2 * pad);
            out.add(new LineCrop("linha" + tag, line, box));
            out.add(new LineCrop("linha+" + ROTATION_DEG + tag, onWhite(ImageOps.rotate(line, ROTATION_DEG)), box));
            out.add(new LineCrop("linha-" + ROTATION_DEG + tag, onWhite(ImageOps.rotate(line, -ROTATION_DEG)), box));
            if (bh > bw * TALL_BOX && bh >= TALL_MIN_PX) {
                int half = bh / 2;
                double my = (box[1] + box[3]) / 2;
                out.add(new LineCrop("metade-cima" + tag, cut(src, x0 - pad, y0 - pad, bw + 2 * pad, half + 2 * pad), new double[]{box[0], box[1], box[2], my}));
                out.add(new LineCrop("metade-baixo" + tag, cut(src, x0 - pad, y0 + half - pad, bw + 2 * pad, bh - half + 2 * pad), new double[]{box[0], my, box[2], box[3]}));
            }
        }
        return out;
    }

    /** Recorte RGB sobre branco, preso dentro da imagem. */
    static BufferedImage cut(BufferedImage src, int x, int y, int w, int h) {
        int x0 = Math.max(0, x), y0 = Math.max(0, y);
        int x1 = Math.min(src.getWidth(), x + w), y1 = Math.min(src.getHeight(), y + h);
        return onWhite(src.getSubimage(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)));
    }

    /** Polaridade invertida: letra clara sobre faixa escura vira letra escura sobre claro, como o OCR espera. */
    static BufferedImage invert(BufferedImage src) {
        BufferedImage base = onWhite(src);
        int w = base.getWidth(), h = base.getHeight();
        int[] px = base.getRGB(0, 0, w, h, null, 0, w);
        for (int i = 0; i < px.length; i++) {
            px[i] = ~px[i] & 0xFFFFFF;
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        return out;
    }

    /** Imagem RGB sobre branco (os cantos da rotação e o fundo transparente da peça ficam brancos). */
    static BufferedImage onWhite(BufferedImage src) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    /**
     * Marca confirmada nas leituras de uma passagem: uma linha que casa com o catálogo; as linhas juntas em ordem de
     * leitura (logo em duas linhas: "UNDER" + "ARMOUR"); ou uma palavra distintiva (7+ letras) de uma marca de várias
     * palavras ("HILFIGER").
     */
    private Optional<Found> confirmedIn(List<Reading> here, boolean joinLines) {
        for (Reading r : here) {
            if (r.line().confidence() < 0.6) {
                continue;
            }
            Optional<String> brand = match(r.line().text());
            if (brand.isPresent()) {
                return Optional.of(new Found(brand.get(), r.zone().id(), r.line().text(), r.line().confidence(), true, r.box()));
            }
            WordHit hit = wordHit(r.line().text());
            if (hit != null && hit.distinctive()) {
                return Optional.of(new Found(hit.brands().get(0), r.zone().id(), r.line().text(), r.line().confidence(), true, r.box(),
                        hit.brands().subList(1, hit.brands().size())));
            }
        }
        if (joinLines && here.size() >= 2) {
            List<Reading> firm = here.stream().filter(r -> r.line().confidence() >= 0.6)
                    .sorted(Comparator.comparingDouble(r -> r.line().box() == null ? 0 : r.line().box()[1])).toList();
            if (firm.size() >= 2) {
                StringBuilder sb = new StringBuilder();
                double conf = 1;
                for (Reading r : firm) {
                    sb.append(sb.length() > 0 ? " " : "").append(r.line().text());
                    conf = Math.min(conf, r.line().confidence());
                }
                Optional<String> brand = match(sb.toString());
                if (brand.isPresent()) {
                    return Optional.of(new Found(brand.get(), firm.get(0).zone().id(), sb.toString(), conf, true, firm.get(0).box()));
                }
            }
        }
        return Optional.empty();
    }

    /** Votos de uma marca do catálogo: soma de semelhança × confiança, quantas leituras, palavras inteiras lidas. */
    private static final class Tally {
        double score;
        int count;
        boolean strong;
        double bestWeight = -1;
        Reading best;
        final LinkedHashSet<String> evidence = new LinkedHashSet<>();
        final Set<String> words = new LinkedHashSet<>();

        void add(Reading r, String token, String letters, double similarity) {
            double weight = similarity * r.line().confidence();
            score += weight;
            count++;
            strong |= similarity >= VOTE_STRONG_SIMILARITY;
            evidence.add(token.toUpperCase(Locale.ROOT));
            if (similarity >= 1.0) {
                words.add(letters);
            }
            if (weight > bestWeight) {
                bestWeight = weight;
                best = r;
            }
        }
    }

    /**
     * Sem confirmação: decide entre <i>confirmada</i> (duas palavras distintas da mesma marca lidas em separado — as duas
     * linhas do logo), <i>possível</i> (uma palavra inteira de marca de várias palavras; no modo robusto, leituras parciais
     * que votam na mesma marca; palavra de logo fora do catálogo), <i>ilegível</i> (texto firme que não casou, só no modo
     * robusto) ou nada.
     */
    private Optional<Found> decide(List<Reading> readings, boolean robust) {
        Map<String, String> k = keys();
        Map<String, List<String>> w = words;
        Map<String, Tally> votes = new HashMap<>();
        for (Reading r : readings) {
            if (r.line().confidence() < VOTE_MIN_CONF) {
                continue;
            }
            for (String t : tokens(r.line().text())) {
                String letters = t.replaceAll("[^a-z]", "");
                if (letters.length() < 4 || NOT_BRAND.contains(letters)) {
                    continue;
                }
                Map<String, Double> perBrand = new HashMap<>();
                List<String> whole = w.get(letters);
                if (whole != null && r.line().confidence() >= 0.5) {
                    for (String b : whole) {
                        perBrand.put(b, 1.0);
                    }
                } else if (robust) {
                    for (Map.Entry<String, String> e : k.entrySet()) {
                        double s = similarity(letters, e.getKey());
                        for (String bw : brandWords(e.getValue())) {
                            s = Math.max(s, similarity(letters, bw));
                        }
                        if (s >= VOTE_MIN_SIMILARITY) {
                            perBrand.merge(e.getValue(), s, Math::max);
                        }
                    }
                }
                for (Map.Entry<String, Double> e : perBrand.entrySet()) {
                    votes.computeIfAbsent(e.getKey(), x -> new Tally()).add(r, t, letters, e.getValue());
                }
            }
        }
        List<Map.Entry<String, Tally>> ranked = votes.entrySet().stream()
                .sorted(Comparator.comparingDouble((Map.Entry<String, Tally> e) -> e.getValue().score).reversed()).toList();
        if (!ranked.isEmpty()) {
            String brand = ranked.get(0).getKey();
            Tally v = ranked.get(0).getValue();
            List<String> others = ranked.stream().skip(1).filter(e -> e.getValue().strong && e.getValue().score >= 0.5 * v.score)
                    .limit(2).map(Map.Entry::getKey).toList();
            String evidence = String.join(" ", v.evidence.stream().limit(4).toList());
            double conf = Math.min(0.95, v.score / v.count);
            if (v.words.size() >= 2) {
                return Optional.of(new Found(brand, v.best.zone().id(), evidence, conf, true, v.best.box(), others));
            }
            double second = ranked.size() > 1 ? ranked.get(1).getValue().score : 0;
            boolean lead = second == 0 || v.score >= VOTE_LEAD * second;
            if (!v.words.isEmpty() || (robust && v.strong && v.count >= 2 && v.score >= VOTE_MIN_TOTAL && lead)) {
                return Optional.of(new Found(brand, v.best.zone().id(), evidence, conf, false, v.best.box(), others));
            }
        }
        Reading firm = null;
        for (Reading r : readings) {
            String word = wordmark(r.line());
            if (word != null) {
                return Optional.of(new Found(word, r.zone().id(), r.line().text(), r.line().confidence(), false, r.box()));
            }
            if (firm == null && r.detected() && r.line().confidence() >= 0.3
                    && tokens(r.line().text()).stream().anyMatch(t -> t.replaceAll("[^a-z]", "").length() >= 3)) {
                firm = r;
            }
        }
        if (firm != null && robust) {
            return Optional.of(new Found(null, firm.zone().id(), firm.line().text(), firm.line().confidence(), false, firm.box()));
        }
        return Optional.empty();
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

    /** Uma palavra inteira de marca(s) de várias palavras lida no texto; distintiva = 7+ letras (confirma sozinha). */
    record WordHit(String word, List<String> brands, boolean distinctive) {
    }

    WordHit wordHit(String text) {
        keys();
        Map<String, List<String>> w = words;
        WordHit best = null;
        for (String t : tokens(text)) {
            List<String> brands = w.get(t);
            if (brands == null) {
                continue;
            }
            WordHit hit = new WordHit(t, brands, t.length() >= 7 && brands.size() == 1);
            if (best == null || (hit.distinctive() && !best.distinctive()) || t.length() > best.word().length()) {
                best = hit;
            }
        }
        return best;
    }

    /**
     * Semelhança 0–1 entre um pedaço lido e uma palavra da marca: 1 − distância/comprimento; pedaço mais curto que a
     * palavra também é comparado com o começo e com o fim dela (a dobra esconde o fim ou o começo), com 10% de desconto.
     */
    static double similarity(String token, String word) {
        if (token == null || word == null || token.isEmpty() || word.isEmpty()) {
            return 0;
        }
        double best = 1 - distance(token, word) / (double) Math.max(token.length(), word.length());
        int n = token.length();
        if (n >= 4 && n < word.length()) {
            best = Math.max(best, 0.9 * (1 - distance(token, word.substring(0, n)) / (double) n));
            best = Math.max(best, 0.9 * (1 - distance(token, word.substring(word.length() - n)) / (double) n));
        }
        return Math.max(0, best);
    }

    /** Palavras (4+ letras, normalizadas) do nome da marca: "Under Armour" → under, armour. */
    static List<String> brandWords(String name) {
        List<String> out = new ArrayList<>();
        for (String p : (name == null ? "" : name).split("[^\\p{L}]+")) {
            String n = norm(p);
            if (n.length() >= 4 && !out.contains(n)) {
                out.add(n);
            }
        }
        return out;
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
        install(m);
        return keys;
    }

    /** Catálogo em uso + índice palavra → marcas de várias palavras que a contêm (5+ letras, fora das palavras comuns). */
    private void install(Map<String, String> fixed) {
        Map<String, List<String>> index = new HashMap<>();
        for (String name : fixed.values()) {
            List<String> bw = brandWords(name);
            if (bw.size() < 2) {
                continue;
            }
            for (String word : bw) {
                if (word.length() >= 5 && !NOT_BRAND.contains(word) && !fixed.containsKey(word)) {
                    index.computeIfAbsent(word, x -> new ArrayList<>()).add(name);
                }
            }
        }
        Map<String, List<String>> frozen = new HashMap<>();
        index.forEach((word, names) -> frozen.put(word, List.copyOf(names)));
        keys = Map.copyOf(fixed);
        words = Map.copyOf(frozen);
        loadedAt = Instant.now();
    }

    /** Para testes e sondas: catálogo fixo (chave normalizada → nome), sem repositório. */
    public void useCatalog(Map<String, String> fixed) {
        install(fixed);
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
