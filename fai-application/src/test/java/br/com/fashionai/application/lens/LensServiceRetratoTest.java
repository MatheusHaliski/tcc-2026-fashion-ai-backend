package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização determinística do {@link LensService} (lote R91-lens): o mesmo cenário (guarda-roupa, comunidade,
 * Hype, DNA) passa por todos os casos de uso públicos e as saídas viram um retrato JSON — UUIDs trocados por rótulos
 * estáveis e instantes por {@code <t>} — comparado por SHA-256 e por números exatos de semelhança. Gravado no código
 * anterior à divisão do serviço em colaboradores; o retrato sai em {@code target/lens-retrato.txt}.
 */
class LensServiceRetratoTest extends LensServiceFixture {
    static final String RETRATO_SHA256 = "3a00d5f0144a5fae98d72226f848dbff3c0290b3b05823b629814bf4fe9329aa";

    final Map<UUID, String> labels = new LinkedHashMap<>();
    final List<String> lines = new ArrayList<>();

    WardrobeItem named(WardrobeItem w, String label, int wears) {
        w.setName(label);
        w.setWearCount(wears);
        w.setOccasionTags("casual,work");
        labels.put(w.getId(), label);
        return w;
    }

    void put(String step, Object value) {
        lines.add(step + " " + Json.write(value));
    }

    String retrato() {
        int s = 0;
        for (LensScan scan : scanRows.values()) {
            labels.put(scan.getId(), "scan" + s);
            for (LensDetection d : detectionRows.values()) {
                if (d.getScanId().equals(scan.getId())) {
                    labels.put(d.getId(), "det" + s + "." + d.getOrdinal());
                }
            }
            s++;
        }
        String out = String.join("\n", lines);
        for (Map.Entry<UUID, String> e : labels.entrySet()) {
            out = out.replace(e.getKey().toString(), e.getValue());
        }
        out = out.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<uuid>");
        return out.replaceAll("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z", "<t>");
    }

    static String sha256(String s) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void retratoDeTodosOsCasosDeUsoComNumerosExatos() throws Exception {
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual,minimalist");
        dna.setColorPalette("denim,black");
        dna.setOccasionKeywords("casual");
        dnaRow = Optional.of(dna);

        WardrobeItem myJacket = named(piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE), "minha-jaqueta", 3);
        WardrobeItem blackJacket = named(piece(me, "upper_piece", "jacket", "black", Visibility.PRIVATE), "jaqueta-preta", 0);
        WardrobeItem blazer = named(piece(me, "upper_piece", "blazer", "navy", Visibility.PRIVATE), "blazer-marinho", 7);
        WardrobeItem pants = named(piece(me, "lower_piece", "tailored_pants", "black", Visibility.PRIVATE), "calca-preta", 12);
        named(piece(me, "lower_piece", "shorts", "white", Visibility.PRIVATE), "shorts-branco", 1);
        named(piece(me, "shoes_piece", "casual_sneakers", "white", Visibility.PRIVATE), "tenis-branco", 4);
        publicHype(myJacket, 71);
        publicHype(pants, 44);
        for (int i = 0; i < 5; i++) {
            publicHype(named(piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC), "jaqueta-comunidade-" + i, i), 55 + 3 * i);
        }
        WardrobeItem publicPants = named(piece(other, "lower_piece", "tailored_pants", "black", Visibility.PUBLIC), "calca-comunidade", 2);
        publicHype(publicPants, 80);
        labels.put(me.getId(), "eu");
        labels.put(other.getId(), "outra");

        LensViews.ScanView v = scan();
        put("scan", v);
        UUID jacket = v.detections().get(0).id();
        UUID trousers = v.detections().get(1).id();
        put("matches.closet.look", lens.matches(meUser, v.id(), null, "MY_CLOSET"));
        put("matches.closet.jacket", lens.matches(meUser, v.id(), jacket, null));
        put("matches.community.jacket", lens.matches(meUser, v.id(), jacket, "COMMUNITY"));
        put("matches.community.look", lens.matches(meUser, v.id(), null, "community"));
        put("reading.look", lens.reading(meUser, v.id(), null));
        put("reading.trousers", lens.reading(meUser, v.id(), trousers));
        for (String mode : List.of("SAFE", "DISCOVERY", "EXPERIMENTAL")) {
            put("recreate." + mode, lens.recreate(meUser, v.id(), new LensService.RecreateCommand(mode, null, null)));
        }
        put("recreate.locked", lens.recreate(meUser, v.id(), new LensService.RecreateCommand("DISCOVERY", trousers,
                Map.of(jacket.toString(), blackJacket.getId().toString(), "bottom", pants.getId().toString()))));
        put("recreate.default", lens.recreate(meUser, v.id(), null));

        put("correct.sub", lens.correct(meUser, v.id(), jacket, new LensService.CorrectionCommand(null, "blazer", null, null, null, null, null)));
        put("correct.attrs", lens.correct(meUser, v.id(), jacket,
                new LensService.CorrectionCommand(null, null, "navy", "wool", "Striped", List.of("classic", "urban"), null)));
        put("correct.cat", lens.correct(meUser, v.id(), trousers, new LensService.CorrectionCommand("shoes_piece", null, "", null, null, null, null)));
        put("correct.noop", lens.correct(meUser, v.id(), trousers, null));
        put("add", lens.add(meUser, v.id(), new LensService.AddDetectionCommand(
                new LensService.BoxInput(60.0, 70.0, 50.0, 40.0), null, "casual_sneakers", null)));
        put("want", lens.want(meUser, v.id(), jacket, true));
        put("own.href", lens.own(meUser, v.id(), trousers, null).href());
        put("own.link", lens.own(meUser, v.id(), jacket, blazer.getId()).href());
        put("get", lens.get(meUser, v.id()));
        put("saved", lens.setSaved(meUser, v.id(), true).savedAt() != null);

        nextPieces = List.of(detected(0, null, "lower_piece", "shorts", "white", List.of("streetwear"), 5, 50, 30, 45, 0.4));
        LensViews.ScanView second = scan();
        put("scan2", second);
        put("fromApp", lens.fromApp(meUser, new LensService.FromAppCommand("piece", myJacketWithImage(myJacket))));
        put("history.all", lens.history(meUser, null, null, 0, 12));
        put("history.saved", lens.history(meUser, true, null, 0, 1));
        put("history.wanted", lens.history(meUser, null, true, 0, 50));
        List<String> fb = new ArrayList<>();
        for (LensFeedback f : feedbackRows.values()) {
            fb.add(f.getKind() + " " + f.getBeforeJson() + " -> " + f.getAfterJson() + " " + f.isTrainingConsent());
        }
        put("feedback", fb);

        String retrato = retrato();
        Files.createDirectories(Path.of("target"));
        Files.writeString(Path.of("target/lens-retrato.txt"), retrato);
        // números exatos que o retrato fixa (legíveis aqui; o SHA cobre o resto)
        assertThat(retrato).contains("correct.sub {\"id\":\"det0.0\"").contains("\"pieceId\":\"blazer-marinho\",\"similarity\":80}")
                .contains("\"pieceId\":\"blazer-marinho\",\"similarity\":78}").contains("\"pieceId\":\"tenis-branco\",\"similarity\":67}")
                .contains("\"targetId\":\"minha-jaqueta\",\"similarity\":100,\"components\":{\"visual\":null,\"attributes\":100,\"color\":100}")
                .contains("\"fit\":{\"score\":85,\"parts\":{\"styles\":100,\"colors\":50,\"occasions\":100}}")
                .contains("\"score\":63,\"level\":\"HOT\",\"direction\":\"UP\",\"items\":6}");
        assertThat(sha256(retrato)).isEqualTo(RETRATO_SHA256);
    }

    UUID myJacketWithImage(WardrobeItem w) {
        blobs.put("users/" + me.getId() + "/j.jpg", photo());
        w.setImageUrl("http://x/media/users/" + me.getId() + "/j.jpg");
        return w.getId();
    }
}
