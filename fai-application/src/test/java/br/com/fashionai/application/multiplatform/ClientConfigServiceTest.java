package br.com.fashionai.application.multiplatform;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** MP-1 — Configuração por plataforma: perfil de qualidade da família, atualização obrigatória e o que vai a outro aparelho. */
class ClientConfigServiceTest {
    private final ClientConfigService service = new ClientConfigService("1.2.0");

    @Test
    @SuppressWarnings("unchecked")
    void consoleSemCameraEComContinuacaoNoCelular() {
        Map<String, Object> c = service.config(ClientPlatform.PLAYSTATION, "1.2.0", null);
        assertThat(c.get("qualityProfile")).isEqualTo("CONSOLE");
        assertThat(((Map<?, ?>) c.get("capabilities")).get("camera")).isEqualTo(false);
        assertThat((List<Object>) c.get("continueElsewhere")).contains("AVATAR_PHOTOS", "ACCOUNT_DELETION");
        assertThat(c.get("inputs")).isEqualTo(List.of("GAMEPAD"));
        assertThat(c.get("updateRequired")).isEqualTo(false);
    }

    @Test
    void perfilDeOutraFamiliaCaiNoMaisLeveDaFamilia() {
        assertThat(QualityProfile.resolve(ClientPlatform.ANDROID, "DESKTOP_HIGH")).isEqualTo(QualityProfile.MOBILE_LOW);
        assertThat(QualityProfile.resolve(ClientPlatform.IOS, "mobile_high")).isEqualTo(QualityProfile.MOBILE_HIGH);
        assertThat(QualityProfile.resolve(ClientPlatform.WINDOWS, null)).isEqualTo(QualityProfile.DESKTOP_MID);
        assertThat(QualityProfile.DESKTOP_HIGH.fallbackChain()).containsExactly(QualityProfile.DESKTOP_HIGH, QualityProfile.DESKTOP_MID);
    }

    @Test
    void versaoAntigaExigeAtualizacao() {
        assertThat(service.config(ClientPlatform.IOS, "1.1.9", null).get("updateRequired")).isEqualTo(true);
        assertThat(service.config(ClientPlatform.IOS, "1.10.0-beta", null).get("updateRequired")).isEqualTo(false);
        assertThat(ClientConfigService.compare("2", "1.9.9")).isPositive();
    }

    @Test
    void semCabecalhoContinuaSendoWeb() {
        assertThat(ClientPlatform.parse(null)).isEqualTo(ClientPlatform.WEB);
        assertThat(ClientPlatform.parse("nintendo")).isEqualTo(ClientPlatform.WEB);
        assertThat(ClientPlatform.parse("xbox")).isEqualTo(ClientPlatform.XBOX);
    }
}
