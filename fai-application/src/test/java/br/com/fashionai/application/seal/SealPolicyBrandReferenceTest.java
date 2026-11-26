package br.com.fashionai.application.seal;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Exercício 13 — marca exigida pela política do selo por ID (catálogo ou perfil), com a regra textual antiga intacta. */
class SealPolicyBrandReferenceTest {
    private final BrandRepository brands = mock(BrandRepository.class);
    private final BrandProfileRepository profiles = mock(BrandProfileRepository.class);
    private final SealPolicyBrandResolver resolver = new SealPolicyBrandResolver(() -> brands, profiles);
    private Brand zara;
    private Brand zaraHome;
    private BrandProfile perfil;

    @BeforeEach
    void marcas() {
        zara = brand("Zara");
        zaraHome = brand("Zara Home");
        perfil = new BrandProfile();
        ReflectionTestUtils.setField(perfil, "id", UUID.randomUUID());
        perfil.setBrandName("Ateliê Aurora");
        perfil.setSlug("atelie-aurora");
        when(brands.findById(zara.getId())).thenReturn(Optional.of(zara));
        when(brands.findById(zaraHome.getId())).thenReturn(Optional.of(zaraHome));
        when(profiles.findById(perfil.getId())).thenReturn(Optional.of(perfil));
    }

    private static Brand brand(String name) {
        Brand b = new Brand();
        ReflectionTestUtils.setField(b, "id", UUID.randomUUID());
        b.setName(name);
        b.setSlug(name.toLowerCase().replace(' ', '-'));
        return b;
    }

    private static WardrobeItem piece(Brand brand, BrandProfile profile, String typedName) {
        WardrobeItem w = new WardrobeItem();
        ReflectionTestUtils.setField(w, "id", UUID.randomUUID());
        w.setCategory("upper_piece");
        w.setColor("navy");
        w.setBrand(brand);
        w.setBrandProfile(profile);
        w.setBrandName(typedName);
        return w;
    }

    private static Map<String, Object> rule(String kind, Object id) {
        return Map.of("quantifier", "AT_LEAST", "count", 1, "brandReference", Map.of("kind", kind, "id", String.valueOf(id), "nome", "nome enviado pela tela"));
    }

    private Map<String, Object> saved(Map<String, Object> rule) {
        Map<String, Object> policy = SealPolicies.normalize(Map.of("rules", List.of(rule)));
        resolver.resolve(policy, null);
        return policy;
    }

    private static boolean matches(Map<String, Object> policy, WardrobeItem piece) {
        return SealPolicies.evaluate(SealPolicies.parse(policy), SealTier.LOOK, List.of(piece), List.of(), List.of()).matched();
    }

    @Test
    void gravaTipoIdENomeDoBancoEComparaPeloId() {
        Map<String, Object> policy = saved(rule("CATALOG", zara.getId()));
        Map<?, ?> reference = (Map<?, ?>) ((Map<?, ?>) ((List<?>) policy.get("rules")).get(0)).get("brandReference");
        assertEquals(Map.of("kind", "CATALOG", "id", zara.getId().toString(), "nome", "Zara"), reference);
        assertNull(((Map<?, ?>) ((List<?>) policy.get("rules")).get(0)).get("brand"));
        assertTrue(matches(policy, piece(zara, null, null)));
        assertEquals("ao menos uma peça da marca Zara", SealPolicies.describe(SealPolicies.parse(policy), SealTier.LOOK));
    }

    @Test
    void marcaDeNomeParecidoOuNomeDigitadoIgualNaoAtende() {
        Map<String, Object> policy = saved(rule("CATALOG", zara.getId()));
        assertFalse(matches(policy, piece(zaraHome, null, "Zara")));      // outra marca do catálogo, nome parecido
        assertFalse(matches(policy, piece(null, null, "Zara")));          // só o nome digitado na peça, sem vínculo
        assertFalse(matches(policy, piece(null, perfil, "Zara")));        // perfil de marca não é a marca do catálogo
    }

    @Test
    void renomearAMarcaNaoMudaOResultadoPorqueOIdEhOMesmo() {
        Map<String, Object> policy = saved(rule("CATALOG", zara.getId()));
        zara.setName("ZARA Brasil");
        assertTrue(matches(policy, piece(zara, null, null)));
        Map<?, ?> lida = (Map<?, ?>) ((Map<?, ?>) ((List<?>) ((Map<?, ?>) resolver.refresh(policy)).get("rules")).get(0)).get("brandReference");
        assertEquals("ZARA Brasil", lida.get("nome"));
        assertEquals(true, lida.get("disponivel"));
    }

    @Test
    void perfilDeMarcaAtendePeloPerfilDaPecaOuPeloPerfilDonoDaMarcaDoCatalogo() {
        Map<String, Object> policy = saved(rule("PROFILE", perfil.getId()));
        assertTrue(matches(policy, piece(null, perfil, null)));
        zara.setBrandProfile(perfil);
        assertTrue(matches(policy, piece(zara, null, null)));
        assertFalse(matches(policy, piece(zaraHome, null, "Ateliê Aurora")));
    }

    @Test
    void idInexistenteTipoTrocadoOuReferenciaIncompletaVoltam400() {
        assertEquals("MARCA_POLITICA_INVALIDA", assertThrows(ApiException.class, () -> saved(rule("CATALOG", UUID.randomUUID()))).code());
        assertEquals("MARCA_POLITICA_INVALIDA", assertThrows(ApiException.class, () -> saved(rule("PROFILE", zara.getId()))).code());
        assertEquals("MARCA_POLITICA_INVALIDA", assertThrows(ApiException.class, () -> saved(rule("CATALOG", perfil.getId()))).code());
        assertEquals("MARCA_POLITICA_INVALIDA", assertThrows(ApiException.class, () -> saved(rule("LOJA", zara.getId()))).code());
        assertEquals("MARCA_POLITICA_INVALIDA", assertThrows(ApiException.class, () -> saved(rule("CATALOG", "zara"))).code());
        assertEquals(400, assertThrows(ApiException.class, () -> saved(rule("CATALOG", "zara"))).status());
    }

    @Test
    void regraTextualAntigaContinuaLidaComoTextoSemVirarReferencia() {
        Map<String, Object> policy = saved(Map.of("quantifier", "AT_LEAST", "count", 1, "brand", "Zara"));
        Map<?, ?> rule = (Map<?, ?>) ((List<?>) policy.get("rules")).get(0);
        assertEquals("Zara", rule.get("brand"));
        assertFalse(rule.containsKey("brandReference"));
        assertTrue(matches(policy, piece(null, null, "ZARA")));           // similaridade de texto, como antes
        assertEquals(policy, resolver.refresh(policy));                   // a leitura não inventa referência
    }

    @Test
    void marcaQueSumiuApareceComoIndisponivelNaLeituraENaoAtendeNenhumaPeca() {
        Map<String, Object> policy = saved(rule("CATALOG", zara.getId()));
        when(brands.findById(zara.getId())).thenReturn(Optional.empty());
        Map<?, ?> lida = (Map<?, ?>) ((Map<?, ?>) ((List<?>) ((Map<?, ?>) resolver.refresh(policy)).get("rules")).get(0)).get("brandReference");
        assertEquals("Zara", lida.get("nome"));
        assertEquals(false, lida.get("disponivel"));
        assertFalse(matches(policy, piece(zaraHome, null, "Zara")));
        // escolher essa marca num selo que não a tinha é recusado
        assertThrows(ApiException.class, () -> saved(Map.of("brandReference", lida)));
        // o selo que já a tinha gravada continua editável (pausar, renomear): a referência fica com o nome de antes
        Map<String, Object> reenviada = SealPolicies.normalize(Map.of("rules", List.of(Map.of("brandReference", lida))));
        resolver.resolve(reenviada, policy);
        assertEquals("Zara", ((Map<?, ?>) ((Map<?, ?>) ((List<?>) reenviada.get("rules")).get(0)).get("brandReference")).get("nome"));
    }

    @Test
    void opcoesVemDaTabelaDoTipoPedido() {
        when(brands.findTop50ByNameContainingIgnoreCaseOrderByNameAsc("zar")).thenReturn(List.of(zara, zaraHome));
        when(profiles.findTop50ByApprovalStatusAndBrandNameContainingIgnoreCaseOrderByBrandNameAsc(ApprovalStatus.APROVADO, "")).thenReturn(List.of(perfil));
        assertEquals(List.of("Zara", "Zara Home"), resolver.options("catalog", " zar ").stream().map(o -> o.nome()).toList());
        assertEquals(List.of(perfil.getId()), resolver.options("PROFILE", null).stream().map(o -> o.id()).toList());
        assertThrows(ApiException.class, () -> resolver.options("LOJA", ""));
    }
}
