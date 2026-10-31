package br.com.fashionai.application.service;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF53 — métricas do emissor, selos de marca/celebridade das peças e o princípio anti pay-to-win (vínculo/selo nunca vira sinal do Hype). */
class SealHypeIssuerPiecesTest extends SealHypeServiceFixture {
    // ------------------------------------------------------------------ métricas do emissor (Lote A2 · P2-09)

    @Test
    @SuppressWarnings("unchecked")
    void metricasDoEmissorTrazemOHypeDosLooksVinculadosSoPublicos() {
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme alto = look(Visibility.PUBLIC, p1);
        Scheme medio = look(Visibility.PUBLIC, p1);
        Scheme semDados = look(Visibility.PUBLIC, p1);
        Scheme privado = look(Visibility.FOLLOWERS, p1);
        Scheme vencido = look(Visibility.PUBLIC, p1);
        approved(lookSeal, alto, SealTier.LOOK, p1);
        approved(pieceSeal, alto, SealTier.PECA, p1);              // dois selos no mesmo look: conta uma vez
        approved(lookSeal, medio, SealTier.LOOK, p1);
        approved(lookSeal, semDados, SealTier.LOOK, p1);
        approved(lookSeal, privado, SealTier.LOOK, p1);
        approved(lookSeal, vencido, SealTier.LOOK, p1).setExpiresAt(Instant.now().minusSeconds(60));
        HypeScoreCurrent a = hype(alto.getId(), 80, HypeLevel.TRENDING, HypeMomentum.RISING, true);
        a.setDeltaPoints(BigDecimal.valueOf(6));
        HypeScoreCurrent b = hype(medio.getId(), 60, HypeLevel.HOT, HypeMomentum.STABLE, true);
        b.setDeltaPoints(BigDecimal.valueOf(2));
        HypeScoreCurrent insuficiente = hype(semDados.getId(), 0, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, true);
        insuficiente.setStatus(HypeStatus.INSUFFICIENT_DATA);
        insuficiente.setScore(null);
        lookHype.put(alto.getId(), a);
        lookHype.put(medio.getId(), b);
        lookHype.put(semDados.getId(), insuficiente);
        lookHype.put(privado.getId(), hype(privado.getId(), 99, HypeLevel.VIRAL, HypeMomentum.STABLE, false));   // Hype pessoal: fora
        lookHype.put(vencido.getId(), hype(vencido.getId(), 97, HypeLevel.VIRAL, HypeMomentum.STABLE, true));    // vínculo vencido: fora

        Map<String, Object> metrics = seals.issuerMetrics(nikeSession);
        assertThat(metrics).containsKeys("suggested", "approved", "redemptions");   // campos antigos continuam
        Map<String, Object> h = (Map<String, Object>) metrics.get("hype");
        assertThat(h).containsEntry("bonded", 4).containsEntry("withHype", 2).containsEntry("avgScore", 70.0).containsEntry("level", "HOT")
                .containsEntry("deltaPoints", 4.0).containsEntry("direction", "UP").containsEntry("deltaWindowDays", 7);
        List<Map<String, Object>> top = (List<Map<String, Object>>) h.get("top");
        assertThat(top).extracting(t -> t.get("schemeId")).containsExactly(alto.getId().toString(), medio.getId().toString());
        assertThat(top.get(0)).containsEntry("score", 80.0).containsEntry("level", "TRENDING").containsEntry("title", "Look");
    }

    @Test
    @SuppressWarnings("unchecked")
    void metricasDoEmissorSemHypePublicoNaoViramZero() {
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme s = look(Visibility.PUBLIC, p1);
        approved(lookSeal, s, SealTier.LOOK, p1);
        Map<String, Object> h = (Map<String, Object>) seals.issuerMetrics(nikeSession).get("hype");
        assertThat(h).containsEntry("bonded", 1).containsEntry("withHype", 0);
        assertThat(h.get("avgScore")).isNull();
        assertThat(h.get("level")).isNull();
        assertThat(h.get("deltaPoints")).isNull();
        assertThat(h.get("direction")).isNull();
        assertThat((List<?>) h.get("top")).isEmpty();
    }

    // ------------------------------------------------------------------ selos das peças (guarda-roupa)

    @Test
    void selosDasPecasSoAprovadosDeTierPecaVisiveis() {
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal lookSeal = seal(adidas, "Adidas Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Adidas"))));
        WardrobeItem hidden = piece("Diário", "Nike", "black");
        hidden.setVisibility(Visibility.PRIVATE);
        Scheme pub = look(Visibility.PUBLIC, p1, p2, hidden);
        Scheme privLook = look(Visibility.PRIVATE, p2);
        approved(pieceSeal, pub, SealTier.PECA, p1, hidden);
        approved(lookSeal, pub, SealTier.LOOK, p1, p2);           // tier LOOK: não vai para a peça
        approved(pieceSeal, privLook, SealTier.PECA, p2);         // look privado: só o dono vê

        Map<String, Object> out = seals.pieceSeals(visitor, List.of(p1.getId(), p2.getId(), hidden.getId()));
        @SuppressWarnings("unchecked")
        Map<String, List<Map<String, Object>>> items = (Map<String, List<Map<String, Object>>>) out.get("items");
        assertThat(items).containsOnlyKeys(p1.getId().toString(), p2.getId().toString());   // peça privada some
        assertThat(items.get(p1.getId().toString())).singleElement().satisfies(badge -> {
            assertThat(badge).containsEntry("tier", "PECA").containsEntry("owner", "nike").containsEntry("name", "Nike Peça")
                    .containsEntry("premium", false).containsKeys("iconUrl", "design", "linkedPieceIds");
        });
        assertThat(items.get(p2.getId().toString())).isEmpty();
        // o dono vê o selo vindo do próprio look privado
        @SuppressWarnings("unchecked")
        Map<String, List<Map<String, Object>>> mine = (Map<String, List<Map<String, Object>>>) seals.pieceSeals(anaSession, List.of(p2.getId())).get("items");
        assertThat(mine.get(p2.getId().toString())).hasSize(1);
    }

    @Test
    void selosDasPecasAte60Ids() {
        List<UUID> many = IntStream.range(0, 75).mapToObj(i -> UUID.randomUUID()).toList();
        seals.pieceSeals(visitor, many);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<UUID>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(pieceRepo).findByIdIn(captor.capture());
        assertThat(captor.getValue()).hasSize(SealService.MAX_PIECE_SEALS).hasSize(60);
    }

    // ------------------------------------------------------------------ anti pay-to-win

    @Test
    void vinculoESeloNuncaViramSinalDeHype() {
        seal(nike, "Nike em alta", SealTier.LOOK, Map.of("hype", Map.of("minScore", 60)));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        lookHype.put(look.getId(), hype(look.getId(), 75, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        Map<String, Object> suggested = suggestions(seals.suggest(anaSession, look.getId())).get(0);
        UUID bondId = (UUID) suggested.get("id");
        seals.accept(anaSession, bondId, null);                        // marca sem revisão: emite na hora
        assertThat(allBonds).singleElement().satisfies(b -> assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED));
        seals.revoke(nikeSession, bondId, "teste");

        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        verify(events, atLeastOnce()).publishEvent(published.capture());
        assertThat(published.getAllValues()).isNotEmpty().noneMatch(e -> e instanceof DomainEvents.HypeSignal)
                .allMatch(e -> e instanceof DomainEvents.CouponRightsCheck);
        // e não existe tipo de sinal de Hype ligado a selo/vínculo/promoção
        assertThat(HypeSignalType.values()).extracting(Enum::name)
                .noneMatch(n -> n.contains("SEAL") || n.contains("BOND") || n.contains("PROMO") || n.contains("COUPON"));
    }
}
