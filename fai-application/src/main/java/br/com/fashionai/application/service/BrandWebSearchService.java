package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LogoFilter;
import br.com.fashionai.application.imaging.SvgPathRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Buscador de marcas na internet do formulário de peça (RF4). Não existe catálogo de marcas pré-cadastrado: cada busca
 * consulta a web na hora e devolve nome, descrição, site e o <b>logo já filtrado</b> ({@link LogoFilter}: fundo branco,
 * letras pretas nítidas; logo borrado ou de baixa resolução é recusado).
 * <p>
 * Fontes, em ordem de confiança:
 * <ol>
 *   <li><b>Wikidata</b> — itens cuja descrição é de moda (vestuário, calçado, luxo, varejo...), com logo oficial (P154,
 *       PNG renderizado pelo Wikimedia Commons a partir do vetor) e site oficial (P856);</li>
 *   <li><b>IA com busca na web</b> (quando houver chave e consentimento de uso de IA remota) — só entra quando as outras
 *       fontes trazem poucos resultados;</li>
 *   <li><b>Simple Icons</b> — catálogo aberto (CC0) de logos vetoriais monocromáticos de marcas, lido do GitHub; o SVG é
 *       desenhado aqui em preto sobre branco, então nunca fica borrado.</li>
 * </ol>
 * Só o que o usuário escolhe é guardado: o logo filtrado vai para o storage próprio e para o cache de logos
 * ({@code brand_logos}); a peça grava nome, logo, fonte e referência externa.
 */
@Service
public class BrandWebSearchService {
    private static final Logger log = LoggerFactory.getLogger(BrandWebSearchService.class);
    static final Duration QUERY_TTL = Duration.ofMinutes(30);
    static final Duration INDEX_TTL = Duration.ofHours(12);
    static final int MAX_RESULTS = 8;
    static final int MAX_LOGOS_PER_SEARCH = 6;

    private final WebFetchPort web;
    private final MediaService media;
    private final AiEngine ai;
    private final BrandLogoService logos;
    private final String simpleIconsBase;
    private final ExecutorService pool = Executors.newFixedThreadPool(6, r -> {
        Thread t = new Thread(r, "brand-web-search");
        t.setDaemon(true);
        return t;
    });

    private final Map<String, Cached> queries = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> logoCache = new ConcurrentHashMap<>();
    private volatile List<SimpleIcon> simpleIcons;
    private volatile Instant simpleIconsAt = Instant.EPOCH;

    public BrandWebSearchService(WebFetchPort web, MediaService media, AiEngine ai, BrandLogoService logos,
                                 @Value("${fashionai.brand-search.simple-icons-base:https://raw.githubusercontent.com/simple-icons/simple-icons/develop}") String simpleIconsBase) {
        this.web = web;
        this.media = media;
        this.ai = ai;
        this.logos = logos;
        this.simpleIconsBase = simpleIconsBase;
    }

    record Cached(Map<String, Object> body, Instant at) {
    }

    /** Candidato encontrado na web (antes do logo). */
    record Hit(String name, String description, String source, String ref, String domain, String officialUrl, String color,
               String logoUrl, boolean vector, Boolean fashion, int match) {
    }

    record SimpleIcon(String title, String slug, String hex, String source, List<String> aliases) {
    }

    // ================================================================== API

    public Map<String, Object> search(UUID userId, String rawQuery, boolean allowAi) {
        String q = rawQuery == null ? "" : rawQuery.trim().replaceAll("\\s+", " ");
        if (q.length() < 2 || q.length() > 60) {
            throw ApiException.badRequest("BUSCA_INVALIDA", Msg.t("brandWebSearch.digite_de_2_a_60"));
        }
        String key = BrandLogoService.keyOf(q) + (allowAi ? "|ia" : "");
        Cached c = queries.get(key);
        if (c != null && c.at().isAfter(Instant.now().minus(QUERY_TTL))) {
            Map<String, Object> out = new LinkedHashMap<>(c.body());
            out.put("cache", true);
            return out;
        }
        long t0 = System.nanoTime();
        List<Map<String, Object>> sources = new ArrayList<>();
        List<Hit> hits = new ArrayList<>();
        CompletableFuture<List<Hit>> wd = CompletableFuture.supplyAsync(() -> wikidata(q), pool);
        CompletableFuture<List<Hit>> si = CompletableFuture.supplyAsync(() -> simpleIcons(q), pool);
        hits.addAll(collect(wd, "WIKIDATA", "Wikidata (Wikimedia)", sources));
        hits.addAll(collect(si, "SIMPLE_ICONS", Msg.t("brandWebSearch.simple_icons_github"), sources));
        if (allowAi && q.length() >= 3 && hits.stream().filter(h -> h.match() <= 1).count() < 2) {
            hits.addAll(collect(CompletableFuture.supplyAsync(() -> aiSearch(userId, q), pool), "IA_BUSCA_WEB", Msg.t("brandWebSearch.ia_com_busca_na_web"), sources));
        } else {
            sources.add(Map.of("source", "IA_BUSCA_WEB", "label", Msg.t("brandWebSearch.ia_com_busca_na_web"), "status", "NAO_USADA",
                    "note", allowAi ? Msg.t("brandWebSearch.as_outras_fontes_ja_trouxeram") : Msg.t("brandWebSearch.ia_remota_desligada_nas_preferencias")));
        }
        List<Hit> merged = merge(hits);
        List<CompletableFuture<Map<String, Object>>> jobs = new ArrayList<>();
        for (int i = 0; i < merged.size(); i++) {
            Hit h = merged.get(i);
            boolean withLogo = i < MAX_LOGOS_PER_SEARCH;
            jobs.add(CompletableFuture.supplyAsync(() -> view(h, withLogo ? logoOf(h) : null), pool));
        }
        List<Map<String, Object>> results = new ArrayList<>();
        int rejected = 0;
        for (CompletableFuture<Map<String, Object>> j : jobs) {
            try {
                Map<String, Object> r = j.get(12, TimeUnit.SECONDS);
                results.add(r);
                if (r.get("logo") instanceof Map<?, ?> l && Boolean.FALSE.equals(l.get("accepted"))) {
                    rejected++;
                }
            } catch (Exception e) {
                log.debug("logo da busca falhou: {}", e.toString());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", q);
        out.put("results", results);
        out.put("sources", sources);
        out.put("rejectedLogos", rejected);
        out.put("ms", (System.nanoTime() - t0) / 1_000_000);
        out.put("note", Msg.t("brandWebSearch.busca_feita_agora_na_internet"));
        out.put("cache", false);
        if (results.size() > 0 || sources.stream().anyMatch(s -> "OK".equals(s.get("status")))) {
            if (queries.size() > 500) {
                queries.clear();
            }
            queries.put(key, new Cached(out, Instant.now()));
        }
        return out;
    }

    /** O usuário escolheu um resultado: o logo filtrado passa a valer para essa marca em todas as telas. */
    public Map<String, Object> remember(String name, String logoUrl, String source, String domain, String originUrl) {
        if (logoUrl == null || media.read(logoUrl).isEmpty()) {
            return Map.of("remembered", false);
        }
        logos.acceptWebLogo(name, logoUrl, source, domain, originUrl);
        return Map.of("remembered", true);
    }

    private List<Hit> collect(CompletableFuture<List<Hit>> f, String source, String label, List<Map<String, Object>> sources) {
        long t = System.nanoTime();
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("source", source);
        s.put("label", label);
        try {
            List<Hit> r = f.get(10, TimeUnit.SECONDS);
            if (r == null) {
                s.put("status", "INDISPONIVEL");
                s.put("note", Msg.t("brandWebSearch.sem_acesso_a_fonte_rede"));
                r = List.of();
            } else {
                s.put("status", r.isEmpty() ? "SEM_RESULTADO" : "OK");
                s.put("count", r.size());
            }
            s.put("ms", (System.nanoTime() - t) / 1_000_000);
            sources.add(s);
            return r;
        } catch (Exception e) {
            s.put("status", "INDISPONIVEL");
            s.put("note", "tempo esgotado");
            sources.add(s);
            return List.of();
        }
    }

    /** Junta resultados da mesma marca (nome normalizado), preferindo a fonte mais confiável, e ordena. */
    static List<Hit> merge(List<Hit> hits) {
        Map<String, Hit> byKey = new LinkedHashMap<>();
        for (Hit h : hits) {
            String k = BrandLogoService.keyOf(h.name());
            Hit cur = byKey.get(k);
            if (cur == null) {
                byKey.put(k, h);
            } else {
                // mantém a fonte mais confiável, mas herda o que faltar (site, logo vetorial)
                Hit best = rank(h.source()) < rank(cur.source()) ? h : cur;
                Hit other = best == h ? cur : h;
                byKey.put(k, new Hit(best.name(), best.description() != null ? best.description() : other.description(), best.source(), best.ref(),
                        best.domain() != null ? best.domain() : other.domain(), best.officialUrl() != null ? best.officialUrl() : other.officialUrl(),
                        best.color() != null ? best.color() : other.color(), best.logoUrl() != null ? best.logoUrl() : other.logoUrl(),
                        best.logoUrl() != null ? best.vector() : other.vector(), best.fashion() != null ? best.fashion() : other.fashion(),
                        Math.min(best.match(), other.match())));
            }
        }
        return byKey.values().stream()
                .sorted(Comparator.comparingInt(Hit::match)
                        .thenComparing(h -> Boolean.TRUE.equals(h.fashion()) ? 0 : 1)
                        .thenComparingInt(h -> rank(h.source()))
                        .thenComparing(Hit::name))
                .limit(MAX_RESULTS).toList();
    }

    static int rank(String source) {
        return switch (source) {
            case "WIKIDATA" -> 0;
            case "IA_BUSCA_WEB" -> 1;
            default -> 2;
        };
    }

    /** 0 = nome igual, 1 = começa com a busca, 2 = uma palavra do nome começa com a busca, 3 = só por apelido; 9 = não casa ("zar" não traz "Lazarus"). */
    static int matchOf(String name, List<String> aliases, String q) {
        String n = BrandLogoService.keyOf(name), k = BrandLogoService.keyOf(q);
        if (n.equals(k) || n.replace(" ", "").equals(k.replace(" ", ""))) {
            return 0;
        }
        if (n.startsWith(k) || n.replace(" ", "").startsWith(k.replace(" ", ""))) {
            return 1;
        }
        if ((" " + n).contains(" " + k)) {
            return 2;                                  // palavra inteira dentro do nome ("north" → The North Face)
        }
        for (String a : aliases == null ? List.<String>of() : aliases) {
            String ak = BrandLogoService.keyOf(a);
            if (ak.equals(k) || ak.startsWith(k)) {
                return 3;
            }
        }
        return 9;
    }

    // ================================================================== Wikidata

    @SuppressWarnings("unchecked")
    List<Hit> wikidata(String q) {
        String enc = URLEncoder.encode(q, StandardCharsets.UTF_8);
        Optional<WebFetchPort.Fetched> search = web.get("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=12&language=pt&uselang=pt&search=" + enc,
                512 * 1024, "application/json");
        if (search.isEmpty()) {
            return null;
        }
        Object results = Json.map(new String(search.get().body(), StandardCharsets.UTF_8)).get("search");
        List<Hit> out = new ArrayList<>();
        if (!(results instanceof List<?> list)) {
            return out;
        }
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m) || out.size() >= 4) {
                continue;
            }
            String id = String.valueOf(m.get("id"));
            String label = String.valueOf(m.get("label"));
            String description = m.get("description") == null ? "" : String.valueOf(m.get("description"));
            int match = matchOf(label, List.of(), q);
            if (match > 2 || !BrandLogoService.FASHION.matcher(description).find()) {
                continue;
            }
            Optional<WebFetchPort.Fetched> entity = web.get("https://www.wikidata.org/wiki/Special:EntityData/" + id + ".json", 3 * 1024 * 1024, "application/json");
            String logoFile = null, site = null;
            if (entity.isPresent()) {
                Map<String, Object> entities = (Map<String, Object>) Json.map(new String(entity.get().body(), StandardCharsets.UTF_8)).get("entities");
                Map<String, Object> item = entities == null ? null : (Map<String, Object>) entities.get(id);
                Map<String, Object> claims = item == null ? null : (Map<String, Object>) item.get("claims");
                if (claims != null) {
                    logoFile = BrandLogoService.firstString(claims.get("P154"));
                    site = BrandLogoService.firstString(claims.get("P856"));
                }
            }
            String logoUrl = logoFile == null ? null : "https://commons.wikimedia.org/wiki/Special:FilePath/"
                    + URLEncoder.encode(logoFile.replace(' ', '_'), StandardCharsets.UTF_8).replace("+", "%20") + "?width=1024";
            out.add(new Hit(label, description, "WIKIDATA", id, BrandLogoService.domainOf(site), site, null, logoUrl, false, true, match));
        }
        return out;
    }

    // ================================================================== Simple Icons (catálogo aberto no GitHub)

    List<Hit> simpleIcons(String q) {
        List<SimpleIcon> index = simpleIconsIndex();
        if (index == null) {
            return null;
        }
        List<Hit> out = new ArrayList<>();
        for (SimpleIcon s : index) {
            int match = matchOf(s.title(), s.aliases(), q);
            if (match <= 3) {
                out.add(new Hit(s.title(), Msg.t("brandWebSearch.logo_vetorial_do_catalogo_aberto"), "SIMPLE_ICONS", s.slug(),
                        BrandLogoService.domainOf(s.source()), s.source(), s.hex() == null ? null : "#" + s.hex(),
                        simpleIconsBase + "/icons/" + s.slug() + ".svg", true, null, match));
            }
        }
        out.sort(Comparator.comparingInt(Hit::match).thenComparing(Hit::name));
        return out.size() > 6 ? out.subList(0, 6) : out;
    }

    @SuppressWarnings("unchecked")
    List<SimpleIcon> simpleIconsIndex() {
        if (simpleIcons != null && simpleIconsAt.isAfter(Instant.now().minus(INDEX_TTL))) {
            return simpleIcons;
        }
        synchronized (this) {
            if (simpleIcons != null && simpleIconsAt.isAfter(Instant.now().minus(INDEX_TTL))) {
                return simpleIcons;
            }
            Optional<WebFetchPort.Fetched> got = web.get(simpleIconsBase + "/data/simple-icons.json", 4 * 1024 * 1024, null);
            if (got.isEmpty()) {
                return simpleIcons;   // mantém a última cópia da memória, se houver
            }
            List<SimpleIcon> list = new ArrayList<>();
            try {
                Object parsed = Json.read(new String(got.get().body(), StandardCharsets.UTF_8), Object.class);
                List<Object> items = parsed instanceof List<?> l ? (List<Object>) l
                        : parsed instanceof Map<?, ?> mm && mm.get("icons") instanceof List<?> l2 ? (List<Object>) l2 : List.of();
                for (Object o : items) {
                    if (o instanceof Map<?, ?> m && m.get("title") instanceof String title) {
                        List<String> aliases = new ArrayList<>();
                        if (m.get("aliases") instanceof Map<?, ?> al) {
                            if (al.get("aka") instanceof List<?> aka) {
                                aka.forEach(a -> aliases.add(String.valueOf(a)));
                            }
                            if (al.get("loc") instanceof Map<?, ?> loc) {
                                loc.values().forEach(a -> aliases.add(String.valueOf(a)));
                            }
                        }
                        String slug = m.get("slug") instanceof String sl ? sl : slugOf(title);
                        list.add(new SimpleIcon(title, slug, m.get("hex") instanceof String hx ? hx : null,
                                m.get("source") instanceof String src ? src : null, aliases));
                    }
                }
            } catch (RuntimeException e) {
                log.warn("índice do Simple Icons ilegível: {}", e.toString());
                return simpleIcons;
            }
            simpleIcons = list;
            simpleIconsAt = Instant.now();
            return list;
        }
    }

    /** Regra oficial do Simple Icons para o nome do arquivo (titleToSlug). */
    static String slugOf(String title) {
        String s = title.toLowerCase(Locale.ROOT).replace("+", "plus").replace(".", "dot").replace("&", "and")
                .replace("đ", "d").replace("ħ", "h").replace("ı", "i").replace("ĸ", "k").replace("ŀ", "l").replace("ł", "l")
                .replace("ß", "ss").replace("ŧ", "t").replace("ø", "o");
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("[^a-z0-9]", "");
    }

    // ================================================================== IA com busca na web

    List<Hit> aiSearch(UUID userId, String q) {
        AiOutcome<List<Hit>> outcome = ai.text(new AiEngine.TextCall<>(userId, AiCapability.BRAND_LOGO_FINDER,
                "Você é o buscador de marcas do Fashion AI. Use a busca na web para listar até 4 marcas REAIS de moda (roupa, calçado, "
                        + "acessório, joia, luxo ou varejo de moda) cujo nome combine com o texto digitado. Para cada uma: nome oficial, "
                        + "descrição curta em " + Msg.languageName() + ", site oficial e a URL direta de uma imagem do logotipo (PNG ou JPG grande, de preferência "
                        + "upload.wikimedia.org ou press kit oficial; nunca SVG, favicon, foto de loja, produto ou pessoa). Nunca invente URL. "
                        + "Responda só JSON: {\"brands\":[{\"name\":\"...\",\"description\":\"...\",\"officialDomain\":\"exemplo.com\",\"logoUrl\":\"https://...\"}]}",
                Msg.t("brandWebSearch.texto_digitado_no_campo_marca", q), List.of(), 1200, List.of(Msg.t("brandWebSearch.texto_digitado_no_campo_marca_2")),
                text -> {
                    Object brands = Json.map(text).get("brands");
                    List<Hit> out = new ArrayList<>();
                    if (brands instanceof List<?> l) {
                        for (Object o : l) {
                            if (o instanceof Map<?, ?> m && m.get("name") instanceof String n && !n.isBlank()) {
                                String dom = BrandLogoService.domainOf(m.get("officialDomain") instanceof String d ? d : null);
                                String url = m.get("logoUrl") instanceof String u && u.startsWith("https://") ? u : null;
                                out.add(new Hit(n.trim(), m.get("description") instanceof String ds ? ds : null, "IA_BUSCA_WEB", url,
                                        dom, dom == null ? null : "https://" + dom, null, url, false, true, matchOf(n, List.of(), q)));
                            }
                        }
                    }
                    return out;
                },
                () -> null, null, true));
        return outcome.value();
    }

    // ================================================================== logo: download + filtro

    Map<String, Object> logoOf(Hit h) {
        if (h.logoUrl() == null) {
            return Map.of("accepted", false, "reason", "SEM_LOGO_NA_FONTE");
        }
        String cacheKey = h.source() + "|" + h.logoUrl();
        Map<String, Object> cached = logoCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            LogoFilter.Result r;
            Optional<WebFetchPort.Fetched> got = web.get(h.logoUrl(), 3 * 1024 * 1024, h.vector() ? null : "image/");
            if (got.isEmpty()) {
                return Map.of("accepted", false, "reason", "LOGO_NAO_BAIXOU");
            }
            if (h.vector() || got.get().contentType().contains("svg")) {
                r = LogoFilter.fromVector(SvgPathRenderer.parse(new String(got.get().body(), StandardCharsets.UTF_8)));
            } else {
                ImageOps.requireAcceptedImage(got.get().body());
                BufferedImage img = ImageOps.decode(got.get().body());
                r = LogoFilter.fromRaster(img);
            }
            out.put("accepted", r.accepted());
            out.put("reason", r.reason());
            out.put("metrics", r.metrics());
            out.put("pipeline", r.steps());
            out.put("origin", h.logoUrl());
            if (r.accepted()) {
                String slug = BrandLogoService.keyOf(h.name()).replace(' ', '-') + "-" + h.source().toLowerCase(Locale.ROOT).replace('_', '-');
                MediaStoragePort.StoredObject sq = media.put("brands/logos/web/" + slug + ".png", ImageOps.png(r.square()), "image/png");
                MediaStoragePort.StoredObject wide = media.put("brands/logos/web/" + slug + "-faixa.png", ImageOps.png(r.wide()), "image/png");
                out.put("url", sq.url());
                out.put("wideUrl", wide.url());
            }
        } catch (RuntimeException e) {
            out.put("accepted", false);
            out.put("reason", "LOGO_INVALIDO");
            out.put("detail", e.getMessage());
        }
        if (logoCache.size() > 2000) {
            logoCache.clear();
        }
        logoCache.put(cacheKey, out);
        return out;
    }

    static Map<String, Object> view(Hit h, Map<String, Object> logo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", h.name());
        m.put("description", h.description());
        m.put("source", h.source());
        m.put("sourceLabel", switch (h.source()) {
            case "WIKIDATA" -> "Wikidata";
            case "IA_BUSCA_WEB" -> Msg.t("brandWebSearch.ia_busca_na_web");
            default -> Msg.t("brandWebSearch.simple_icons_github_2");
        });
        m.put("ref", h.ref());
        m.put("domain", h.domain());
        m.put("officialUrl", h.officialUrl());
        m.put("brandColor", h.color());
        m.put("fashion", h.fashion());
        m.put("match", switch (h.match()) {
            case 0 -> "EXATA";
            case 1 -> "COMECA_COM";
            case 2 -> "CONTEM";
            default -> "APELIDO";
        });
        m.put("logo", logo == null ? Map.of("accepted", false, "reason", "NAO_PROCESSADO") : logo);
        m.put("logoUrl", logo == null ? null : logo.get("url"));
        m.put("logoWideUrl", logo == null ? null : logo.get("wideUrl"));
        m.put("confidence", h.source().equals("WIKIDATA") ? new BigDecimal("0.95") : h.source().equals("SIMPLE_ICONS") ? new BigDecimal("0.85") : new BigDecimal("0.70"));
        return m;
    }
}
