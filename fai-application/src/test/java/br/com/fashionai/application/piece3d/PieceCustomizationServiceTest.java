package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF — editor 3D da peça: personalização por pessoa, original intacto, quarentena nunca vira aprovado. */
class PieceCustomizationServiceTest {
    Piece3dCustomizationRepository customizations = MemoryRepository.of(Piece3dCustomizationRepository.class);
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    GarmentAsset3dRepository assets = MemoryRepository.of(GarmentAsset3dRepository.class);
    Guard guard = mock(Guard.class);
    PieceCustomizationService service;
    User ana, bia;
    WardrobeItem piece;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    CustomizationDocument doc(String color, double scale) {
        return new CustomizationDocument(Map.of("node:0", new CustomizationDocument.NodeEdit(List.of(0d, 0d, 0d), List.of(0d, 0d, 0d), List.of(scale, scale, scale), true)),
                Map.of("mat:0", new CustomizationDocument.MaterialEdit(color, 0.5, 0.0, List.of(1d, 1d), 0d)), Map.of());
    }

    @BeforeEach void setUp() {
        when(customizations.lockByPieceIdAndOwnerId(any(), any())).thenAnswer(inv -> customizations.findByPieceIdAndOwnerId(inv.getArgument(0), inv.getArgument(1)));
        service = new PieceCustomizationService(customizations, pieces, assets, guard);
        ana = new User("ana", "Ana", "a@x.invalid", "h1", "p", ProfileType.PESSOAL); ana.assignId(UUID.randomUUID()); ana.setStatus(AccountStatus.ACTIVE);
        bia = new User("bia", "Bia", "b@x.invalid", "h2", "p", ProfileType.PESSOAL); bia.assignId(UUID.randomUUID()); bia.setStatus(AccountStatus.ACTIVE);
        piece = new WardrobeItem(); piece.setUser(ana); piece.setName("Jaqueta"); piece.setCategory("upper_piece"); piece.setVisibility(Visibility.PUBLIC);
        piece.setModel3dStatus(Model3dStatus.COMPLETED); piece.setModel3dUrl("/media/jaqueta.glb"); piece.setSizeLabel("M"); pieces.save(piece);
    }

    @Test void onlyTheOwnerSavesAndTheOriginalModelAndPassportDataStayUntouched() {
        var before = service.get(actor(ana), piece.getId());
        assertThat(before).containsEntry("editable", true).containsEntry("revision", 0L).containsEntry("assetApproval", "NONE").containsEntry("baseModelUrl", "/media/jaqueta.glb");
        var saved = service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#ff0000", 1.2), "cust-00000001", null));
        assertThat(saved).containsEntry("revision", 1L).containsEntry("scaleIsVisualOnly", true).containsEntry("affectsOfficialMeasurements", false).containsEntry("affectsPassport", false).containsEntry("fitClaim", "NONE");
        assertThat(service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#ff0000", 1.2), "cust-00000001", null)).get("revision")).isEqualTo(1L);
        assertThatThrownBy(() -> service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#00ff00", 1), "cust-00000002", null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CUSTOMIZATION_REVISION_CONFLICT"));
        assertThat(piece.getModel3dUrl()).isEqualTo("/media/jaqueta.glb"); assertThat(piece.getSizeLabel()).isEqualTo("M");
        assertThatThrownBy(() -> service.save(actor(bia), piece.getId(), new PieceCustomizationService.SaveCmd(1, doc("#0000ff", 1), "cust-00000003", null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        when(guard.canView(any(), any(), any())).thenReturn(true);
        var viewer = service.get(actor(bia), piece.getId());
        assertThat(viewer).containsEntry("editable", false).containsEntry("viewOnly", true).containsEntry("revision", 0L);
        var reopened = service.get(actor(ana), piece.getId());
        assertThat(reopened).containsEntry("revision", 1L);
        assertThat(((CustomizationDocument) reopened.get("document")).materials().get("mat:0").color()).isEqualTo("#ff0000");
        service.reset(actor(ana), piece.getId());
        assertThat(service.get(actor(ana), piece.getId())).containsEntry("revision", 0L);
    }

    @Test void quarantinedAssetsAreNeverPresentedAsApprovedAndInvalidDocumentsAreRejected() {
        GarmentAsset3d review = new GarmentAsset3d(); review.setPieceId(piece.getId()); review.setStatus(GarmentAssetStatus.IN_REVIEW); review.setRigStandard("FAI_BODY_V1"); review.setSource("GENERATED"); assets.save(review);
        var view = service.get(actor(ana), piece.getId());
        assertThat(view).containsEntry("assetApproval", "IN_REVIEW").containsEntry("quarantine", true).containsEntry("tryOnApproved", false).containsEntry("editable", true);
        assertThatThrownBy(() -> service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("red", 1), "cust-00000009", null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CUSTOMIZATION_INVALID"));
        assertThatThrownBy(() -> service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#ffffff", 0), "cust-00000010", null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CUSTOMIZATION_INVALID"));
        piece.setModel3dStatus(Model3dStatus.FAILED);
        var onBase = service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#ffffff", 1), "cust-00000011", null));
        assertThat(onBase).containsEntry("savedBaseKey", "template:t_shirt@1");
        var view2 = service.get(actor(ana), piece.getId());
        assertThat(view2).containsEntry("baseModelUrl", null).containsEntry("modelAvailable", true).containsEntry("editable", true);
        piece.setCategory("strange_piece");
        assertThatThrownBy(() -> service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(1, doc("#ffffff", 1), "cust-00000012", null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CUSTOMIZATION_NO_MODEL"));
        assertThat(service.get(actor(ana), piece.getId())).containsEntry("modelAvailable", false).containsEntry("editable", false);
    }

    @Test void everyPieceStartsFromTheBasePieceOfItsSubcategoryAndOnlyKnownBasesAreAccepted() {
        piece.setModel3dStatus(null); piece.setModel3dUrl(null); piece.setSubcategory("hoodie"); piece.setColor("blue");
        var view = service.get(actor(ana), piece.getId());
        assertThat(view).containsEntry("modelAvailable", true).containsEntry("editable", true).containsEntry("category", "upper_piece").containsEntry("subcategory", "hoodie");
        assertThat((String) view.get("colorHex")).matches("#[0-9a-fA-F]{6}");
        @SuppressWarnings("unchecked") var base = (Map<String, Object>) view.get("basePiece");
        assertThat(base).containsEntry("available", true).containsEntry("subcategory", "hoodie").containsEntry("key", "template:hoodie@1").containsEntry("version", 1);
        var saved = service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(0, doc("#ff0000", 1), "cust-00000020", null));
        assertThat(saved).containsEntry("savedBaseKey", "template:hoodie@1").containsEntry("baseChanged", false);
        assertThatThrownBy(() -> service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(1, doc("#ff0000", 1), "cust-00000021", "template:coat@1"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("CUSTOMIZATION_BASE_INVALID"));
        piece.setSubcategory("unknown_sub");
        @SuppressWarnings("unchecked") var fallback = (Map<String, Object>) service.get(actor(ana), piece.getId()).get("basePiece");
        assertThat(fallback).containsEntry("subcategory", "t_shirt").containsEntry("key", "template:t_shirt@1");
        piece.setModel3dStatus(Model3dStatus.COMPLETED); piece.setModel3dUrl("/media/jaqueta.glb");
        var ownGlb = service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(1, doc("#00ff00", 1), "cust-00000022", "/media/jaqueta.glb"));
        assertThat(ownGlb).containsEntry("savedBaseKey", "/media/jaqueta.glb").containsEntry("revision", 2L);
        var onBase = service.save(actor(ana), piece.getId(), new PieceCustomizationService.SaveCmd(2, doc("#00ff00", 1), "cust-00000023", "template:t_shirt@1"));
        assertThat(onBase).containsEntry("savedBaseKey", "template:t_shirt@1").containsEntry("baseChanged", false).containsEntry("baseModelUrl", "/media/jaqueta.glb");
    }
}
