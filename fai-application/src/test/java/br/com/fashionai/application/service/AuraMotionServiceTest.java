package br.com.fashionai.application.service;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.ports.AuraMotionPort;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import org.mockito.*;
import java.util.*;
import java.time.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuraMotionServiceTest {
 AuraMotionJobRepository jobs=mock(AuraMotionJobRepository.class);WardrobeItemRepository pieces=mock(WardrobeItemRepository.class);
 UserRepository users=mock(UserRepository.class);UserPreferencesRepository preferences=mock(UserPreferencesRepository.class);
 AuraPermissionsService permissions=mock(AuraPermissionsService.class);MediaService media=mock(MediaService.class);TryOnService images=mock(TryOnService.class);
 CatalogProductRepository products=mock(CatalogProductRepository.class);WardrobeService wardrobe=mock(WardrobeService.class);
 AuraMotionPort worker=mock(AuraMotionPort.class);Guard guard=mock(Guard.class);
 AuraMotionService service=new AuraMotionService(jobs,pieces,users,preferences,products,wardrobe,permissions,media,images,worker,guard);
 User owner=new User();WardrobeItem piece=new WardrobeItem();CurrentUser session;byte[] image;String source;
 @BeforeEach void setup() throws Exception {
  owner.assignId(UUID.randomUUID());owner.setUsername("test");owner.setStatus(AccountStatus.ACTIVE);owner.setProfileType(ProfileType.PESSOAL);owner.setEmailVerified(true);
  session=CurrentUser.of(owner,null,null);piece.assignId(UUID.randomUUID());piece.setUser(owner);piece.setCategory("upper_piece");piece.setVisibility(Visibility.PRIVATE);
  source="/media/users/"+owner.getId()+"/person.png";
  var stream=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(32,32,BufferedImage.TYPE_INT_RGB),"png",stream);image=stream.toByteArray();
  when(pieces.findForSealRequest(piece.getId())).thenReturn(Optional.of(piece));when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece));
  when(users.lockById(owner.getId())).thenReturn(Optional.of(owner));when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
  when(media.requireOwnedMedia(eq(owner.getId()),eq(source),anySet(),anyString())).thenReturn(new MediaService.OwnedMedia("person",source));
  when(media.read(source)).thenReturn(Optional.of(image));when(images.imageBytes(piece)).thenReturn(image);when(worker.available()).thenReturn(true);
  when(jobs.save(any())).thenAnswer(i->{AuraMotionJob job=i.getArgument(0);if(job.getId()==null)job.assignId(UUID.randomUUID());return job;});
 }
 AuraMotionService.Request request(boolean consent){return new AuraMotionService.Request(piece.getId(),source,"STREET_IMPACT",UUID.randomUUID(),consent,true);}
 AuraMotionJob job(){var j=new AuraMotionJob();j.assignId(UUID.randomUUID());j.markCreatedAt(Instant.now());j.setOwnerId(owner.getId());j.setPieceId(piece.getId());j.setPieceRevision(piece.getVersion());j.setSourceUrl(source);j.setSourceHash(Hashing.sha256(image));j.setContextJson(Json.write(Map.of("garmentHash",Hashing.sha256(image))));j.setTemplateId("STREET_IMPACT");j.setStatus(AuraMotionJob.Status.QUEUED);when(jobs.findLocked(j.getId())).thenReturn(Optional.of(j));return j;}
 @Test void levelIsCheckedBeforeReadingPhotoOrQueueing(){doThrow(new ApiException(403,"AURA_LEVEL_REQUIRED","locked")).when(permissions).require(owner.getId(),AuraPermissionsService.AuraType.AURA_IMPERSONATION);assertThatThrownBy(()->service.create(session,request(true))).isInstanceOf(ApiException.class);verifyNoInteractions(media,jobs,worker);}
 @Test void consentRequiredBeforeAnyImageRead(){assertThatThrownBy(()->service.create(session,request(false))).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("AURA_MOTION_CONSENT_REQUIRED"));verifyNoInteractions(media,worker);}
 @Test void unavailableWorkerNeverCreatesFakeSuccess(){when(worker.available()).thenReturn(false);assertThatThrownBy(()->service.create(session,request(true))).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.status()).isEqualTo(503));verify(jobs,never()).save(any());verify(media,never()).read(anyString());}
 @Test void requestPersistsQueuedJobWithoutCallingProvider(){var view=service.create(session,request(true));assertThat(view.status()).isEqualTo(AuraMotionJob.Status.QUEUED);verify(worker,never()).submit(anyString(),any(),any(),anyString(),any());}
 @Test void anotherOwnerCannotReadOrApplyJob(){var j=job();when(jobs.findById(j.getId())).thenReturn(Optional.of(j));var visitor=new CurrentUser(UUID.randomUUID(),"other","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);assertThatThrownBy(()->service.get(visitor,j.getId())).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.status()).isEqualTo(404));}
 @Test void processingStartsWithPersistentJobIdAsIdempotencyKey(){var j=job();when(worker.submit(anyString(),any(),any(),anyString(),any())).thenReturn("provider-1");service.process(j.getId());assertThat(j.getStatus()).isEqualTo(AuraMotionJob.Status.PROCESSING);verify(worker).submit(eq(j.getId().toString()),eq(image),eq(image),eq("STREET_IMPACT"),any());}
 @Test void lowQualityReadyIsFailedWithoutPublishing(){var j=job();j.setProviderJobId("provider-1");j.setStatus(AuraMotionJob.Status.PROCESSING);when(worker.poll("provider-1")).thenReturn(new AuraMotionPort.Result("READY",new byte[16],5,24,true,false,true,null));service.process(j.getId());assertThat(j.getStatus()).isEqualTo(AuraMotionJob.Status.FAILED);verify(media,never()).put(anyString(),any(),anyString());assertThat(piece.getBackgroundConfigJson()).isNull();}
 @Test void cancelledJobDoesNotPollOrPublish(){var j=job();j.setStatus(AuraMotionJob.Status.CANCELLED);service.process(j.getId());verify(worker,never()).poll(anyString());verify(media,never()).put(anyString(),any(),anyString());}
 @Test void changedSourcePreventsProviderCall(){var j=job();j.setSourceHash("outdated");service.process(j.getId());assertThat(j.getFailureCode()).isEqualTo("AURA_MOTION_INPUT_CHANGED");verify(worker,never()).submit(anyString(),any(),any(),anyString(),any());}
 @Test void forgedReadyMetadataCannotBeSavedByEditor(){assertThatThrownBy(()->BackgroundStudioService.validateMotionWrite(null,Map.of("impersonationData",Map.of("status","READY")))).isInstanceOf(ApiException.class);}

 @Test void sameRequestKeyReturnsThePersistedJobWithoutDispatch(){var request=request(true);var old=job();old.setRequestKey(request.requestKey());when(jobs.findByOwnerIdAndRequestKey(owner.getId(),request.requestKey())).thenReturn(Optional.of(old));assertThat(service.create(session,request).id()).isEqualTo(old.getId());verify(jobs,never()).save(any());verify(worker,never()).submit(anyString(),any(),any(),anyString(),any());}
 @Test void queueLimitPreventsAdditionalImageReads(){when(jobs.countByOwnerIdAndStatusIn(eq(owner.getId()),anyCollection())).thenReturn(2L);assertThatThrownBy(()->service.create(session,request(true))).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.status()).isEqualTo(429));verify(media,never()).read(anyString());}
 @Test void transportRetriesUseSameJobIdentityAndAreBounded(){var j=job();when(worker.submit(anyString(),any(),any(),anyString(),any())).thenThrow(new ApiException(503,"AURA_MOTION_WORKER_UNAVAILABLE","temporary"));service.process(j.getId());service.process(j.getId());service.process(j.getId());assertThat(j.getStatus()).isEqualTo(AuraMotionJob.Status.FAILED);verify(worker,times(3)).submit(eq(j.getId().toString()),any(),any(),anyString(),any());}
 @Test void readyVideoStaysPrivateUntilExplicitApplication(){var j=job();j.setStatus(AuraMotionJob.Status.PROCESSING);j.setProviderJobId("provider-1");byte[] synthetic=new byte[16];synthetic[4]='f';synthetic[5]='t';synthetic[6]='y';synthetic[7]='p';when(worker.poll("provider-1")).thenReturn(new AuraMotionPort.Result("READY",synthetic,5,24,true,true,true,null));when(media.put(anyString(),eq(synthetic),eq("video/mp4"))).thenReturn(new br.com.fashionai.application.ports.MediaStoragePort.StoredObject("key","/media/users/owner/card.mp4",16,"video/mp4"));service.process(j.getId());assertThat(j.getStatus()).isEqualTo(AuraMotionJob.Status.READY);assertThat(piece.getBackgroundConfigJson()).isNull();when(media.read("/media/users/owner/card.mp4")).thenReturn(Optional.of(synthetic));service.apply(session,j.getId(),false);assertThat(Json.map(piece.getBackgroundConfigJson())).containsEntry("auraImpersonation",true);verify(pieces).save(piece);}
 @Test void publicApplicationRequiresSeparateConsent(){var j=job();j.setStatus(AuraMotionJob.Status.READY);j.setMediaUrl("/media/card.mp4");piece.setVisibility(Visibility.PUBLIC);assertThatThrownBy(()->service.apply(session,j.getId(),false)).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("AURA_MOTION_PUBLISH_CONSENT"));assertThat(piece.getBackgroundConfigJson()).isNull();}

 @Test void appliedVideoRechecksVisibilityBeforeStorageRead(){var j=job();var visitor=new CurrentUser(UUID.randomUUID(),"other","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);doThrow(new ApiException(403,"ACESSO_NEGADO","private")).when(wardrobe).requireVisiblePiece(visitor,piece);assertThatThrownBy(()->service.readAppliedMedia(visitor,piece.getId(),j.getId())).isInstanceOf(ApiException.class);verify(media,never()).read(anyString());}
 @Test void publishingUsesVisibilityCheckedApiInsteadOfPublicStorageCopy(){var j=job();j.setStatus(AuraMotionJob.Status.READY);j.setMediaUrl("/media/restricted/video.mp4");piece.setVisibility(Visibility.PUBLIC);when(media.read(j.getMediaUrl())).thenReturn(Optional.of(new byte[16]));service.apply(session,j.getId(),true);assertThat(Json.map(piece.getBackgroundConfigJson()).get("impersonationData").toString()).contains("/api/pieces/"+piece.getId()+"/aura-media/"+j.getId());verify(media,never()).put(anyString(),any(),anyString());}
}
