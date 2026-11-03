package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * @ reservado ou vazio, link oficial exigido no cadastro de emissor e a caracterização da cadeia de validação do
 * cadastro (antes em IdentitySecurityTest).
 */
class IdentityRegistrationSecurityTest extends IdentitySecurityFixture {
    // ------------------------------------------------------------------ @ do cadastro

    @Test
    void usernameQueNormalizaParaVazioOuReservadoERecusado() {
        for (String bad : new String[]{"!!!", "@@", "admin", "@Suporte", "FashionAI"}) {
            ApiException ex = error(() -> identity.register(register(bad), "1.1.1.1", "ua"));
            assertEquals("FORMULARIO_INVALIDO", ex.code(), bad);
            assertTrue(((Map<?, ?>) ex.details()).containsKey("username"), bad);
        }
        assertTrue(IdentityService.reservedUsername("moderador"));
        assertNotEquals("admin", identity.suggestUsername("Admin"));
    }

    // ------------------------------------------------------------------ link oficial no cadastro de emissor

    /**
     * Política de verificação: o perfil oficial da celebridade (onde o analista procura o código FAI-…) e o site da marca
     * são critérios obrigatórios — sem eles o pedido nunca poderia ser aprovado, então o cadastro já os exige.
     */
    @Test
    void cadastroDeCelebridadeExigeOLinkDoPerfilOficial() {
        for (String link : new String[]{null, " ", "@samuelrosa"}) {
            var celeb = new IdentityService.CelebrityData("Samuel Rosa", "Samuel Rosa Silva", "pending/x/id.png", "pending/x/foto.png", List.of("música"),
                    Map.of(), link, null, null, List.of(), true);
            var cmd = new IdentityService.RegisterCommand(ProfileType.CELEBRIDADE, "Samuel Rosa", "samuel", "samuel@exemplo.com", "Senha@Forte1",
                    "Senha@Forte1", true, "1990-01-01", "BR", null, celeb, null, MannequinSex.MASCULINO);
            ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
            assertEquals("FORMULARIO_INVALIDO", ex.code(), String.valueOf(link));
            assertTrue(((Map<?, ?>) ex.details()).containsKey("celebrity.verificationUrl"), String.valueOf(link));
        }
    }

    @Test
    void cadastroDeMarcaExigeOSiteOficial() {
        var brand = new IdentityService.BrandData("Atelier Lume Ltda", "11.222.333/0001-81", "Atelier Lume", "pending/x/logo.png", "casual",
                null, null, null, null);
        var cmd = new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier Lume", "atelierlume", "contato@exemplo.com", "Senha@Forte1",
                "Senha@Forte1", true, "1990-01-01", "BR", brand, null, null, null);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertTrue(((Map<?, ?>) ex.details()).containsKey("brand.storeUrl"));
    }

    @Test
    void linkDigitadoSemHttpsViraUrlCompleta() {
        assertEquals("https://instagram.com/samuelrosa", IssuerVerificationPolicy.normalizeUrl(" instagram.com/samuelrosa "));
        assertEquals("https://www.atelierlume.com.br", IssuerVerificationPolicy.normalizeUrl("www.atelierlume.com.br"));
        assertEquals("https://x.com/a", IssuerVerificationPolicy.normalizeUrl("https://x.com/a"));
        assertEquals("@samuelrosa", IssuerVerificationPolicy.normalizeUrl("@samuelrosa"));     // sem domínio: a validação recusa
        assertNull(IssuerVerificationPolicy.normalizeUrl("  "));
        assertTrue(IssuerVerificationPolicy.webUrl(IssuerVerificationPolicy.normalizeUrl("tiktok.com/@samuel")));
    }

    // ------------------------------------------------------------------ caracterização da cadeia de validação do cadastro

    @Test
    void cadastroPessoalInvalidoListaOsErrosNaOrdemDoFormulario() {
        var cmd = new IdentityService.RegisterCommand(null, " a ", "!!", "sem-arroba", "fraca", "outra", false, "2020-01-01",
                null, null, null, null, null);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertEquals(List.of("fullName", "email", "password", "confirmPassword", "acceptTerms", "birthDate", "sex", "username"),
                errorKeys(ex));
        Map<?, ?> details = (Map<?, ?>) ex.details();
        assertEquals(br.com.fashionai.application.common.Msg.t("identity.o_fashion_ai_e_destinado"), details.get("birthDate"));
        assertEquals(br.com.fashionai.application.common.Msg.t("preferences.o_precisa_de_ao_menos"), details.get("username"));
    }

    @Test
    void cadastroComDataMalFormadaESenhaNulaNaoComparaConfirmacao() {
        var cmd = new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Pessoa Nova", "admin", "nova@exemplo.com", null, "x",
                true, "01/01/1990", "BR", null, null, null, MannequinSex.FEMININO);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertEquals(List.of("password", "birthDate", "username"), errorKeys(ex));
        Map<?, ?> details = (Map<?, ?>) ex.details();
        assertEquals(br.com.fashionai.application.common.Msg.t("identity.data_invalida_use_aaaa_mm"), details.get("birthDate"));
        assertEquals(br.com.fashionai.application.common.Msg.t("identity.username_reservado"), details.get("username"));
    }

    @Test
    void cadastroDeMarcaSemDadosNaoExigeManequim() {
        var cmd = new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier Lume", "atelierlume", "contato@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, null, "BR", null, null, null, null);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertEquals(List.of("brand.razaoSocial", "brand.cnpj", "brand.logoUrl", "brand.storeUrl"), errorKeys(ex));
    }

    @Test
    void cadastroDeMarcaComCnpjESiteInvalidos() {
        var brand = new IdentityService.BrandData("Atelier Lume Ltda", "11.111.111/1111-11", "Atelier Lume", null, "casual",
                "@lume", null, null, null);
        var cmd = new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier Lume", null, "contato@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, null, "BR", brand, null, null, null);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertEquals(List.of("brand.cnpj", "brand.logoUrl", "brand.storeUrl"), errorKeys(ex));
        assertEquals(br.com.fashionai.application.common.Msg.t("issuerReview.link_invalido"),
                ((Map<?, ?>) ex.details()).get("brand.storeUrl"));
    }

    @Test
    void cadastroDeCelebridadeSemDadosListaTodosOsCriterios() {
        var cmd = new IdentityService.RegisterCommand(ProfileType.CELEBRIDADE, "Samuel Rosa", "samuel", "samuel@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, null, "BR", null, null, null, null);
        ApiException ex = error(() -> identity.register(cmd, "1.1.1.1", "ua"));
        assertEquals(List.of("celebrity.stageName", "celebrity.realName", "celebrity.identityProofUrl",
                "celebrity.officialPhotoUrl", "celebrity.verificationUrl", "sex"), errorKeys(ex));
    }

    @Test
    void cadastroDeAdminERecusadoAntesDaValidacao() {
        var cmd = new IdentityService.RegisterCommand(ProfileType.ADMIN, "", null, "", null, null, false, null, null, null,
                null, null, null);
        assertEquals("TIPO_INVALIDO", error(() -> identity.register(cmd, "1.1.1.1", "ua")).code());
    }
}
