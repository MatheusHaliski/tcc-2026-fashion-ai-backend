package br.com.fashionai.application.atelier3d;
import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.atelier3d.*;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.repository.atelier3d.*;
import br.com.fashionai.domain.repository.atelierproject.DesignProjectRepository;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class Atelier3dServiceTest {
 AtelierProjectService access=mock(AtelierProjectService.class);DesignProjectRepository projects=mock(DesignProjectRepository.class);DesignAssetRepository assets=mock(DesignAssetRepository.class);DesignSceneVersionRepository versions=mock(DesignSceneVersionRepository.class);DesignGuestInviteRepository guests=mock(DesignGuestInviteRepository.class);CatalogGenderDecision genders=mock(CatalogGenderDecision.class);
 Atelier3dService service=new Atelier3dService(access,assets,versions,guests,genders,GlbInspectorTest.JSON);
 UUID project=UUID.randomUUID(),invite=UUID.randomUUID(),assetId=UUID.randomUUID();String token="test-secret";DesignGuestInvite guest;
 @BeforeEach void setup(){guest=new DesignGuestInvite();guest.assignId(invite);guest.setProjectId(project);guest.setLabel("Guest");guest.setRole(DesignGuestInvite.Role.VIEWER);guest.setTokenHash(CatalogGenderDecision.hash(token));guest.setExpiresAt(Instant.now().plusSeconds(100));when(guests.findById(invite)).thenReturn(Optional.of(guest));when(guests.lockById(invite)).thenReturn(Optional.of(guest));when(guests.projectIdOf(invite)).thenReturn(Optional.of(project));var p=new DesignProject();p.assignId(project);p.setTitle("Projeto");p.setState(DesignProject.State.DRAFT);when(access.capability3dProject(project,false)).thenReturn(p);when(access.capability3dProject(project,true)).thenReturn(p);when(versions.findTop30ByProjectIdOrderBySequenceNumberDesc(project)).thenReturn(List.of());}
 @Test void guestViewerCannotEditAndRevocationIsCheckedForEveryRead(){assertThat(service.guestScene(invite,token).edit()).isFalse();assertThatThrownBy(()->service.guestSave(invite,token,null)).isInstanceOf(ApiException.class);guest.setRevokedAt(Instant.now());assertThatThrownBy(()->service.guestScene(invite,token)).isInstanceOf(ApiException.class);verifyNoInteractions(assets);}
 @Test void expiredAndWrongTokensDoNotExposeTheProject(){assertThatThrownBy(()->service.guestScene(invite,"wrong")).isInstanceOf(ApiException.class);guest.setExpiresAt(Instant.now().minusSeconds(1));assertThatThrownBy(()->service.guestScene(invite,token)).isInstanceOf(ApiException.class);verifyNoInteractions(access);}
 @Test void assetFromAnotherProjectCannotBeReadEvenWithAValidInvitation(){var asset=new DesignAsset();asset.setProjectId(UUID.randomUUID());when(assets.findById(assetId)).thenReturn(Optional.of(asset));assertThatThrownBy(()->service.guestContent(invite,token,assetId)).isInstanceOf(ApiException.class);}
 @Test void staleRevisionCannotOverwriteAnotherEditorsWork(){guest.setRole(DesignGuestInvite.Role.EDITOR);var prior=new DesignSceneVersion();prior.setSequenceNumber(2);when(versions.findFirstByProjectIdOrderBySequenceNumberDesc(project)).thenReturn(Optional.of(prior));var cmd=new Atelier3dService.Save(1,assetId,"request",new Atelier3dService.Document(Map.of(),Map.of(),Map.of()),List.of(),null,null);assertThatThrownBy(()->service.guestSave(invite,token,cmd)).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.status()).isEqualTo(409));verify(versions,never()).saveAndFlush(any());}
 @Test void geometryEditsCannotCorruptRiggedAssets(){var i=new GlbInspector.Inspection(1,1,1,3,true,false,false,Map.of("n0.p0",3),List.of());var doc=new Atelier3dService.Document(Map.of(),Map.of(),Map.of("n0.p0",Map.of("0",List.of(1d,2d,3d))));assertThatThrownBy(()->Atelier3dService.validate(doc,i)).isInstanceOf(ApiException.class);}
 @Test void editorUploadKeepsUnicodeFilenameAndDeduplicatesOriginal(){
  guest.setRole(DesignGuestInvite.Role.EDITOR);
  when(assets.saveAndFlush(any())).thenAnswer(call->{DesignAsset a=call.getArgument(0);a.assignId(assetId);return a;});
  var result=service.guestUpload(invite,token,"Camisa algodão.glb",GlbInspectorTest.glb(""));
  assertThat(result.filename()).isEqualTo("Camisa algodão.glb");
  var captor=org.mockito.ArgumentCaptor.forClass(DesignAsset.class);verify(assets).saveAndFlush(captor.capture());
  when(assets.findFirstByProjectIdAndSha256(project,result.sha256())).thenReturn(Optional.of(captor.getValue()));
  assertThat(service.guestUpload(invite,token,"other.glb",GlbInspectorTest.glb("")).id()).isEqualTo(result.id());
  verify(assets,times(1)).saveAndFlush(any());
 }
 @Test void editorSaveIsIdempotentAndRetainsTheExplicitTipoLook(){
  guest.setRole(DesignGuestInvite.Role.EDITOR);var a=new DesignAsset();a.assignId(assetId);a.setProjectId(project);a.setInspectionJson(GlbInspectorTest.JSON.writeValueAsString(GlbInspector.inspect(GlbInspectorTest.glb(""),GlbInspectorTest.JSON)));
  when(assets.findById(assetId)).thenReturn(Optional.of(a));UUID tipo=UUID.randomUUID();
  var evidence=new CatalogGenderDecision.Evidence(List.of(),"INCOMPLETE",null,"hash",List.of(new CatalogGenderDecision.Option(tipo,"UNISEX","Unissex")));when(genders.evidence(List.of())).thenReturn(evidence);
  when(versions.saveAndFlush(any())).thenAnswer(call->{DesignSceneVersion v=call.getArgument(0);v.assignId(UUID.randomUUID());return v;});
  var cmd=new Atelier3dService.Save(0,assetId,"same-request",new Atelier3dService.Document(Map.of(),Map.of(),Map.of()),List.of(),tipo,"hash");
  var first=service.guestSave(invite,token,cmd);assertThat(first.sequence()).isEqualTo(1);assertThat(first.confirmedTipoLookId()).isEqualTo(tipo);verify(genders).confirm(evidence,tipo,"hash");
  var saved=org.mockito.ArgumentCaptor.forClass(DesignSceneVersion.class);verify(versions).saveAndFlush(saved.capture());when(versions.findByProjectIdAndRequestId(project,"same-request")).thenReturn(Optional.of(saved.getValue()));
  assertThat(service.guestSave(invite,token,cmd).id()).isEqualTo(first.id());verify(versions,times(1)).saveAndFlush(any());
 }
}
