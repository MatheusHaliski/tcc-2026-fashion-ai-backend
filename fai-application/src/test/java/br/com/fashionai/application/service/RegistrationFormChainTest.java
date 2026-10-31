package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegistrationFormChainTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 31);

    private static IdentityService.RegisterCommand pessoal(String birthDate) {
        return new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Pessoa Nova", "pessoa_nova", "nova@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, birthDate, "BR", null, null, null, MannequinSex.FEMININO);
    }

    private static Map<String, Object> run(IdentityService.RegisterCommand cmd, ProfileType type) {
        String mail = cmd.email() == null ? "" : cmd.email().trim().toLowerCase(java.util.Locale.ROOT);
        return RegistrationFormChain.validate(new RegistrationFormChain.Input(cmd, type, mail, TODAY));
    }

    @Test
    void formularioValidoNaoGeraErros() {
        assertTrue(run(pessoal("1990-05-20"), ProfileType.PESSOAL).isEmpty());
    }

    @Test
    void idadeMinimaUsaADataDeReferenciaInjetada() {
        assertTrue(run(pessoal("2013-10-31"), ProfileType.PESSOAL).isEmpty());          // 13 anos exatos
        assertEquals(Msg.t("identity.o_fashion_ai_e_destinado"),
                run(pessoal("2013-11-01"), ProfileType.PESSOAL).get("birthDate"));      // um dia antes dos 13
    }

    @Test
    void elosDeEmissorSoSeAplicamAoTipoDoPerfil() {
        // o mesmo comando pessoal sem dados de marca não aciona as regras de marca/celebridade
        Map<String, Object> asPessoal = run(pessoal(null), ProfileType.PESSOAL);
        assertTrue(asPessoal.isEmpty());
        Map<String, Object> asMarca = run(pessoal(null), ProfileType.MARCA);
        assertEquals(List.of("brand.razaoSocial", "brand.cnpj", "brand.logoUrl", "brand.storeUrl"), List.copyOf(asMarca.keySet()));
    }

    @Test
    void cnpjValidoESiteSemEsquemaPassam() {
        var brand = new IdentityService.BrandData("Atelier Lume Ltda", "11.222.333/0001-81", "Atelier Lume", "pending/x/logo.png",
                "casual", "atelierlume.com.br", null, null, null);
        var cmd = new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier Lume", null, "contato@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, null, "BR", brand, null, null, null);
        assertTrue(run(cmd, ProfileType.MARCA).isEmpty());
    }

    @Test
    void ordemDosElosSegueOFormulario() {
        assertEquals(10, RegistrationFormChain.RULES.size());
        var cmd = new IdentityService.RegisterCommand(ProfileType.CELEBRIDADE, "", "@@", "x", "a", "b", false, "data",
                null, null, null, null, null);
        assertEquals(List.of("fullName", "email", "password", "confirmPassword", "acceptTerms", "birthDate",
                        "celebrity.stageName", "celebrity.realName", "celebrity.identityProofUrl", "celebrity.officialPhotoUrl",
                        "celebrity.verificationUrl", "sex", "username"),
                List.copyOf(run(cmd, ProfileType.CELEBRIDADE).keySet()));
    }

    @Test
    void usernameEmBrancoFicaParaASugestaoDoServico() {
        var cmd = new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Pessoa Nova", "   ", "nova@exemplo.com",
                "Senha@Forte1", "Senha@Forte1", true, null, "BR", null, null, null, MannequinSex.MASCULINO);
        assertTrue(run(cmd, ProfileType.PESSOAL).isEmpty());
    }
}
