package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 — Selos × HypeScore no SealService: Copilot/política de perfil, critério de Hype nas sugestões (peça e look),
 * ordem por Hype e "Hype do selo" na listagem.
 */
class SealHypeServiceTest extends SealHypeServiceFixture {
    @Test
    @SuppressWarnings("unchecked")
    void copilotGeraModeloMesmoSemPecasEPublicacaoExigeSuaInferenciaOriginal() {
        var logs = mock(br.com.fashionai.domain.repository.AiInferenceLogRepository.class);
        seals.setSealPolicyContext(logs, mock(br.com.fashionai.domain.repository.BrandRepository.class), mock(BackgroundStudioService.class));
        UUID inferenceId = UUID.randomUUID();
        Map<String, Object> reference = Map.of("version", 1, "tier", "LOOK", "title", "Nike Azul", "description", "Uma peça azul Nike",
                "minPieces", 1, "pieces", List.of(Map.of("count", 1, "brand", "Nike", "color", "blue")));
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            assertThat(call.prompt()).contains("#createsealpolicy", "Uma peça azul Nike");
            assertThat(call.local().get()).isNull();
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Nike Azul", "tier", "LOOK",
                    "policy", Map.of("referenceModel", reference), "design", br.com.fashionai.application.seal.SealDesigns.defaultDesign(false, SealTier.LOOK))));
            assertThat(parsed).isNotNull();
            var log = new br.com.fashionai.domain.model.AiInferenceLog();
            log.setId(inferenceId); log.setUserId(nike.getId()); log.setCapability("COPILOT"); log.setProvider("remote");
            log.setResult(br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS);
            log.setInputSummaryJson(Json.write(call.inputsUsed()));
            when(logs.findById(inferenceId)).thenReturn(Optional.of(log));
            return new AiOutcome<>(parsed, inferenceId, br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS, false,
                    "remote", "test-model", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> draft = seals.draft(nikeSession, SealTier.LOOK, "#createsealpolicy Uma peça azul Nike", null);
        Map<String, Object> policy = (Map<String, Object>) draft.get("policy");
        assertThat(policy.get("aiInferenceId")).isEqualTo(inferenceId.toString());
        when(sealRepo.save(any())).thenAnswer(inv -> { Seal s = inv.getArgument(0); s.assignId(UUID.randomUUID()); allSeals.add(s); return s; });
        var form = new SealService.SealForm("Nike Azul", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, policy);
        assertThat(seals.createSeal(nikeSession, form).get("policy")).isNotNull();
        Map<String, Object> changed = Json.map(Json.write(policy));
        ((Map<String, Object>) changed.get("referenceModel")).put("minPieces", 2);
        var forged = new SealService.SealForm("Forjado", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, changed);
        assertThatThrownBy(() -> seals.createSeal(nikeSession, forged)).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
        var manual = new SealService.SealForm("Manual", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, null);
        assertThatThrownBy(() -> seals.createSeal(nikeSession, manual)).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
    }

    @Test
    void criacaoNaoRecorreAoPalpiteLocalQuandoIAEstaIndisponivel() {
        when(ai.text(any())).thenReturn(new AiOutcome<>(null, UUID.randomUUID(),
                br.com.fashionai.domain.model.enums.AiCallResult.ERROR, true, "local", "local", 0,
                BigDecimal.ZERO, "IA indisponível", null, null));
        assertThatThrownBy(() -> seals.draft(nikeSession, SealTier.LOOK, "#createsealpolicy Peça azul", null))
                .isInstanceOf(br.com.fashionai.application.common.ApiException.class)
                .hasMessage("IA indisponível");
        assertThat(allSeals).isEmpty();
    }

    @Test
    void politicaDePerfilExibeSomenteItensComSelosConquistadosVigentes() {
        Seal earned = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        SealBond bond = approved(earned, look, SealTier.PECA, p1);
        when(bondRepo.findByRequestedByIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getRequestedBy().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        when(pieceRepo.findAllPublic(any())).thenReturn(List.of(p1, p2));
        when(schemeRepo.findAllPublic(any())).thenReturn(List.of(look));
        seal(adidas, "Perfil com Nike Peça", SealTier.PERFIL, Map.of("referenceModel", Map.of(
                "version", 1, "tier", "PERFIL", "target", "BOTH", "title", "Perfil", "description", "Exige Nike Peça",
                "minPieces", 1, "pieces", List.of(Map.of("count", 1)),
                "earnedSeals", Map.of("match", "ALL", "rules", List.of(Map.of("sealId", earned.getId().toString(), "scope", "PIECES", "minCount", 1))))));
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).containsExactly(p1);
        assertThat(seals.profileSchemes(adidas.getId(), s -> true, 60)).containsExactly(look);
        assertThat(seals.profilePieces(adidas.getId(), w -> false, 60)).isEmpty();
        bond.setExpiresAt(Instant.now().minusSeconds(1));
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).isEmpty();
        assertThat(seals.profileSchemes(adidas.getId(), s -> true, 60)).isEmpty();
        bond.setExpiresAt(null); bond.setStatus(SealBondStatus.REVOKED);
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).isEmpty();
    }

    // ------------------------------------------------------------------ sugestões

    @Test
    void sugestoesOrdenadasPorHypeComOHypeDaEntidadeEOTrechoNoPorque() {
        seal(nike, "Nike Club", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        seal(adidas, "Adidas Hot", SealTier.PECA, Map.of("hype", Map.of("minLevel", "HOT")));
        pieceHype.put(p1.getId(), hype(p1.getId(), 50, HypeLevel.RELEVANT, HypeMomentum.STABLE, true));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        List<Map<String, Object>> list = suggestions(seals.preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()));

        assertThat(list).extracting(m -> m.get("name")).containsExactly("Adidas", "Nike");   // Hype desc (sem Hype seria Nike primeiro)
        assertThat(list.get(0).get("hype")).isEqualTo(Map.of("score", 85.0, "level", "TRENDING"));
        assertThat(list.get(1).get("hype")).isEqualTo(Map.of("score", 50.0, "level", "RELEVANT"));
        assertThat((String) list.get(0).get("justification")).contains("peça com Hype ≥ Em alta (atual: 85)");
        assertThat((String) list.get(1).get("justification")).doesNotContain("Hype");
    }

    @Test
    void semServicoDeHypeOCriterioNaoEhAtendidoEAOrdemFicaComoAntes() {
        seal(nike, "Nike Club", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        seal(adidas, "Adidas Hot", SealTier.PECA, Map.of("hype", Map.of("minLevel", "HOT")));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        List<Map<String, Object>> list = suggestions(service().preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()));

        assertThat(list).extracting(m -> m.get("name")).containsExactly("Nike");
        assertThat(list.get(0).get("hype")).isNull();
    }

    @Test
    void criterioDeHypeDoLookSoValeComOLookSalvoEComHype() {
        Seal s = seal(nike, "Nike em alta", SealTier.LOOK, Map.of("hype", Map.of("minScore", 60, "momentum", List.of("RISING"))));
        Scheme look = look(Visibility.PUBLIC, p1, p2);

        // criador de look: o look ainda não existe, então não tem Hype
        assertThat(suggestions(seals.preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()))).isEmpty();
        // look salvo, ainda sem Hype calculado
        assertThat(suggestions(seals.suggest(anaSession, look.getId()))).isEmpty();
        // com Hype ≥ 60 e em crescimento: vínculo SUGERIDO com o Hype do look
        lookHype.put(look.getId(), hype(look.getId(), 72.4, HypeLevel.HOT, HypeMomentum.RISING, true));
        List<Map<String, Object>> list = suggestions(seals.suggest(anaSession, look.getId()));
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("hype")).isEqualTo(Map.of("score", 72.4, "level", "HOT"));
        assertThat((String) list.get(0).get("justification")).contains("look com Hype ≥ 60 e em crescimento (atual: 72)");
        assertThat(allBonds).singleElement().satisfies(b -> {
            assertThat(b.getStatus()).isEqualTo(SealBondStatus.SUGGESTED);
            assertThat(b.getSeal()).isSameAs(s);
        });
        // esfriou: deixa de atender
        lookHype.put(look.getId(), hype(look.getId(), 72.4, HypeLevel.HOT, HypeMomentum.COOLING, true));
        assertThat(suggestions(seals.suggest(anaSession, look.getId()))).isEmpty();
    }

    @Test
    void dnaPreviewUsesSavedLookHypeAndDoesNotWriteBonds() {
        seal(nike, "Nike em alta", SealTier.LOOK, Map.of("hype", Map.of("minScore", 60)));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        assertThat(suggestions(seals.previewScheme(anaSession, look.getId()))).isEmpty();
        lookHype.put(look.getId(), hype(look.getId(), 72, HypeLevel.HOT, HypeMomentum.RISING, true));
        assertThat(suggestions(seals.previewScheme(anaSession, look.getId()))).hasSize(1);
        assertThat(allBonds).isEmpty();
        org.mockito.Mockito.verify(bondRepo, org.mockito.Mockito.never()).save(any());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> seals.previewScheme(visitor, look.getId()))
                .isInstanceOf(br.com.fashionai.application.common.ApiException.class);
    }

    @Test
    void dnaPreviewShowsApprovedAndPendingWithoutDuplicateSuggestions() {
        Seal seal = seal(nike, "Nike", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        SealBond bond = approved(seal, look, SealTier.LOOK, p1, p2);
        assertThat(suggestions(seals.previewScheme(anaSession, look.getId()))).isEmpty();
        assertThat((List<?>) seals.previewScheme(anaSession, look.getId()).get("bonds")).hasSize(1);
        bond.setStatus(SealBondStatus.PENDING_REVIEW);
        assertThat(suggestions(seals.previewScheme(anaSession, look.getId()))).isEmpty();
        assertThat(bond.getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        bond.setStatus(SealBondStatus.REJECTED);
        assertThat(suggestions(seals.previewScheme(anaSession, look.getId()))).hasSize(1);
    }

    // ------------------------------------------------------------------ Hype do selo

    @Test
    void hypeDoSeloEhAMediaDosItensComVinculoAprovado() {
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal empty = seal(nike, "Nike Novo", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme a = look(Visibility.PUBLIC, p1);
        Scheme b = look(Visibility.PUBLIC, p1);
        Scheme priv = look(Visibility.PUBLIC, p1);
        Scheme old = look(Visibility.PUBLIC, p1);
        approved(lookSeal, a, SealTier.LOOK, p1);
        approved(lookSeal, b, SealTier.LOOK, p1);
        approved(lookSeal, priv, SealTier.LOOK, p1);
        approved(lookSeal, old, SealTier.LOOK, p1).setExpiresAt(Instant.now().minusSeconds(60));   // vencido: fora
        SealBond revoked = approved(lookSeal, old, SealTier.LOOK, p1);
        revoked.setStatus(SealBondStatus.REVOKED);                                                     // revogado: fora
        lookHype.put(a.getId(), hype(a.getId(), 80, HypeLevel.TRENDING, HypeMomentum.STABLE, true));
        lookHype.put(b.getId(), hype(b.getId(), 60, HypeLevel.HOT, HypeMomentum.STABLE, true));
        lookHype.put(priv.getId(), hype(priv.getId(), 99, HypeLevel.VIRAL, HypeMomentum.STABLE, false)); // Hype pessoal: fora da média
        lookHype.put(old.getId(), hype(old.getId(), 10, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, true));
        approved(pieceSeal, a, SealTier.PECA, p1, p2);
        pieceHype.put(p1.getId(), hype(p1.getId(), 50, HypeLevel.RELEVANT, HypeMomentum.STABLE, true));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.STABLE, true));

        Map<Object, Object> byName = new HashMap<>();
        seals.sealsOf(visitor, nike.getId()).forEach(v -> byName.put(v.get("name"), v.get("hype")));

        Map<String, Object> expectedLook = new HashMap<>();
        expectedLook.put("avgScore", 70.0);
        expectedLook.put("level", "HOT");
        expectedLook.put("bonded", 3);
        assertThat(byName.get("Nike Look")).isEqualTo(expectedLook);
        Map<String, Object> expectedPiece = new HashMap<>();
        expectedPiece.put("avgScore", 67.5);
        expectedPiece.put("level", "HOT");
        expectedPiece.put("bonded", 2);
        assertThat(byName.get("Nike Peça")).isEqualTo(expectedPiece);
        Map<String, Object> none = new HashMap<>();
        none.put("avgScore", null);
        none.put("level", null);
        none.put("bonded", 0);
        assertThat(byName.get("Nike Novo")).isEqualTo(none);
        assertThat(empty.getId()).isNotNull();
        // a aba MEUS_SELOS (sealsOf do dono) traz o mesmo Hype
        assertThat(seals.sealsOf(nike.getId())).allSatisfy(v -> assertThat(v).containsKey("hype"));
    }
}
