package br.com.fashionai.application.moments;

import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import br.com.fashionai.domain.model.enums.MomentNature;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Momentos §10–§12, §39, §57 — pontos determinísticos, bônus de reutilização, nada por compra, 1× por referência. */
class MomentPointsPolicyTest {
    private Moment halloween() {
        Moment m = new Moment();
        m.assignId(UUID.randomUUID());
        m.setName("Halloween");
        m.setBasePoints(20);
        m.setPointsMultiplier(new BigDecimal("1.50"));
        m.setBonusRulesJson("{\"wardrobe\":25,\"rediscovery\":15,\"remix\":10,\"newStyle\":15,\"publish\":10}");
        return m;
    }

    private MomentChallenge challenge(String code, MomentChallengeKind kind, int points, String styles, String colors, String params) {
        MomentChallenge c = new MomentChallenge();
        c.setCode(code);
        c.setKind(kind);
        c.setPoints(points);
        c.setStyleTags(styles);
        c.setColorTags(colors);
        c.setParamsJson(params);
        return c;
    }

    private MomentPointsPolicy.Facts facts(int match, boolean published, boolean wardrobeOnly, List<UUID> rediscovered, long idle, Set<String> newStyles, Set<String> styles, Set<String> colors) {
        return new MomentPointsPolicy.Facts(match, published, wardrobeOnly, rediscovered, idle, false, newStyles, colors.size(), Map.of(), styles, colors, 1);
    }

    @Test
    void lookRelacionadoPagaBaseComMultiplicadorEBonusDeReutilizacao() {
        Moment m = halloween();
        List<MomentPointsPolicy.Line> lines = MomentPointsPolicy.compute(m, List.of(),
                facts(89, true, true, List.of(UUID.randomUUID()), 70, Set.of("avant_garde"), Set.of("edgy", "avant_garde"), Set.of("black", "orange")));
        assertThat(lines).extracting(MomentPointsPolicy.Line::actionCode)
                .containsExactly("MOMENT_LOOK", "MOMENT_PUBLISH", "MOMENT_WARDROBE_BONUS", "MOMENT_REDISCOVERY_BONUS", "MOMENT_NEW_STYLE");
        assertThat(lines.get(0).points()).isEqualTo(30);   // 20 × 1,5
        assertThat(MomentPointsPolicy.total(lines)).isEqualTo(30 + 10 + 25 + 15 + 15);
        assertThat(lines).allMatch(l -> l.refId().equals(m.getId().toString()));   // 1× por Momento no ledger
    }

    @Test
    void lookPoucoRelacionadoNaoPontuaMasDesafioNoBuyAindaVale() {
        Moment m = halloween();
        MomentChallenge noBuy = challenge("NO_BUY", MomentChallengeKind.NO_BUY, 40, null, null, "{\"wardrobeOnly\":true}");
        List<MomentPointsPolicy.Line> lines = MomentPointsPolicy.compute(m, List.of(noBuy), facts(20, true, true, List.of(), 0, Set.of(), Set.of("resort"), Set.of("white")));
        assertThat(lines).extracting(MomentPointsPolicy.Line::actionCode).containsExactly("MOMENT_CHALLENGE");
        assertThat(lines.get(0).refId()).endsWith(":NO_BUY");
        assertThat(lines.get(0).points()).isEqualTo(40);
    }

    @Test
    void desafiosDeCorEstiloEExperimental() {
        Moment m = halloween();
        List<MomentChallenge> cs = List.of(
                challenge("ORANGE_BLACK", MomentChallengeKind.COLOR, 20, null, "orange,black", null),
                challenge("DARK_MINIMAL", MomentChallengeKind.STYLE, 15, "minimalist,edgy", "black,gray", null),
                challenge("EXPERIMENTAL", MomentChallengeKind.EXPERIMENTAL, 30, "avant_garde,futuristic", null, null),
                challenge("COLOR_CLASH", MomentChallengeKind.COLOR, 20, null, "yellow,pink,orange", "{\"distinctColors\":3}"));
        List<MomentPointsPolicy.Line> lines = MomentPointsPolicy.compute(m, cs, facts(85, false, false, List.of(), 0, Set.of("avant_garde"), Set.of("minimalist", "avant_garde"), Set.of("black", "orange")));
        assertThat(lines).extracting(MomentPointsPolicy.Line::actionCode).containsExactly("MOMENT_LOOK", "MOMENT_NEW_STYLE", "MOMENT_CHALLENGE", "MOMENT_CHALLENGE", "MOMENT_CHALLENGE");
        assertThat(lines.stream().filter(l -> l.refId().endsWith(":COLOR_CLASH")).count()).isZero();   // só 2 cores distintas
    }

    @Test
    void momentoReligiosoOuSemPontosNuncaPontua() {
        Moment m = halloween();
        m.setNature(MomentNature.RELIGIOUS);
        assertThat(MomentPointsPolicy.compute(m, List.of(), facts(100, true, true, List.of(), 0, Set.of(), Set.of("glam"), Set.of("red")))).isEmpty();
        Moment off = halloween();
        off.setPointsEnabled(false);
        assertThat(MomentPointsPolicy.compute(off, List.of(), facts(100, true, true, List.of(), 0, Set.of(), Set.of("glam"), Set.of("red")))).isEmpty();
    }

    @Test
    void redescobertaExigeDiasParadosEQuantidade() {
        MomentChallenge c = challenge("BACK", MomentChallengeKind.REDISCOVERY, 15, null, null, "{\"idleDays\":90,\"piecesRequired\":2}");
        assertThat(MomentPointsPolicy.fulfils(c, facts(80, false, false, List.of(UUID.randomUUID()), 120, Set.of(), Set.of(), Set.of()), true)).isFalse();
        assertThat(MomentPointsPolicy.fulfils(c, facts(80, false, false, List.of(UUID.randomUUID(), UUID.randomUUID()), 60, Set.of(), Set.of(), Set.of()), true)).isFalse();
        assertThat(MomentPointsPolicy.fulfils(c, facts(80, false, false, List.of(UUID.randomUUID(), UUID.randomUUID()), 120, Set.of(), Set.of(), Set.of()), true)).isTrue();
    }

    @Test
    void umaPecaVariosLooksContaPorPeca() {
        MomentChallenge c = challenge("ONE_PIECE", MomentChallengeKind.ONE_PIECE_MANY_LOOKS, 30, null, null, "{\"looksRequired\":3}");
        UUID piece = UUID.randomUUID();
        MomentPointsPolicy.Facts two = new MomentPointsPolicy.Facts(80, false, false, List.of(), 0, false, Set.of(), 1, Map.of(piece, 2), Set.of(), Set.of(), 2);
        MomentPointsPolicy.Facts three = new MomentPointsPolicy.Facts(80, false, false, List.of(), 0, false, Set.of(), 1, Map.of(piece, 3), Set.of(), Set.of(), 3);
        assertThat(MomentPointsPolicy.fulfils(c, two, true)).isFalse();
        assertThat(MomentPointsPolicy.fulfils(c, three, true)).isTrue();
    }
}
