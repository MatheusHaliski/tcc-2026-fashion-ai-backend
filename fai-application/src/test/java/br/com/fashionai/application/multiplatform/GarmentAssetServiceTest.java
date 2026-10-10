package br.com.fashionai.application.multiplatform;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MP-2 — Asset 3D de roupa: gate automático → revisão humana → aprovado; aprovar aposenta a versão anterior. */
class GarmentAssetServiceTest {
    private Kit kit;
    private GarmentAssetService service;
    private CurrentUser admin;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        service = kit.build(GarmentAssetService.class);
        admin = Kit.admin(Kit.user("admin"));
    }

    private Map<String, Object> register(UUID piece, Map<String, Object> metrics) {
        return service.register(admin, new GarmentAssetService.RegisterCommand(piece, null, "FAI_BODY_V1", "PATTERN", "NONE", null,
                metrics, Map.of("MOBILE_LOW", Map.of("key", "garments/" + piece + "/low.glb", "bytes", 800_000))));
    }

    @Test
    void gateAprovadoVaiParaRevisaoEAprovarAposentaAAnterior() {
        UUID piece = UUID.randomUUID();
        Map<String, Object> first = register(piece, GarmentFitGateTest.good());
        assertThat(first.get("status")).isEqualTo("IN_REVIEW");
        service.review(admin, (UUID) first.get("id"), true, "cor e estampa conferidas");
        Map<String, Object> second = register(piece, GarmentFitGateTest.good());
        Map<String, Object> approved = service.review(admin, (UUID) second.get("id"), true, null);
        assertThat(approved.get("status")).isEqualTo("APPROVED");
        GarmentAsset3d old = kit.dep(GarmentAsset3dRepository.class).findById((UUID) first.get("id")).orElseThrow();
        assertThat(old.getStatus()).isEqualTo(GarmentAssetStatus.RETIRED);
    }

    @Test
    void gateReprovadoNaoChegaARevisao() {
        Map<String, Object> r = register(UUID.randomUUID(), Map.of());
        assertThat(r.get("status")).isEqualTo("REJECTED");
        assertThatThrownBy(() -> service.review(admin, (UUID) r.get("id"), true, null))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(409));
    }

    @Test
    void arquivoAcimaDoLimiteDoPerfilOuChaveInvalidaRecusados() {
        assertThatThrownBy(() -> service.register(admin, new GarmentAssetService.RegisterCommand(UUID.randomUUID(), null, "FAI_BODY_V1",
                "ARTIST", "NONE", null, GarmentFitGateTest.good(), Map.of("MOBILE_LOW", Map.of("key", "g/a.glb", "bytes", 50_000_000)))))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.code()).isEqualTo("ARQUIVO_GRANDE_DEMAIS"));
        assertThatThrownBy(() -> service.register(admin, new GarmentAssetService.RegisterCommand(UUID.randomUUID(), null, "FAI_BODY_V1",
                "ARTIST", "NONE", null, GarmentFitGateTest.good(), Map.of("MOBILE_LOW", Map.of("key", "restricted/x.glb", "bytes", 10)))))
                .isInstanceOf(ApiException.class);
    }
}
