package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** RF3.CA10 sessões ativas (listar, encerrar, encerrar as outras) e as regras de @, senha e CNPJ do cadastro. */
class IdentityServiceSessoesTest {
    Kit kit;
    IdentityService service;
    User ana;
    CurrentUser me;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        me = Kit.as(ana);
        service = kit.build(IdentityService.class);
    }

    RefreshToken token(User u, UUID family, Instant expires, Instant created) {
        RefreshToken t = new RefreshToken();
        t.setUser(u);
        t.setFamilyId(family);
        t.setExpiresAt(expires);
        t.setDeviceName("Chrome Windows");
        t = kit.dep(RefreshTokenRepository.class).save(t);
        t.markCreatedAt(created);
        return t;
    }

    @Test
    void sessoesUmaPorFamiliaComAMaisRecente() {
        UUID atual = UUID.randomUUID();
        UUID outra = UUID.randomUUID();
        Instant futuro = Instant.now().plusSeconds(3600);
        token(ana, atual, futuro, Instant.now().minusSeconds(100));
        RefreshToken novo = token(ana, atual, futuro, Instant.now());
        novo.setDeviceName("Novo");
        token(ana, outra, futuro, Instant.now());
        token(ana, UUID.randomUUID(), Instant.now().minusSeconds(5), Instant.now());   // expirada
        List<Map<String, Object>> s = service.sessions(me, atual);
        assertThat(s).hasSize(2);
        Map<String, Object> cur = s.stream().filter(m -> m.get("sessionId").equals(atual)).findFirst().orElseThrow();
        assertThat(cur).containsEntry("current", true).containsEntry("device", "Novo");
        assertThat(s.stream().filter(m -> m.get("sessionId").equals(outra)).findFirst().orElseThrow()).containsEntry("current", false);

        assertThat(service.revokeOtherSessions(ana.getId(), atual)).isEqualTo(1);
        assertThat(service.sessionActive(outra)).isFalse();
        assertThat(service.sessionActive(atual)).isTrue();
        assertThat(service.sessionActive(null)).isFalse();
        service.logout(me, atual);
        assertThat(service.sessionActive(atual)).isFalse();
        assertThat(service.sessions(me, atual)).isEmpty();
    }

    @Test
    void encerrarSessaoSoDaPropriaPessoa() {
        UUID fam = UUID.randomUUID();
        RefreshToken t = token(ana, fam, Instant.now().plusSeconds(60), Instant.now());
        User bia = kit.dep(UserRepository.class).save(Kit.user("bia"));
        assertThatThrownBy(() -> service.revokeSession(Kit.as(bia), fam)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        assertThatThrownBy(() -> service.revokeSession(me, UUID.randomUUID())).isInstanceOf(ApiException.class);
        service.revokeSession(me, fam);
        assertThat(t.getRevokedAt()).isNotNull();
        Instant antes = t.getRevokedAt();
        service.revokeSession(me, fam);                 // já revogado: mantém a data
        assertThat(t.getRevokedAt()).isEqualTo(antes);
    }

    @Test
    void senhaForte() {
        for (String fraca : new String[]{null, "Ab1!", "abcdefg1!", "Abcdefgh!", "Abcdefg12"}) {
            Map<String, Object> e = new HashMap<>();
            IdentityService.validatePassword(fraca, e);
            assertThat(e).as(String.valueOf(fraca)).containsKey("password");
        }
        Map<String, Object> ok = new HashMap<>();
        IdentityService.validatePassword("Abcdefg1!", ok);
        assertThat(ok).isEmpty();
    }

    @Test
    void cnpjComDigitosVerificadores() {
        assertThat(IdentityService.validCnpj("11.222.333/0001-81")).isTrue();
        assertThat(IdentityService.validCnpj("11222333000181")).isTrue();
        assertThat(IdentityService.validCnpj("11.222.333/0001-82")).isFalse();
        assertThat(IdentityService.validCnpj("11.222.333/0001-91")).isFalse();
        assertThat(IdentityService.validCnpj("11111111111111")).isFalse();
        assertThat(IdentityService.validCnpj("123")).isFalse();
        assertThat(IdentityService.validCnpj(null)).isFalse();
        assertThat(IdentityService.validCnpj("00.000.000/0001-91")).isTrue();
    }

    @Test
    void arrobaNormalizadaReservadaESugerida() {
        assertThat(IdentityService.normalizeUsername(" @Ana.Silva!# ")).isEqualTo("ana.silva");
        assertThat(IdentityService.normalizeUsername(null)).isEmpty();
        assertThat(IdentityService.normalizeUsername("a".repeat(40))).hasSize(30);
        assertThat(IdentityService.reservedUsername(null)).isFalse();
        assertThat(IdentityService.reservedUsername("ADMIN")).isTrue();
        assertThat(IdentityService.reservedUsername(User.DEMO_PREFIX + "x")).isTrue();
        assertThat(IdentityService.reservedUsername("ana")).isFalse();
        assertThat(IdentityService.usernameProblem("ab")).isNotNull();
        assertThat(IdentityService.usernameProblem(null)).isNotNull();
        assertThat(IdentityService.usernameProblem("suporte")).isNotNull();
        assertThat(IdentityService.usernameProblem("ana_ok")).isNull();

        assertThat(service.suggestUsername("Ana")).isEqualTo("ana1");
        assertThat(service.suggestUsername("Zé")).startsWith("fashion_");
        assertThat(service.suggestUsername("Admin")).isEqualTo("admin1");
        assertThat(service.suggestUsername("Carla Dias")).isEqualTo("carla_dias");

        List<String> sug = service.usernameSuggestions("@Ana");
        assertThat(sug).containsExactly("ana_style", "ana.fai", "ana_" + java.time.LocalDate.now().getYear() % 100);
        kit.dep(UserRepository.class).save(Kit.user("ana_style"));
        assertThat(service.usernameSuggestions("ana")).doesNotContain("ana_style").hasSize(3);
        assertThat(service.usernameSuggestions("x".repeat(30))).allMatch(s -> s.length() == 30);
    }

    @Test
    void emailMascaradoEEscape() {
        assertThat(IdentityService.maskEmail("ana@x.com")).isEqualTo("a***@x.com");
        assertThat(IdentityService.maskEmail("a@x.com")).isEqualTo("***@x.com");
        assertThat(IdentityService.maskEmail("semarroba")).isEqualTo("***semarroba");
        assertThat(IdentityService.escape(null)).isEmpty();
        assertThat(IdentityService.escape("<a&b>")).isEqualTo("&lt;a&amp;b&gt;");
        assertThat(service.findByEmail(null)).isEmpty();
    }
}
