package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandLogo;
import br.com.fashionai.domain.repository.BrandLogoRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Logos de marca procurados na internet pela IA do sistema e usados em qualquer tela que mostre uma marca (peças,
 * busca, marcas, explorador, dashboard, DNA, cards). Ordem de busca, da fonte mais confiável para a menos:
 * <ol>
 *   <li>logo já enviado pelo perfil de marca ou guardado no catálogo (storage próprio);</li>
 *   <li>Wikidata: item da marca de moda → logo oficial (P154) renderizado em PNG pelo Wikimedia Commons, e o site
 *       oficial (P856);</li>
 *   <li>IA (Claude com a ferramenta de busca na web): encontra o site oficial e a URL do logo; a URL é baixada e
 *       validada aqui, nunca exibida direto;</li>
 *   <li>ícone do site oficial (apple-touch-icon / serviço de favicons);</li>
 *   <li>sem fonte confiável: monograma (iniciais + cor estável) e nova tentativa depois de {@link #RETRY_AFTER}.</li>
 * </ol>
 * O arquivo baixado vai para o storage próprio: a interface nunca depende de hotlink para terceiros.
 * <p>
 * Custo: visitante (sem login) só lê o que já está no cache — nunca dispara busca nem grava linha. A busca síncrona
 * roda em nome de quem pediu (cota por usuário e teto de gasto do motor de IA); o job de pendentes roda como sistema
 * e cai só no teto global. O logo global de uma marca só muda por resultado que o próprio servidor buscou, pelo admin
 * ou pela conta de marca aprovada — nunca pela URL que um usuário mandou numa peça.
 */
@Service
public class BrandLogoService {
    private static final Logger log = LoggerFactory.getLogger(BrandLogoService.class);
    public static final Duration RETRY_AFTER = Duration.ofDays(3);
    static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    static final int MAX_BATCH = 40;
    static final Pattern FASHION = Pattern.compile("(?i)fashion|cloth|apparel|wear|garment|retail|footwear|shoe|sneaker|luxury|jewel|"
            + "handbag|leather|denim|jeans|textile|brand|company|designer|couture|cosmetic|moda|roupa|vestu|cal[cç]ad|joia|marca|varej|grife");
    private static final String[] PALETTE = {"#1F7A76", "#C6275E", "#B8862B", "#5B6B7A", "#7C5FC0", "#2F3E46", "#D2691E", "#3B6EA8"};

    private final BrandLogoRepository logos;
    private final BrandRepository catalog;
    private final WardrobeItemRepository pieces;
    private final WebFetchPort web;
    private final MediaService media;
    private final MediaStoragePort storage;
    private final AiEngine ai;
    private final TransactionTemplate tx;
    private final Map<String, Object> locks = new ConcurrentHashMap<>();

    public BrandLogoService(BrandLogoRepository logos, BrandRepository catalog, WardrobeItemRepository pieces, WebFetchPort web,
                            MediaService media, MediaStoragePort storage, AiEngine ai, TransactionTemplate tx) {
        this.logos = logos;
        this.catalog = catalog;
        this.pieces = pieces;
        this.web = web;
        this.media = media;
        this.storage = storage;
        this.ai = ai;
        this.tx = tx;
    }

    // ================================================================== API

    /** Visitante: só o que já está no cache (ou o monograma); nada é buscado nem gravado. */
    public Map<String, Object> cached(String rawName) {
        String key = keyOf(rawName);
        return view(key.isEmpty() ? null : logos.findByNameKey(key).orElse(null), rawName);
    }

    /**
     * Logo de uma marca para quem está logado (procura na internet se ainda não houver um ou se o monograma já venceu).
     * A busca com IA roda em nome de {@code userId}: conta na cota diária e no teto de gasto dele.
     */
    public Map<String, Object> logo(UUID userId, String rawName, boolean force) {
        String key = keyOf(rawName);
        if (key.isEmpty()) {
            return view(null, rawName);
        }
        BrandLogo cached = logos.findByNameKey(key).orElse(null);
        if (!force && cached != null && fresh(cached)) {
            return view(cached, rawName);
        }
        return view(resolve(userId, key, clean(rawName), force), rawName);
    }

    /**
     * Vários logos de uma vez (listas, grades, gráficos), no máximo {@link #MAX_BATCH} nomes. Visitante ({@code userId}
     * nulo): só o cache. Logado: até {@code syncBudget} buscas novas em nome dele; o resto entra na fila do job, mas só
     * marca que existe de verdade no sistema (catálogo ou peça pública) — nome inventado não vira linha pendente.
     */
    public Map<String, Map<String, Object>> batch(UUID userId, List<String> names, int syncBudget) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        Set<String> unique = new LinkedHashSet<>();
        for (String n : names == null ? List.<String>of() : names) {
            if (unique.size() >= MAX_BATCH) {
                break;
            }
            if (n != null && !keyOf(n).isEmpty()) {
                unique.add(clean(n));
            }
        }
        Map<String, BrandLogo> byKey = new LinkedHashMap<>();
        logos.findByNameKeyIn(unique.stream().map(BrandLogoService::keyOf).toList()).forEach(l -> byKey.put(l.getNameKey(), l));
        int budget = userId == null ? 0 : Math.max(0, syncBudget);
        for (String name : unique) {
            String key = keyOf(name);
            BrandLogo l = byKey.get(key);
            if (userId != null && (l == null || !fresh(l)) && budget > 0) {
                budget--;
                l = resolve(userId, key, name, false);
            } else if (userId != null && l == null && knownBrand(key, name)) {
                l = placeholder(key, name);
            }
            out.put(name, view(l, name));
        }
        return out;
    }

    /** A marca existe no sistema: está no catálogo ou em alguma peça pública e aprovada. */
    boolean knownBrand(String key, String name) {
        return catalogBrand(key).isPresent() || pieces.countPublicByBrandName(name) > 0;
    }

    /** Admin envia o logo certo (busca errada ou marca sem presença na internet): vira fonte MANUAL, confiança 1. */
    public Map<String, Object> manual(String rawName, byte[] bytes) {
        String key = keyOf(rawName);
        if (key.isEmpty()) {
            throw br.com.fashionai.application.common.ApiException.badRequest("MARCA_INVALIDA", Msg.t("brandLogo.informe_o_nome_da_marca"));
        }
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        BufferedImage fit = img.getWidth() > 256 || img.getHeight() > 256 ? ImageOps.scaleToFit(img, 256, 256) : img;
        MediaStoragePort.StoredObject o = media.put("brands/logos/" + key.replace(' ', '-') + "-manual-" + System.currentTimeMillis() + ".png",
                ImageOps.png(fit), "image/png");
        Found f = new Found(o.url(), "MANUAL", null, null, BigDecimal.ONE, null);
        return view(tx.execute(st -> persist(key, clean(rawName), f)), rawName);
    }

    /** Fontes de catálogo aberto cujo logo o próprio servidor baixou e filtrou no buscador web (RF4). */
    static final Set<String> TRUSTED_WEB_SOURCES = Set.of("WIKIDATA", "SIMPLE_ICONS");

    /**
     * RF4 — logo escolhido no buscador web (já filtrado: fundo branco, letras pretas) passa a ser o logo da marca em todas
     * as telas. Não sobrescreve logo enviado pela própria marca nem o corrigido pelo admin. Só vale o arquivo que o
     * próprio buscador gravou para essa marca a partir de catálogo aberto (Wikidata/Simple Icons): URL enviada pelo
     * cliente, arquivo de outra marca ou sugestão da IA (manipulável pelo texto da busca) ficam só na peça.
     */
    public void acceptWebLogo(String rawName, String url, String source, String domain, String originUrl) {
        String key = keyOf(rawName);
        if (key.isEmpty() || url == null || !serverFetchedLogo(key, url, source)) {
            return;
        }
        tx.executeWithoutResult(st -> {
            BrandLogo cur = logos.findByNameKey(key).orElse(null);
            if (cur != null && "FOUND".equals(cur.getStatus()) && ("PERFIL_MARCA".equals(cur.getSource()) || "MANUAL".equals(cur.getSource()))) {
                return;
            }
            BigDecimal conf = "WIKIDATA".equals(source) ? new BigDecimal("0.9500") : "SIMPLE_ICONS".equals(source) ? new BigDecimal("0.8500") : new BigDecimal("0.7000");
            persist(key, clean(rawName), new Found(url, source == null ? "WEB" : source, domain, originUrl, conf, null));
        });
    }

    /** O arquivo é o que o buscador web gravou para esta marca e esta fonte ({@code brands/logos/web/<marca>-<fonte>.png})? */
    boolean serverFetchedLogo(String key, String url, String source) {
        if (source == null || !TRUSTED_WEB_SOURCES.contains(source)) {
            return false;
        }
        String expected = "brands/logos/web/" + key.replace(' ', '-') + "-" + source.toLowerCase(Locale.ROOT).replace('_', '-');
        return storage.keyOf(url).map(k -> k.equals(expected + ".png") || k.equals(expected + "-faixa.png")).orElse(false);
    }

    /** Lista para o admin: o que foi encontrado, de onde e o que ainda é monograma. */
    public List<Map<String, Object>> all() {
        return logos.findAllByOrderByDisplayName().stream().map(l -> view(l, l.getDisplayName())).toList();
    }

    /** Job: marcas do catálogo sem logo e monogramas vencidos voltam para a busca, 15 por rodada. */
    @Scheduled(cron = "0 20 */2 * * *", zone = "America/Sao_Paulo")
    public int refreshPending() {
        int done = 0;
        for (Brand b : catalog.findAllByOrderByName()) {
            String key = keyOf(b.getName());
            if (!key.isEmpty() && logos.findByNameKey(key).isEmpty()) {
                placeholder(key, b.getName());
            }
        }
        // roda como sistema (sem usuário): a etapa de IA cai no teto global de gasto do motor e, estourado, fica local
        for (BrandLogo l : logos.findByStatusAndCheckedAtBeforeOrderByCheckedAt("GENERATED", Instant.now().minus(RETRY_AFTER), PageRequest.of(0, 15))) {
            resolve(null, l.getNameKey(), l.getDisplayName(), false);
            done++;
        }
        return done;
    }

    // ================================================================== resolução

    BrandLogo resolve(UUID userId, String key, String name, boolean force) {
        Object lock = locks.computeIfAbsent(key, k -> new Object());
        synchronized (lock) {
            try {
                BrandLogo existing = logos.findByNameKey(key).orElse(null);
                if (!force && existing != null && fresh(existing)) {
                    return existing;
                }
                Found found = search(userId, key, name);
                return tx.execute(s -> persist(key, name, found));
            } finally {
                locks.remove(key);
            }
        }
    }

    record Found(String url, String source, String domain, String originUrl, BigDecimal confidence, String error) {
    }

    Found search(UUID userId, String key, String name) {
        List<String> errors = new ArrayList<>();
        Brand brand = catalogBrand(key).orElse(null);
        String domain = brand == null ? null : domainOf(brand.getWebsite());

        // 1) logo já guardado no nosso storage (perfil de marca ou catálogo)
        if (brand != null && brand.getLogoUrl() != null && media.read(brand.getLogoUrl()).isPresent()) {
            return new Found(brand.getLogoUrl(), "PERFIL_MARCA", domain, brand.getLogoUrl(), BigDecimal.ONE, null);
        }
        // 2) Wikidata / Wikimedia Commons
        WikidataHit wd = wikidata(name);
        if (wd != null && wd.id() != null) {
            if (domain == null) {
                domain = wd.domain();
            }
            if (wd.logoFile() != null) {
                String url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + URLEncoder.encode(wd.logoFile().replace(' ', '_'), StandardCharsets.UTF_8)
                        .replace("+", "%20") + "?width=256";
                Optional<String> stored = download(key, url, "wikidata");
                if (stored.isPresent()) {
                    return new Found(stored.get(), "WIKIDATA", domain, url, new BigDecimal("0.9500"), null);
                }
                errors.add(Msg.t("brandLogo.logo_do_wikidata_nao_baixou"));
            }
        } else {
            errors.add(wd == null ? Msg.t("brandLogo.wikidata_inacessivel_rede") : Msg.t("brandLogo.wikidata_sem_item_de_moda"));
        }
        // 3) IA com busca na web
        AiHint hint = aiSearch(userId, name, domain);
        if (hint != null) {
            if (domain == null) {
                domain = hint.domain();
            }
            if (hint.logoUrl() != null && hint.confidence() >= 0.5) {
                Optional<String> stored = download(key, hint.logoUrl(), "ia");
                if (stored.isPresent()) {
                    return new Found(stored.get(), "IA_BUSCA_WEB", domain, hint.logoUrl(),
                            BigDecimal.valueOf(Math.min(0.99, hint.confidence())).setScale(4, java.math.RoundingMode.HALF_UP), null);
                }
                errors.add(Msg.t("brandLogo.url_sugerida_pela_ia_nao"));
            }
        } else {
            errors.add(Msg.t("brandLogo.ia_sem_resposta_sem_chave"));
        }
        // 4) ícone do site oficial
        if (domain != null) {
            for (String url : List.of("https://" + domain + "/apple-touch-icon.png",
                    "https://www.google.com/s2/favicons?domain=" + domain + "&sz=256",
                    "https://icons.duckduckgo.com/ip3/" + domain + ".ico")) {
                Optional<String> stored = download(key, url, "favicon");
                if (stored.isPresent()) {
                    return new Found(stored.get(), "FAVICON_SITE", domain, url, new BigDecimal("0.6000"), null);
                }
            }
            errors.add(Msg.t("brandLogo.site_sem_icone_utilizavel", domain));
        }
        return new Found(null, "MONOGRAMA", domain, null, null, String.join("; ", errors));
    }

    BrandLogo persist(String key, String name, Found f) {
        BrandLogo l = logos.findByNameKey(key).orElseGet(() -> new BrandLogo(key, name));
        l.setDisplayName(name);
        l.setAttempts(l.getAttempts() + 1);
        l.setCheckedAt(Instant.now());
        l.setDomain(f.domain());
        l.setLastError(f.error() == null ? null : f.error().substring(0, Math.min(500, f.error().length())));
        if (f.url() != null) {
            l.setLogoUrl(f.url());
            l.setStatus("FOUND");
            l.setSource(f.source());
            l.setOriginUrl(f.originUrl());
            l.setConfidence(f.confidence());
            catalogBrand(key).ifPresent(b -> {
                // o catálogo passa a apontar para o logo guardado (PieceView.brandLogoUrl e telas de marca)
                if (b.getLogoUrl() == null || media.read(b.getLogoUrl()).isEmpty()) {
                    b.setLogoUrl(f.url());
                }
                if (b.getWebsite() == null && f.domain() != null) {
                    b.setWebsite("https://" + f.domain());
                }
                catalog.save(b);
            });
        } else if (!"FOUND".equals(l.getStatus())) {
            l.setStatus("GENERATED");
            l.setSource("MONOGRAMA");
        }
        return logos.save(l);
    }

    BrandLogo placeholder(String key, String name) {
        return tx.execute(s -> logos.findByNameKey(key).orElseGet(() -> logos.save(new BrandLogo(key, name))));
    }

    // ================================================================== fontes

    record WikidataHit(String id, String logoFile, String domain) {
    }

    @SuppressWarnings("unchecked")
    WikidataHit wikidata(String name) {
        String q = URLEncoder.encode(name, StandardCharsets.UTF_8);
        Optional<WebFetchPort.Fetched> search = web.get("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=6&language=en&uselang=pt&search=" + q,
                512 * 1024, "application/json");
        if (search.isEmpty()) {
            return null;
        }
        WikidataHit none = new WikidataHit(null, null, null);
        Object results = Json.map(new String(search.get().body(), StandardCharsets.UTF_8)).get("search");
        if (!(results instanceof List<?> list)) {
            return none;
        }
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            String id = String.valueOf(m.get("id"));
            String label = String.valueOf(m.get("label"));
            String description = String.valueOf(m.get("description"));
            if (!keyOf(label).equals(keyOf(name)) && !keyOf(label).startsWith(keyOf(name) + " ")) {
                continue;
            }
            if (!FASHION.matcher(description).find()) {
                continue;
            }
            Optional<WebFetchPort.Fetched> entity = web.get("https://www.wikidata.org/wiki/Special:EntityData/" + id + ".json", 3 * 1024 * 1024, "application/json");
            if (entity.isEmpty()) {
                continue;
            }
            Map<String, Object> entities = (Map<String, Object>) Json.map(new String(entity.get().body(), StandardCharsets.UTF_8)).get("entities");
            Map<String, Object> item = entities == null ? null : (Map<String, Object>) entities.get(id);
            Map<String, Object> claims = item == null ? null : (Map<String, Object>) item.get("claims");
            if (claims == null) {
                continue;
            }
            return new WikidataHit(id, firstString(claims.get("P154")), domainOf(firstString(claims.get("P856"))));
        }
        return none;
    }

    @SuppressWarnings("unchecked")
    static String firstString(Object claim) {
        if (!(claim instanceof List<?> l) || l.isEmpty()) {
            return null;
        }
        for (Object c : l) {
            try {
                Map<String, Object> snak = (Map<String, Object>) ((Map<String, Object>) c).get("mainsnak");
                Map<String, Object> dv = (Map<String, Object>) snak.get("datavalue");
                Object v = dv == null ? null : dv.get("value");
                if (v instanceof String s && !s.isBlank()) {
                    return s;
                }
            } catch (ClassCastException ignored) {
                // formato inesperado: tenta o próximo valor
            }
        }
        return null;
    }

    record AiHint(String domain, String logoUrl, double confidence) {
    }

    AiHint aiSearch(UUID userId, String name, String knownDomain) {
        AiOutcome<AiHint> outcome = ai.text(new AiEngine.TextCall<>(userId, AiCapability.BRAND_LOGO_FINDER,
                "Você é o Brand Logo Finder do Fashion AI. Use a busca na web para achar o LOGO OFICIAL de uma marca de moda. "
                        + "Prefira, nesta ordem: arquivo no Wikimedia Commons (upload.wikimedia.org, PNG), press kit/brand assets do "
                        + "site oficial, imagem do logo servida pelo domínio oficial. Nunca invente URL: só use URLs vistas nos resultados. "
                        + "A URL precisa apontar direto para a imagem (png, jpg, webp ou svg) do logotipo da marca, não para uma página, "
                        + "foto de loja, produto ou pessoa. Responda somente JSON: "
                        + "{\"officialDomain\": \"exemplo.com\" | null, \"logoUrl\": \"https://...\" | null, \"confidence\": 0..1}.",
                Msg.t("brandLogo.marca_segmento_moda_vestuario_calcados", name, (knownDomain == null ? "" : Msg.t("brandLogo.site_oficial_provavel", knownDomain))),
                List.of(), 1500, List.of(Msg.t("brandLogo.nome_da_marca_dado_publico")),
                text -> {
                    Map<String, Object> m = Json.map(text);
                    if (m.isEmpty()) {
                        return null;
                    }
                    String url = m.get("logoUrl") instanceof String s && s.startsWith("https://") ? s : null;
                    String dom = domainOf(m.get("officialDomain") instanceof String s ? s : null);
                    double conf = m.get("confidence") instanceof Number n ? n.doubleValue() : 0.5;
                    return new AiHint(dom, url, conf);
                },
                () -> null, null, true));
        return outcome.value();
    }

    /** Baixa, valida (imagem de verdade, tamanho mínimo) e guarda no storage próprio. */
    Optional<String> download(String key, String url, String tag) {
        Optional<WebFetchPort.Fetched> got = web.get(url, MAX_IMAGE_BYTES, "image/");
        if (got.isEmpty()) {
            return Optional.empty();
        }
        byte[] bytes = got.get().body();
        String type = got.get().contentType();
        String slug = key.replace(' ', '-');
        try {
            if (type.contains("icon") || url.endsWith(".ico")) {
                if (bytes.length < 200) {
                    return Optional.empty();
                }
                MediaStoragePort.StoredObject o = media.put("brands/logos/" + slug + "-" + tag + ".ico", bytes, "image/x-icon");
                return Optional.of(o.url());
            }
            if (type.contains("svg")) {
                // SVG de terceiros pode carregar script: só aceitamos o PNG renderizado (Commons faz isso com ?width=)
                return Optional.empty();
            }
            BufferedImage img = ImageOps.decode(bytes);
            if (img.getWidth() < 32 || img.getHeight() < 16) {
                return Optional.empty();
            }
            BufferedImage fit = img.getWidth() > 256 || img.getHeight() > 256 ? ImageOps.scaleToFit(img, 256, 256) : img;
            MediaStoragePort.StoredObject o = media.put("brands/logos/" + slug + "-" + tag + ".png", ImageOps.png(fit), "image/png");
            return Optional.of(o.url());
        } catch (RuntimeException e) {
            log.debug("logo inválido para {} ({}): {}", key, url, e.toString());
            return Optional.empty();
        }
    }

    // ================================================================== utilidades

    boolean fresh(BrandLogo l) {
        return "FOUND".equals(l.getStatus()) || l.getCheckedAt().isAfter(Instant.now().minus(RETRY_AFTER));
    }

    Optional<Brand> catalogBrand(String key) {
        return catalog.findAllByOrderByName().stream().filter(b -> keyOf(b.getName()).equals(key)).findFirst();
    }

    /** Nome normalizado: minúsculas, sem acento, só letras/números separados por espaço. */
    public static String keyOf(String name) {
        if (name == null) {
            return "";
        }
        String n = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replace("&", " and ").replaceAll("[^a-z0-9]+", " ").trim();
        return n.length() > 160 ? n.substring(0, 160) : n;
    }

    static String clean(String name) {
        String n = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        return n.length() > 160 ? n.substring(0, 160) : n;
    }

    /** "https://www.Zara.com/br/" → "zara.com"; recusa lixo. */
    static String domainOf(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            String u = url.contains("://") ? url : "https://" + url;
            String host = URI.create(u.trim()).getHost();
            if (host == null || !host.contains(".")) {
                return null;
            }
            host = host.toLowerCase(Locale.ROOT);
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Iniciais (até 2) e cor estável por marca para o monograma. */
    static Map<String, Object> monogram(String name) {
        String[] words = clean(name).split("[\\s\\-_/.]+");
        StringBuilder ini = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty() && Character.isLetterOrDigit(w.charAt(0)) && ini.length() < 2) {
                ini.append(Character.toUpperCase(w.charAt(0)));
            }
        }
        if (ini.length() == 0) {
            ini.append('?');
        }
        String color = PALETTE[Math.floorMod(keyOf(name).hashCode(), PALETTE.length)];
        return Map.of("initials", ini.toString(), "color", color);
    }

    Map<String, Object> view(BrandLogo l, String requested) {
        String name = l == null ? clean(requested) : l.getDisplayName();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("key", keyOf(name));
        boolean found = l != null && "FOUND".equals(l.getStatus()) && l.getLogoUrl() != null;
        m.put("url", found ? l.getLogoUrl() : null);
        m.put("status", l == null ? "GENERATED" : l.getStatus());
        m.put("source", l == null ? "MONOGRAMA" : l.getSource());
        m.put("domain", l == null ? null : l.getDomain());
        m.put("confidence", l == null ? null : l.getConfidence());
        m.put("checkedAt", l == null || Instant.EPOCH.equals(l.getCheckedAt()) ? null : l.getCheckedAt());
        m.put("nextAttemptAt", l == null || found ? null : l.getCheckedAt().plus(RETRY_AFTER));
        m.put("monogram", monogram(name));
        if (l != null && l.getLastError() != null && !found) {
            m.put("note", l.getLastError());
        }
        return m;
    }
}
