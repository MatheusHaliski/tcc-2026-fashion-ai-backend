package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.testkit.MemoryRepository;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link DnaService} com valores fixos (ids, datas, cores, marcas): o retrato de todas as saídas
 * públicas — síntese da Camada 1, frase, card PNG (SHA-256), Esquemas de DNA em cada narrativa, construtor, prévia,
 * propostas do motor local e as regras puras usadas pelos testes — tem de continuar idêntico ao gravado em
 * {@code dna/dna-service-portrait.txt}. Ids e instantes gerados na hora viram marcadores na ordem em que aparecem.
 */
class DnaServiceCharacterizationTest {
    private static final String GOLDEN = "/dna/dna-service-portrait.txt";
    private static final Instant T0 = Instant.parse("2025-03-01T12:00:00Z");
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear", "Alfa"},
            {"upper_piece", "hoodie", "black", "streetwear", "Beta"},
            {"upper_piece", "blazer", "navy", "classic,tailored", "Alfa"},
            {"lower_piece", "jeans", "blue", "basic,streetwear", ""},
            {"lower_piece", "cargo_pants", "olive", "streetwear", "Beta"},
            {"lower_piece", "tailored_pants", "black", "classic,tailored", "Gama"},
            {"shoes_piece", "casual_sneakers", "white", "basic,streetwear", "Alfa"},
            {"shoes_piece", "oxford_shoes", "brown", "classic,tailored", ""},
            {"accessory_piece", "belt", "brown", "classic", "Gama"},
            {"accessory_piece", "cap", "red", "streetwear", ""},
            {"full_body_piece", "dress", "red", "glam,romantic", "Delta"},
            {"upper_piece", "crop_top", "yellow", "glam", ""},
    };
    private static final int[][] LOOKS = {{0, 3, 6, 9}, {2, 5, 7, 8}, {1, 4, 6, 9}, {2, 5, 7, 8}, {0, 4, 6, 8}, {10, 7, 8}, {11, 3, 6}};
    private static final String[] OCCASIONS = {"casual", "trabalho", "casual,festa", "trabalho", "festa", "festa", "casual"};
    private static final Season[] SEASONS = {Season.SUMMER, Season.WINTER, Season.AUTUMN, Season.WINTER, null, Season.SPRING, Season.SUMMER};

    private final Kit kit = new Kit();
    private final List<byte[]> pngs = new ArrayList<>();
    private User ana;
    private User bia;
    private final List<UUID> looks = new ArrayList<>();

    private static UUID id(int n) {
        return new UUID(0xD0AL, n);
    }

    private User person(String name, int base, int lookCount) {
        User u = Kit.user(name);
        u.assignId(id(base));
        u.markCreatedAt(T0);
        kit.dep(UserRepository.class).save(u);
        List<WardrobeItem> ws = new ArrayList<>();
        for (int i = 0; i < WARDROBE.length; i++) {
            String[] p = WARDROBE[i];
            WardrobeItem w = Kit.piece(u, p[1].replace('_', ' ') + " " + name, p[0], p[1], p[2]);
            w.assignId(id(base + 100 + i));
            w.markCreatedAt(T0.plusSeconds(60L * i));
            w.setStyleTags(p[3]);
            w.setBrandName(p[4].isEmpty() ? null : p[4]);
            ws.add(kit.dep(WardrobeItemRepository.class).save(w));
        }
        for (int i = 0; i < lookCount; i++) {
            Scheme s = Kit.look(u, "Look " + (i + 1) + " de " + name);
            s.assignId(id(base + 200 + i));
            s.markCreatedAt(T0.plusSeconds(86_400L * 30 * i));
            s.setOccasion(OCCASIONS[i]);
            s.setStyle(i % 2 == 0 ? "streetwear" : "classic");
            s.setSeason(SEASONS[i]);
            s.setLikeCount(7L * ((i * 3) % 5) + i);
            s.setCoverImageUrl(i % 3 == 0 ? null : "/media/look-" + i + ".png");
            kit.dep(SchemeRepository.class).save(s);
            for (int j = 0; j < LOOKS[i].length; j++) {
                WardrobeItem w = ws.get(LOOKS[i][j]);
                SchemeSlot slot = "full_body_piece".equals(w.getCategory()) ? SchemeSlot.FULL_BODY : SchemeSlot.values()[j % 4];
                var si = Kit.slot(s, w, slot, j);
                si.assignId(id(base + 300 + i * 10 + j));
                kit.dep(SchemeItemRepository.class).save(si);
            }
            if (u.getUsername().equals("ana")) {
                looks.add(s.getId());
            }
        }
        return u;
    }

    private DnaService setUp() {
        WardrobeItemRepository pieces = kit.dep(WardrobeItemRepository.class);
        lenient().when(pieces.findAllPublic(any())).thenAnswer(i -> MemoryRepository.<WardrobeItem>rows(pieces).stream()
                .filter(w -> w.getVisibility() == Visibility.PUBLIC).toList());
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString())).thenAnswer(i -> {
            pngs.add(i.getArgument(1));
            return new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png");
        });
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        ana = person("ana", 1000, 7);
        bia = person("bia", 2000, 3);
        person("caio", 3000, 2);
        for (int i = 0; i < 5; i++) {
            DailyLook dl = new DailyLook();
            dl.assignId(id(4000 + i));
            dl.setUser(ana);
            dl.setScheme(kit.dep(SchemeRepository.class).findById(looks.get(i * 2 % 7)).orElseThrow());
            dl.setLookDate(LocalDate.of(2025, 4, 1).minusDays(i));
            dl.setFeedback(i == 4 ? DailyLookFeedback.NAO_GOSTEI : DailyLookFeedback.ADOREI);
            kit.dep(DailyLookRepository.class).save(dl);
        }
        return kit.build(DnaService.class);
    }

    private DnaService.DnaSchemeForm form(String title, NarrativeType nt, String layout, String target, int cells, boolean milestone, boolean publish) {
        List<DnaService.DnaCellForm> cs = new ArrayList<>();
        for (int i = 0; i < cells; i++) {
            cs.add(new DnaService.DnaCellForm(looks.get(i), i % 2 == 0 ? "Época " + (i + 1) : null, milestone && i == 1));
        }
        return new DnaService.DnaSchemeForm(title, cs, layout, target, nt, "casual", "streetwear", null, Visibility.PUBLIC,
                Map.of("color", "#112233", "skin", "linen"), publish, nt == null ? "MANUAL" : "AI");
    }

    @Test
    void retratoDasSaidasPublicasEDasRegrasPuras() throws Exception {
        DnaService dna = setUp();
        CurrentUser me = Kit.as(ana);
        CurrentUser visitor = Kit.as(bia);
        Portrait p = new Portrait();
        p.add("overview.first", dna.overview(me));
        p.add("socialProof", dna.socialProof(me));
        Map<String, List<String>> life = new LinkedHashMap<>();
        life.put("places", List.of("Recife", "  Recife ", "Lisboa"));
        life.put("animals", List.of("Mel (gata)"));
        life.put("objects", List.of("violão", "câmera analógica"));
        p.add("generate", dna.generate(me, new DnaService.LifeForm(life, List.of("animals"), false)));
        p.add("generate.skip", dna.generate(me, new DnaService.LifeForm(null, null, true)));
        p.add("generate.errors", attempt(() -> dna.generate(me, new DnaService.LifeForm(Map.of("people", List.of("a", "b", "c", "d")), null, false))));
        p.add("generate.unknown", attempt(() -> dna.generate(me, new DnaService.LifeForm(Map.of("coisas", List.of("x")), null, false))));
        p.add("updateLife", dna.updateLife(me, new DnaService.LifeForm(Map.of("people", List.of("Vó Lia"), "objects", List.of("livro")), List.of(), false)));
        p.add("updateLife.missing", attempt(() -> dna.updateLife(Kit.as(Kit.user("zeca")), new DnaService.LifeForm(Map.of(), null, false))));
        p.add("setPrivateFields", dna.setPrivateFields(me, List.of("people")));
        p.add("setColorSeason", dna.setColorSeason(me, "autumn"));
        p.add("setColorSeason.invalid", attempt(() -> dna.setColorSeason(me, "MONSOON")));
        p.add("shareCard", dna.shareCard(me));
        p.add("shareCard.pngSha256", sha(pngs.get(pngs.size() - 1)));
        p.add("overview.second", dna.overview(me));
        List<Object> ids = new ArrayList<>();
        for (NarrativeType nt : NarrativeType.values()) {
            Map<String, Object> created = dna.createDnaScheme(me, form("DNA " + nt, nt, "GRADE", "DNA_COMPLETO", 2 + nt.ordinal() % 5,
                    nt == NarrativeType.MOMENTOS_MARCANTES, true));
            p.add("create." + nt, created);
            ids.add(created.get("id"));
            p.add("get.visitor." + nt, dna.getDnaScheme(visitor, (UUID) created.get("id")));
        }
        for (String layout : DnaService.LAYOUTS) {
            p.add("create.layout." + layout, dna.createDnaScheme(me, form("Anatomia " + layout, null, layout, "ESQUEMA", 3, false, false)));
        }
        UUID first = (UUID) ids.get(0);
        p.add("update", dna.updateDnaScheme(me, first, new DnaService.DnaSchemeForm("Novo título", null, "HORIZONTAL", "ESQUEMA", null,
                null, null, Season.WINTER, Visibility.FOLLOWERS, null, true, null)));
        p.add("update.cells", dna.updateDnaScheme(me, (UUID) ids.get(1), form("Trocado", NarrativeType.CARTELA_SAZONAL, null, null, 6, false, false)));
        p.add("get.draft.visitor", attempt(() -> dna.getDnaScheme(visitor, (UUID) dna.myDnaSchemes(me).get(0).get("id"))));
        dna.deleteDnaScheme(me, (UUID) ids.get(2));
        p.add("mine", dna.myDnaSchemes(me));
        p.add("create.oneCell", attempt(() -> dna.createDnaScheme(me, form("Erro", null, "GRADE", "DNA_COMPLETO", 1, false, false))));
        p.add("create.layout", attempt(() -> dna.createDnaScheme(me, form("Erro", null, "REDONDO", "DNA_COMPLETO", 3, false, false))));
        p.add("create.target", attempt(() -> dna.createDnaScheme(me, form("Erro", null, "GRADE", "OUTRO", 3, false, false))));
        p.add("create.narrative", attempt(() -> dna.createDnaScheme(me, form("Erro", NarrativeType.LEGO, "GRADE", "ESQUEMA", 3, false, false))));
        p.add("create.otherOwner", attempt(() -> dna.createDnaScheme(visitor, form("Erro", null, "GRADE", "DNA_COMPLETO", 3, false, false))));
        p.add("builder", dna.builder(me));
        p.add("builder.empty", dna.builder(Kit.as(kit.dep(UserRepository.class).save(Kit.user("vazia")))));
        p.add("preview", dna.preview(me, form("", NarrativeType.PALETA_DOMINANTE, null, "DNA_COMPLETO", 4, false, false)));
        p.add("preview.harmony", dna.preview(me, form("Harmonia", NarrativeType.HARMONIA_CROMATICA, "LATERAL", "DNA_COMPLETO", 7, false, false)));
        p.add("compositions.null", dna.compositions(me, null));
        for (String prompt : List.of("minha trajetória com marcas", "paleta de cores quentes no inverno", "jeans e oxford")) {
            p.add("compositions." + prompt, dna.compositions(me, new DnaService.DnaComposeRequest(prompt, List.of(), List.of(), null, null)));
        }
        p.add("compositions.filtered", dna.compositions(me, new DnaService.DnaComposeRequest("festa", List.of("festa"), List.of("classic"),
                NarrativeType.MOMENTOS_MARCANTES, Season.SPRING)));
        p.add("compositions.few", attempt(() -> dna.compositions(Kit.as(kit.dep(UserRepository.class).findById(id(3000)).orElseThrow()), null)));
        pureRules(dna, p);
        p.verify();
    }

    private void pureRules(DnaService dna, Portrait p) {
        List<Scheme> mine = looks.stream().map(i -> kit.dep(SchemeRepository.class).findById(i).orElseThrow()).toList();
        Map<UUID, List<br.com.fashionai.domain.model.SchemeItem>> itemsBy = new LinkedHashMap<>();
        mine.forEach(s -> itemsBy.put(s.getId(), kit.dep(SchemeItemRepository.class).findBySchemeIdOrderBySortOrder(s.getId())));
        Map<UUID, Double> hype = Map.of(mine.get(3).getId(), 88.5, mine.get(0).getId(), 41.0, mine.get(5).getId(), 63.2);
        for (NarrativeType nt : NarrativeType.values()) {
            for (Season s : List.of(Season.WINTER, Season.SUMMER)) {
                p.add("pickFor." + nt + "." + s, DnaService.pickFor(nt, mine, itemsBy, s, hype).stream().map(Scheme::getId).toList());
            }
            p.add("localProposals." + nt, DnaService.localProposals(mine, itemsBy, new DnaService.DnaComposeRequest("evolução da marca", List.of(), List.of(), nt, null), hype));
        }
        p.add("localProposals.blank", DnaService.localProposals(mine, itemsBy, new DnaService.DnaComposeRequest(null, List.of(), List.of(), null, Season.SUMMER), Map.of()));
        for (List<String> colors : List.<List<String>>of(List.of(), List.of("blue", "orange"), List.of("red", "green", "white"), List.of("red", "blue", "yellow"),
                List.of("blue", "navy"), List.of("red", "blue", "yellow", "green"), List.of("#ff0000"))) {
            p.add("harmony." + colors, DnaService.harmony(colors));
        }
        for (int n : new int[]{2, 3, 5, 9}) {
            p.add("spread." + n, DnaService.spread(mine, n).stream().map(Scheme::getId).toList());
        }
        p.add("enumOr", List.of(String.valueOf(DnaService.enumOr(Season.class, " winter ", null)), String.valueOf(DnaService.enumOr(Season.class, "x", Season.SPRING)),
                String.valueOf(DnaService.enumOr(NarrativeType.class, null, NarrativeType.LEGO))));
        Map<String, Scheme> byRef = new LinkedHashMap<>();
        mine.forEach(s -> byRef.put("s" + (byRef.size() + 1), s));
        p.add("parseProposals", dna.parseProposals("""
                texto antes {"compositions":[
                  {"title":"Minha história","narrativeType":"momentos_marcantes","cardLayout":"GRADE","refs":["s1","s2","s9","s2"],
                   "eraLabels":{"s1":"2024 · primeiro emprego"},"milestone":"s7","occasion":["casual","inventada"],"style":["streetwear"],"rationale":"Porque sim."},
                  {"title":"Cartela","narrativeType":"CARTELA_SAZONAL","cardLayout":"X","refs":["s3","s4","s5"],"seasonalTheme":"winter"},
                  {"title":"Inválida","refs":["s1"]},
                  {"refs":["s5","s6"],"narrativeType":"NAO_EXISTE","milestone":"s6"},
                  {"title":"Quarta","refs":["s1","s3"]}
                ]} depois""", byRef));
        p.add("parseProposals.none", String.valueOf(dna.parseProposals("{\"x\":1}", byRef)));
    }

    private static Object attempt(Supplier<?> call) {
        try {
            return call.get();
        } catch (ApiException ex) {
            return Map.of("status", ex.status(), "code", String.valueOf(ex.code()), "message", String.valueOf(ex.getMessage()), "details", ex.details());
        }
    }

    private static String sha(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    /** Escreve as saídas em texto canônico: chaves de mapa ordenadas (o JSON relido herda a ordem aleatória de Map.of); ids e instantes novos viram marcadores. */
    private static final class Portrait {
        private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
        private final StringBuilder out = new StringBuilder();
        private final Map<String, String> tokens = new LinkedHashMap<>();

        void add(String label, Object value) {
            out.append(label).append(" = ");
            write(value);
            out.append('\n');
        }

        private void write(Object v) {
            if (v instanceof Map<?, ?> m) {
                Map<?, ?> ordered = sorted(m);
                out.append('{');
                ordered.forEach((k, x) -> {
                    out.append(text(String.valueOf(k))).append(": ");
                    write(x);
                    out.append(", ");
                });
                out.append('}');
            } else if (v instanceof Collection<?> c) {
                Collection<?> items = c instanceof List<?> ? c : c.stream().map(String::valueOf).sorted().toList();
                out.append('[');
                items.forEach(x -> {
                    write(x);
                    out.append(", ");
                });
                out.append(']');
            } else if (v instanceof Object[] arr) {
                write(List.of(arr));
            } else if (v instanceof Instant t) {
                out.append(t.isBefore(Instant.parse("2026-01-01T00:00:00Z")) ? t.toString() : "<agora>");
            } else if (v instanceof Record r) {
                Map<String, Object> fields = new LinkedHashMap<>();
                for (var c : r.getClass().getRecordComponents()) {
                    try {
                        fields.put(c.getName(), c.getAccessor().invoke(r));
                    } catch (ReflectiveOperationException e) {
                        throw new IllegalStateException(e);
                    }
                }
                out.append(r.getClass().getSimpleName());
                write(fields);
            } else {
                out.append(text(String.valueOf(v)));
            }
        }

        private static Map<String, Object> sorted(Map<?, ?> m) {
            Map<String, Object> s = new TreeMap<>();
            m.forEach((k, x) -> s.put(String.valueOf(k), x));
            return s;
        }

        private String text(String s) {
            Matcher u = UUID_RE.matcher(s);
            StringBuilder b = new StringBuilder();
            while (u.find()) {
                String id = u.group();
                String rep = id.startsWith("00000000-0000-0d0a-") ? id.substring(24) : tokens.computeIfAbsent(id, k -> "<id" + (tokens.size() + 1) + ">");
                u.appendReplacement(b, Matcher.quoteReplacement(rep));
            }
            u.appendTail(b);
            return b.toString().replaceAll("card-\\d{10,}", "card-<ms>");
        }

        void verify() throws IOException {
            String actual = out.toString();
            try (InputStream in = DnaServiceCharacterizationTest.class.getResourceAsStream(GOLDEN)) {
                if (in == null) {
                    Path target = Path.of("target", "dna-service-portrait.txt");
                    Files.writeString(target, actual, StandardCharsets.UTF_8);
                    throw new AssertionError("retrato gravado em " + target.toAbsolutePath() + "; copie para src/test/resources" + GOLDEN);
                }
                assertThat(actual).isEqualTo(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
    }
}
