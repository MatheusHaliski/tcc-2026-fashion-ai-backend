package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Perfil institucional: ordenação das abas de destaque, feeds "Em alta" de marcas/celebridades, peças em destaque e catálogo do visitante. */
class InstitutionalDisplayRankingTest extends InstitutionalDisplayPolicyFixture {
    // ------------------------------------------------------------------ ordenação das abas de destaque (Lote A2 · P3-17)

    @Test
    void ordenacaoRecentesHypeEEmCrescimentoSoMudaAOrdemNuncaQuemAparece() {
        Scheme classico = look("Clássico (Hype alto, parado)", tenis);
        Scheme subindo = look("Subindo (Hype médio, trend alto)", jeans);
        Scheme semHype = look("Sem Hype", camiseta);
        Scheme pessoal = look("Hype só pessoal", camiseta);
        bond(classico, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(9, ChronoUnit.DAYS), null);
        bond(subindo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(5, ChronoUnit.DAYS), null);
        bond(semHype, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(pessoal, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(3, ChronoUnit.DAYS), null);
        hype(classico, 88, 35, -1);
        hype(subindo, 61, 82, 9);
        hype(pessoal, 99, 99, 20).setPublicEligible(false);
        bond(look("Rejeitado", tenis), SealBondStatus.REJECTED, SealTier.LOOK, now, null);   // a política continua valendo

        assertThat(ids(service.highlightedSchemes(visitor, brand, "RECENTES", null)))
                .containsExactly(semHype.getId(), pessoal.getId(), subindo.getId(), classico.getId());
        assertThat(ids(service.highlightedSchemes(visitor, brand, "HYPE", null)))
                .containsExactly(classico.getId(), subindo.getId(), semHype.getId(), pessoal.getId());
        // crescimento = TREND do v2, não volume: o look médio que está subindo passa o clássico parado; sem Hype público no fim
        assertThat(ids(service.highlightedSchemes(visitor, brand, "GROWTH", null)))
                .containsExactly(subindo.getId(), classico.getId(), semHype.getId(), pessoal.getId());
        // consagrados (histórico) e peças em destaque aceitam a mesma ordenação
        assertThat(ids(service.consecrated(visitor, brand, "GROWTH", null, false))).startsWith(subindo.getId(), classico.getId());
        assertThat(service.highlightedPieces(visitor, brand, "GROWTH", null)).extracting(m -> ((Views.PieceView) m.get("piece")).id())
                .startsWith(jeans.getId(), tenis.getId());
    }

    @Test
    void empateNoCrescimentoDecidePeloDelta() {
        Scheme a = look("A", tenis);
        Scheme b = look("B", jeans);
        approved(a);
        approved(b);
        hype(a, 50, 70, 1);
        hype(b, 50, 70, 6);
        assertThat(ids(service.highlightedSchemes(visitor, brand, "growth", null))).containsExactly(b.getId(), a.getId());
    }

    // ------------------------------------------------------------------ /brands: ordem "Em alta" (Lote A2 · P2-05)

    private static br.com.fashionai.domain.model.BrandProfile brandProfile(String name) {
        br.com.fashionai.domain.model.BrandProfile b = new br.com.fashionai.domain.model.BrandProfile();
        b.setOwner(user(name.toLowerCase(), ProfileType.MARCA));
        b.setBrandName(name);
        b.setSlug(name.toLowerCase());
        return b;
    }

    @Test
    @SuppressWarnings("unchecked")
    void feedDeMarcasEmAltaOrdenaPeloHypeAgregadoESemBaseFicaNoFim() {
        var nova = brandProfile("Nova");
        var media = brandProfile("Media");
        var topo = brandProfile("Topo");
        var pouca = brandProfile("Pouca");
        when(brandProfiles.findByApprovalStatusOrderByCreatedAtDesc(any())).thenReturn(List.of(nova, media, topo, pouca));
        Map<String, Object> groups = new HashMap<>();
        groups.put("media", Map.of("key", "media", "sufficient", true, "value", 55.0, "level", "RELEVANT", "items", 4));
        groups.put("topo", Map.of("key", "topo", "sufficient", true, "value", 81.0, "level", "TRENDING", "items", 6));
        groups.put("pouca", Map.of("key", "pouca", "sufficient", false, "items", 2));
        when(hypeQuery.groups(any(), eq(HypeQueryService.RankGroup.BRAND), anyCollection(), eq(7))).thenReturn(Map.of("items", groups));

        Map<String, Object> out = service.brandFeed(null, null, "EM_ALTA");
        List<Map<String, Object>> cards = (List<Map<String, Object>>) out.get("brands");
        assertThat(cards).extracting(m -> m.get("name")).containsExactly("Topo", "Media", "Nova", "Pouca");   // sem base: ordem recente
        assertThat(out.get("order")).isEqualTo("EM_ALTA");
        assertThat((List<String>) out.get("orders")).contains("AFINIDADE", "RECENTES", "EM_ALTA");
        assertThat(cards.get(0).get("hype")).isEqualTo(groups.get("topo"));
        assertThat(cards.get(2).get("hype")).isNull();                                        // sem dado: nada (nunca 0)
        // as outras ordens não mudam, mas o card também traz o Hype
        List<Map<String, Object>> recent = (List<Map<String, Object>>) service.brandFeed(null, null, "RECENTES").get("brands");
        assertThat(recent).extracting(m -> m.get("name")).containsExactly("Nova", "Media", "Topo", "Pouca");
        assertThat(recent.get(1).get("hype")).isEqualTo(groups.get("media"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void feedDeCelebridadesUsaOAgregadoDeCriadorPeloIdDaPessoa() {
        var c1 = new br.com.fashionai.domain.model.CelebrityProfile();
        c1.setOwner(ana);
        c1.setStageName("Ana Star");
        c1.setSlug("ana-star");
        when(celebrityProfiles.findByVerificationStatusOrderByCreatedAtDesc(any())).thenReturn(List.of(c1));
        when(hypeQuery.groups(any(), eq(HypeQueryService.RankGroup.CREATOR), anyCollection(), eq(7)))
                .thenReturn(Map.of("items", Map.of(ana.getId().toString(), Map.of("sufficient", true, "value", 77.0, "level", "TRENDING"))));
        List<Map<String, Object>> cards = (List<Map<String, Object>>) service.celebrityFeed(visitor, null, "EM_ALTA").get("celebrities");
        assertThat(cards).singleElement().satisfies(m -> assertThat((Map<String, Object>) m.get("hype")).containsEntry("level", "TRENDING"));
    }

    // ------------------------------------------------------------------ peças em destaque

    @SuppressWarnings("unchecked")
    private Map<UUID, Integer> sealsPerPiece(List<Map<String, Object>> entries) {
        Map<UUID, Integer> out = new java.util.LinkedHashMap<>();
        for (Map<String, Object> e : entries) {
            out.put(((Views.PieceView) e.get("piece")).id(), ((List<Map<String, Object>>) e.get("seals")).size());
        }
        return out;
    }

    @Test
    void seloDePecaDestacaSoAsPecasVinculadas() {
        Scheme s = look("Tênis em destaque", tenis, jeans, camiseta);
        bond(s, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, tenis);
        Map<UUID, Integer> got = sealsPerPiece(service.highlightedPieces(visitor, brand, null, null));
        assertThat(got).containsOnlyKeys(tenis.getId());
    }

    @Test
    void seloDeLookDestacaTodasAsPecasECadaPecaLevaSoOsSelosQueACobrem() {
        Scheme a = look("Look inteiro", tenis, jeans);
        Scheme b = look("Só o tênis", tenis, camiseta);
        approved(a);
        bond(b, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, tenis);
        Map<UUID, Integer> got = sealsPerPiece(service.highlightedPieces(visitor, brand, null, null));
        assertThat(got).containsOnlyKeys(tenis.getId(), jeans.getId());
        assertThat(got.get(tenis.getId())).isEqualTo(2);     // selo do look A + selo de peça do look B
        assertThat(got.get(jeans.getId())).isEqualTo(1);
    }

    @Test
    void pecaPrivadaEmModeracaoOuArquivadaNaoApareceMesmoEmLookPublico() {
        Scheme s = look("Look público", tenis, jeans, camiseta);
        approved(s);
        jeans.setVisibility(Visibility.PRIVATE);
        camiseta.setModerationStatus(ModerationStatus.PENDING);
        tenis.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
        assertThat(destaque(visitor)).containsExactly(s.getId());      // o look continua; as peças não
    }

    @Test
    void pecasDoLegadoHighlightedSeguemAMesmaPolitica() {
        Scheme s = look("Legado", tenis, jeans);
        bond(s, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, jeans);
        Map<String, Object> both = service.highlighted(visitor, brand, null, null);
        assertThat((List<?>) both.get("schemes")).hasSize(1);
        assertThat(sealsPerPiece(castList(both.get("pieces")))).containsOnlyKeys(jeans.getId());
        assertThat(both.get("empty")).isNull();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castList(Object o) {
        return (List<Map<String, Object>>) o;
    }

    // ------------------------------------------------------------------ catálogo

    @Test
    void catalogoDoVisitanteSoMostraPecasAprovadasEVisiveisOAdministradorVeTudo() {
        WardrobeItem publica = piece(brand, "Pública");
        WardrobeItem privada = piece(brand, "Privada");
        privada.setVisibility(Visibility.PRIVATE);
        WardrobeItem moderacao = piece(brand, "Em moderação");
        moderacao.setModerationStatus(ModerationStatus.PENDING);
        WardrobeItem arquivada = piece(brand, "Arquivada");
        arquivada.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        brandCatalog.addAll(List.of(publica, privada, moderacao, arquivada));
        CurrentUser admin = new CurrentUser(brand.getId(), "maison", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
        assertThat(service.catalog(visitor, brand, null, false)).extracting(m -> ((Views.PieceView) m.get("piece")).id()).containsExactly(publica.getId());
        assertThat(service.catalog(null, brand, null, false)).hasSize(1);
        assertThat(service.catalog(admin, brand, null, true)).extracting(m -> ((Views.PieceView) m.get("piece")).id())
                .containsExactly(publica.getId(), privada.getId(), moderacao.getId());
    }
}
