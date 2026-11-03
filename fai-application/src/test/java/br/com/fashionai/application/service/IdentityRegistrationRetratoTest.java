package br.com.fashionai.application.service;

import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do R95 (sobre o IdentityService original): envios do cadastro, cadastro Pessoal/Marca/Celebridade com
 * os arquivos copiados para a conta, recusas de e-mail/@/arquivo, confirmação de e-mail (com análise do emissor),
 * reenvio limitado, regras estáticas e o job que apaga envios abandonados — respostas, chamadas e linhas gravadas.
 */
class IdentityRegistrationRetratoTest extends IdentityRetratoFixture {
    private static final Path GOLDEN = Path.of("src/test/resources/identity/identity-registration-retrato.txt");

    String upload(String kind, String ip) {
        Map<String, Object> out = identity.preRegistrationUpload(png(900, 700), kind, ip);
        r.line("upload." + kind, out);
        return (String) out.get("url");
    }

    @Test
    void retratoDoCadastro() throws Exception {
        r.step("upload.tipoInvalido", () -> identity.preRegistrationUpload(png(10, 10), "cover", "9.9.9.9"));
        r.step("upload.tipoNulo", () -> identity.preRegistrationUpload(png(10, 10), null, "9.9.9.9"));
        r.step("upload.grande", () -> identity.preRegistrationUpload(new byte[8 * 1024 * 1024 + 1], "avatar", "9.9.9.9"));
        r.step("upload.naoImagem", () -> identity.preRegistrationUpload("texto".getBytes(), "avatar", "9.9.9.9"));
        for (int i = 0; i < 30; i++) {
            identity.preRegistrationUpload(png(4, 4), "logo", "8.8.8.8");
        }
        r.step("upload.limite", () -> identity.preRegistrationUpload(png(4, 4), "logo", "8.8.8.8"));
        objects.clear();
        calls();
        String avatar = upload("avatar", "1.1.1.1");
        String logo = upload("logo", "1.1.1.1");
        String proof = upload("activity-proof", "1.1.1.1");
        String photo = upload("official-photo", "1.1.1.1");
        String doc = upload("identity", null);
        calls();

        r.step("register.pessoal", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.PESSOAL, " Ana Clara ",
                "@Ana.Clara", " Ana@Exemplo.com ", PASSWORD, PASSWORD, true, "1990-05-01", "pt", null, null, avatar,
                MannequinSex.FEMININO), "1.1.1.1", "Mozilla/5.0 (Windows NT 10.0) Chrome/120"));
        calls();
        r.step("register.semArroba", () -> identity.register(new IdentityService.RegisterCommand(null, "Bruno Souza", " ",
                "bruno@exemplo.com", PASSWORD, PASSWORD, true, null, null, null, null, null, MannequinSex.MASCULINO), null, null));
        calls();
        var brand = new IdentityService.BrandData("Atelier Lume Ltda", "11.222.333/0001-81", " Atelier Lume ", logo, "casual",
                "www.atelierlume.com.br", "contato@lume.com", "#lume", proof);
        r.step("register.marca", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier Lume",
                "atelierlume", "marca@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", brand, null, null, null), "2.2.2.2", "ua"));
        calls();
        var celeb = new IdentityService.CelebrityData(" Samuel Rosa ", "Samuel Rosa Silva", doc, photo, List.of("música"),
                Map.of("instagram", 1000), "instagram.com/samuelrosa", "Banda", "agente@x.com", List.of("street"), true);
        r.step("register.celebridade", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.CELEBRIDADE,
                "Samuel Rosa", "samuel", "samuel@exemplo.com", PASSWORD, PASSWORD, true, "1980-01-01", "BR", null, celeb, avatar,
                MannequinSex.MASCULINO), "3.3.3.3", "ua"));
        calls();
        var brand2 = new IdentityService.BrandData("Atelier Lume Ltda", "11.222.333/0001-81", null, logo, null,
                "atelierlume.com.br", null, null, null);
        r.step("register.marcaMesmoNome", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.MARCA, "Atelier",
                "lume2", "marca2@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", brand2, null, null, null), "2.2.2.2", "ua"));
        calls();
        r.step("register.emailEmUso", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Ana",
                "outra", "ANA@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", null, null, null, MannequinSex.FEMININO), "1", "ua"));
        r.step("register.arrobaEmUso", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Ana",
                "ana.clara", "nova@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", null, null, null, MannequinSex.FEMININO), "1", "ua"));
        r.step("register.arquivoExterno", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Ana",
                "nova", "nova@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", null, null, "https://evil.com/a.jpg",
                MannequinSex.FEMININO), "1", "ua"));
        r.step("register.arquivoDeOutroTipo", () -> identity.register(new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Ana",
                "nova", "nova@exemplo.com", PASSWORD, PASSWORD, true, null, "BR", null, null, logo, MannequinSex.FEMININO), "1", "ua"));
        calls();
        rows();

        User ana = userNamed("ana.clara");
        User marca = userNamed("atelierlume");
        r.run("resend.limite", () -> {
            for (int i = 0; i < 5; i++) {
                identity.resendEmailVerification(Kit.as(marca));
            }
        });
        r.step("resend.sexto", () -> {
            identity.resendEmailVerification(Kit.as(marca));
            return "ok";
        });
        calls();
        knownCode(marca, VerificationPurpose.EMAIL_VERIFICATION, "123456");
        r.step("verify.errado", () -> identity.verifyEmail(Kit.as(marca), "000000"));
        r.step("verify.marca", () -> identity.verifyEmail(Kit.as(marca), " 123456 "));
        r.step("verify.jaConfirmado", () -> identity.verifyEmail(Kit.as(marca), "000000"));
        knownCode(ana, VerificationPurpose.EMAIL_VERIFICATION, "654321");
        r.step("verify.pessoal", () -> identity.verifyEmail(Kit.as(ana), "654321"));
        r.run("resend.jaConfirmado", () -> identity.resendEmailVerification(Kit.as(ana)));
        calls();

        statics();
        ana.setAvatarUrl("http://media/pending/keep/avatar.jpg");
        objects.put("pending/keep/avatar.jpg", new byte[1]);
        objects.put("restricted/pending/old/identity.jpg", new byte[1]);
        org.mockito.Mockito.doThrow(new IllegalStateException("falha")).when(storage).delete("restricted/pending/old/identity.jpg");
        r.line("purge", identity.purgeStalePendingUploads());
        calls();
        rows();
        assertThat(r.text()).isEqualTo(IdentityRetrato.golden(r.text(), GOLDEN));
    }

    void statics() {
        for (String p : new String[]{null, "curta1!", "semnumero!A", "Senha@Forte1", "SENHAFORTE1", "senha@forte1"}) {
            Map<String, Object> errors = new java.util.LinkedHashMap<>();
            IdentityService.validatePassword(p, errors);
            r.line("validatePassword." + p, errors);
        }
        for (String c : new String[]{null, "11.222.333/0001-81", "11111111111111", "11.222.333/0001-82", "123"}) {
            r.line("validCnpj." + c, IdentityService.validCnpj(c));
        }
        for (String u : new String[]{null, " @Ana.Clara! ", "demo_x", "admin", "ab", "a".repeat(40)}) {
            String n = IdentityService.normalizeUsername(u);
            r.line("username." + u, List.of(n, IdentityService.reservedUsername(n), String.valueOf(IdentityService.usernameProblem(n))));
        }
        r.line("reserved.null", IdentityService.reservedUsername(null));
        r.line("problem.null", IdentityService.usernameProblem(null));
        r.line("suggest", List.of(identity.suggestUsername("Ana Clara"), identity.suggestUsername("Admin"), identity.suggestUsername("Zé")));
        r.line("suggestions", identity.usernameSuggestions("Ana.Clara"));
        r.line("mask", List.of(IdentityService.maskEmail("ana@x.com"), IdentityService.maskEmail("a@x.com"), IdentityService.maskEmail("semarroba")));
        r.line("escape", List.of(IdentityService.escape(null), IdentityService.escape("<b>&</b>")));
        r.line("findByEmail", List.of(identity.findByEmail(" ANA@exemplo.com ").isPresent(), identity.findByEmail(null).isPresent()));
    }
}
