package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Selo escolhido no criador ("BRAND:Nome") vira o medalhão que o emissor aprovado desenhou no editor de selos. */
class SealArtServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void chaveDaMarcaAprovadaDevolveAArteDoSeloAtivoDoTierPedido() {
        Kit kit = new Kit();
        User nike = Kit.user("nike");
        brand(kit, nike, "Nike", ApprovalStatus.APROVADO);
        seal(kit, nike, "Selo look", SealTier.LOOK, SealStatus.ACTIVE, Map.of("palette", "NOTURNO"));
        seal(kit, nike, "Selo peça", SealTier.PECA, SealStatus.ACTIVE, Map.of("palette", "FAI"));
        SealArtService service = kit.build(SealArtService.class);

        Map<String, Object> items = (Map<String, Object>) service.art(List.of("BRAND:nike"), SealTier.PECA).get("items");

        Map<String, Object> badge = (Map<String, Object>) items.get("BRAND:nike");
        assertThat(badge.get("name")).isEqualTo("Selo peça");
        assertThat(badge.get("owner")).isEqualTo("nike");
        assertThat(badge.get("premium")).isEqualTo(false);
        assertThat((Map<String, Object>) badge.get("design")).containsEntry("palette", "FAI");
    }

    @Test
    @SuppressWarnings("unchecked")
    void emissorNaoAprovadoSeloInativoEChaveInvalidaFicamDeFora() {
        Kit kit = new Kit();
        User pendente = Kit.user("pendente");
        brand(kit, pendente, "Pendente", ApprovalStatus.PENDENTE);
        seal(kit, pendente, "Selo", SealTier.PECA, SealStatus.ACTIVE, Map.of());
        User semSelo = Kit.user("semselo");
        brand(kit, semSelo, "Sem Selo", ApprovalStatus.APROVADO);
        seal(kit, semSelo, "Inativo", SealTier.PECA, SealStatus.INACTIVE, Map.of());
        SealArtService service = kit.build(SealArtService.class);

        Map<String, Object> items = (Map<String, Object>) service
                .art(List.of("BRAND:Pendente", "BRAND:Sem Selo", "BRAND:Inexistente", "Nike", "OUTRO:x", "BRAND:"), SealTier.PECA).get("items");

        assertThat(items).isEmpty();
    }

    private static void brand(Kit kit, User owner, String name, ApprovalStatus status) {
        BrandProfile profile = new BrandProfile();
        profile.setOwner(owner);
        profile.setBrandName(name);
        profile.setApprovalStatus(status);
        kit.dep(BrandProfileRepository.class).save(profile);
    }

    private static void seal(Kit kit, User owner, String name, SealTier tier, SealStatus status, Map<String, Object> design) {
        Seal seal = new Seal();
        seal.setOwner(owner);
        seal.setName(name);
        seal.setTier(tier);
        seal.setStatus(status);
        seal.setBackgroundConfigJson(design.isEmpty() ? null : Json.write(Map.of("design", design)));
        kit.dep(SealRepository.class).save(seal);
    }
}
