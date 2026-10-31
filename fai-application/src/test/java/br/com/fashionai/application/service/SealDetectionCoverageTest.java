package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Prova de que os selos criados são detectados em peças e looks compatíveis, no modo automático (sugestões/prévia) e no seletor manual. */
class SealDetectionCoverageTest extends SealCreatorsCoverageFixture {
    // ------------------------------------------------------------------ detecção automática (selo automático)

    @ParameterizedTest
    @CsvSource({"blue,Nike,red,Nike", "red,Nike,blue,Nike", "black,Nike,black,Zara"})
    void modoAutomaticoDetectaPecaCompativelNaPreviaDoCadastro(String wantedColor, String wantedBrand, String otherColor, String otherBrand) {
        activeSeal("Selo de peça", SealTier.PECA, referencePolicy(SealTier.PECA, "Selo de peça", 1, wantedBrand, wantedColor));
        SealService.PieceFields compatible = new SealService.PieceFields("Camiseta", "upper_piece", "t_shirt", wantedColor, wantedBrand, List.of(), List.of());
        SealService.PieceFields incompatible = new SealService.PieceFields("Camiseta", "upper_piece", "t_shirt", otherColor, otherBrand, List.of(), List.of());
        assertThat(suggestsBrand(list(seals.previewPiece(anaSession, compatible), "suggestions"), brand)).isTrue();
        assertThat(suggestsBrand(list(seals.previewPiece(anaSession, incompatible), "suggestions"), brand)).isFalse();
    }

    @Test
    void modoAutomaticoDetectaLookCompativelNaPreviaESoLigaAsPecasQueSustentamAPolitica() {
        activeSeal("Duas azuis", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Duas azuis", 2, "Nike", "blue"));
        WardrobeItem a = piece("Nike", "blue"), b = piece("Nike", "blue"), c = piece("Nike", "red"), d = piece("Zara", "blue");
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), b.getId(), c.getId()), List.of(), List.of()), "suggestions"), brand)).isTrue();
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), c.getId()), List.of(), List.of()), "suggestions"), brand)).isFalse();
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), d.getId()), List.of(), List.of()), "suggestions"), brand)).isFalse();
    }

    @Test
    void modoAutomaticoSugereParaPecasELooksSalvosEOsSelosDePecaVinculamSoAsPecasCompativeis() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look Nike", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look Nike", 2, "Nike", "blue"));
        WardrobeItem blue = piece("Nike", "blue"), red = piece("Nike", "red");
        Scheme two = look(blue, red);
        Map<String, Object> out = seals.suggest(anaSession, two.getId());
        List<Map<String, Object>> suggestions = list(out, "suggestions");
        assertThat(suggestions).hasSize(1);                                   // um selo por emissor: só o de peça atende
        SealBond bond = allBonds.stream().filter(x -> x.getStatus() == SealBondStatus.SUGGESTED).findFirst().orElseThrow();
        assertThat(bond.getTier()).isEqualTo(SealTier.PECA);
        assertThat(bond.getOrigin()).isEqualTo(SealBondOrigin.AI_SUGGESTION);
        assertThat(Json.strings(bond.getLinkedPieceIdsJson())).containsExactly(blue.getId().toString());
        Scheme none = look(red);
        assertThat(list(seals.suggest(anaSession, none.getId()), "suggestions")).isEmpty();
    }

    // ------------------------------------------------------------------ seletor manual

    @Test
    void seletorManualVinculaMarcaCompativelEmPecaELookComOrigemManual() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme single = look(piece("Nike", "blue"));
        Map<String, Object> bondOfPiece = seals.linkManually(anaSession, single.getId(), brand.getId(), null);
        assertThat(bondOfPiece.get("status")).isEqualTo(SealBondStatus.APPROVED);
        SealBond pieceBond = allBonds.get(0);
        assertThat(pieceBond.getOrigin()).isEqualTo(SealBondOrigin.MANUAL);
        assertThat(pieceBond.getTier()).isEqualTo(SealTier.PECA);

        Scheme multi = look(piece("Nike", "blue"), piece("Nike", "blue"));
        seals.linkManually(anaSession, multi.getId(), brand.getId(), null);
        SealBond lookBond = allBonds.get(1);
        assertThat(lookBond.getOrigin()).isEqualTo(SealBondOrigin.MANUAL);
        assertThat(lookBond.getTier()).isEqualTo(SealTier.LOOK);
        assertThat(lookBond.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(lookBond.getSeal().getName()).isEqualTo("Look azul");
    }

    @Test
    void seletorManualNaoEmiteSeloParaPecaOuLookIncompativeis() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme redPiece = look(piece("Nike", "red"));
        Scheme mixedLook = look(piece("Nike", "blue"), piece("Nike", "red"));
        for (Scheme s : List.of(redPiece, mixedLook)) {
            assertThatThrownBy(() -> seals.linkManually(anaSession, s.getId(), brand.getId(), null))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isIn(400, 409));
        }
        assertThat(allBonds).noneMatch(x -> x.getStatus() == SealBondStatus.APPROVED);
    }

    @Test
    void automaticoEManualConcordamSobreACompatibilidadeDoMesmoLook() {
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme compatible = look(piece("Nike", "blue"), piece("Nike", "blue"));
        Scheme incompatible = look(piece("Nike", "blue"), piece("Zara", "blue"));
        assertThat(list(seals.suggest(anaSession, compatible.getId()), "suggestions")).hasSize(1);
        assertThat(list(seals.suggest(anaSession, incompatible.getId()), "suggestions")).isEmpty();
        assertThat(seals.linkManually(anaSession, compatible.getId(), brand.getId(), null)).containsKey("id");
        assertThatThrownBy(() -> seals.linkManually(anaSession, incompatible.getId(), brand.getId(), null)).isInstanceOf(ApiException.class);
    }
}
