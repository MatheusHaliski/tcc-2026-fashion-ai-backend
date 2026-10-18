package br.com.fashionai.application.service;

import br.com.fashionai.application.common.*;
import br.com.fashionai.application.ports.AuraMotionPort;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.AuraMotionJob.Status;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;

@Service
public class AuraMotionService {
 static final List<Status> ACTIVE=List.of(Status.QUEUED,Status.SUBMITTING,Status.PROCESSING);
 static final Set<String> TEMPLATES=Set.of("WIND_POSE","STREET_IMPACT","COSMIC_FLOAT","Y2K_ECHO","ELEMENTAL_BURST");
 private final AuraMotionJobRepository jobs; private final WardrobeItemRepository pieces;
 private final UserRepository users; private final UserPreferencesRepository preferences; private final CatalogProductRepository products; private final WardrobeService wardrobe;
 private final AuraPermissionsService permissions; private final MediaService media; private final TryOnService images;
 private final AuraMotionPort worker; private final Guard guard;
 public AuraMotionService(AuraMotionJobRepository jobs,WardrobeItemRepository pieces,UserRepository users,
   UserPreferencesRepository preferences,CatalogProductRepository products,WardrobeService wardrobe,AuraPermissionsService permissions,MediaService media,TryOnService images,AuraMotionPort worker,Guard guard){
  this.jobs=jobs;this.pieces=pieces;this.users=users;this.preferences=preferences;this.products=products;this.wardrobe=wardrobe;this.permissions=permissions;this.media=media;this.images=images;this.worker=worker;this.guard=guard;
 }
 public record Request(UUID pieceId,String personMediaUrl,String motionTemplateId,UUID requestKey,boolean processingConsent,boolean enableForPiece){}
 public record View(UUID id,UUID pieceId,Status status,String mediaUrl,String posterUrl,String motionTemplateId,String failureCode,Instant createdAt){}
 public Map<String,Object> capabilities(){return Map.of("available",worker.available(),"requiredTier","LOFT","durationSeconds",5,"fps",24);}
 private static ApiException error(int status,String code,String message){return new ApiException(status,code,Msg.t("auraMotion."+message));}
 private WardrobeItem owned(CurrentUser user,UUID id,boolean lock){
  var piece=(lock?pieces.findForSealRequest(id):pieces.findById(id)).orElseThrow(()->ApiException.notFound("Peça"));
  if(!piece.getUser().getId().equals(user.id()))throw ApiException.notFound("Peça");return piece;
 }
 private View view(AuraMotionJob job){return new View(job.getId(),job.getPieceId(),job.getStatus(),job.getMediaUrl()==null?null:"/api/me/aura-impersonation/jobs/"+job.getId()+"/media","/api/me/aura-impersonation/jobs/"+job.getId()+"/poster",job.getTemplateId(),job.getFailureCode(),job.getCreatedAt());}
 @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED) public View create(CurrentUser user,Request request){
  guard.requireCanCreate(user);permissions.require(user.id(),AuraPermissionsService.AuraType.AURA_IMPERSONATION);
  if(request==null||request.personMediaUrl()==null||request.personMediaUrl().length()>2048||request.pieceId()==null||request.requestKey()==null||!TEMPLATES.contains(Objects.toString(request.motionTemplateId(),"")))throw error(400,"AURA_MOTION_INVALID_INPUT","invalidInput");
  if(!request.processingConsent())throw error(400,"AURA_MOTION_CONSENT_REQUIRED","consent");
  users.lockById(user.id()).orElseThrow(()->ApiException.notFound("Usuário"));
  var piece=owned(user,request.pieceId(),true); // serializes concurrent attempts for this piece
  var source=media.requireOwnedMedia(user.id(),request.personMediaUrl(),Set.of(MediaService.MediaScope.OWNER,MediaService.MediaScope.PRIVATE_TRY_ON),"personMediaUrl");
  var existing=jobs.findByOwnerIdAndRequestKey(user.id(),request.requestKey());
  if(existing.isPresent()){
   var old=existing.get();
   if(!old.getPieceId().equals(request.pieceId())||!old.getSourceUrl().equals(source.url())||!old.getTemplateId().equals(request.motionTemplateId()))throw error(409,"AURA_MOTION_KEY_REUSED","conflict");
   return view(old);
  }
  if(!request.enableForPiece()&&!preferences.findByUserId(user.id()).map(UserPreferences::isAuraImpersonation).orElse(false))throw error(409,"AURA_MOTION_DISABLED","disabled");
  if(!worker.available())throw error(503,"AURA_MOTION_NOT_CONFIGURED","notConfigured");
  if(jobs.countByOwnerIdAndStatusIn(user.id(),ACTIVE)>=2)throw error(429,"AURA_MOTION_QUEUE_LIMIT","queueLimit");
  byte[] person=media.read(source.url()).orElseThrow(()->ApiException.notFound("Foto"));validateImage(person);
  byte[] garment=images.imageBytes(piece);validateImage(garment);
  Map<String,Object> context=new LinkedHashMap<>();context.put("ruleVersion",2);context.put("brand",Objects.toString(piece.getBrandName(),""));
  context.put("category",piece.getCategory());context.put("styleCategory",Objects.toString(piece.getStyleTags(),""));
  context.put("occasion",Objects.toString(piece.getOccasionTags(),""));context.put("color",Objects.toString(piece.getColor(),""));
  if(piece.getCatalogProductId()!=null)products.findById(piece.getCatalogProductId()).ifPresent(product->{
   context.put("sku",Objects.toString(product.getSku(),""));var metadata=Json.map(product.getMetadataJson());
   for(String key:List.of("collaboration","originCountry","pattern","modelCode")){
    Object value=metadata.get(key);if(value instanceof String text&&!text.isBlank()&&text.length()<=160)context.put(key,InputSanitizer.clean(text,160));
   }
  });
  context.put("productId",Objects.toString(piece.getCatalogProductId(),""));context.put("variantId",Objects.toString(piece.getCatalogVariantId(),""));
  var recipe=new LinkedHashMap<>(context);
  if(piece.getCatalogProductId()==null)recipe.put("garmentHash",Hashing.sha256(garment));
  context.put("auraPresetId","aura-v2-"+Hashing.sha256(Json.write(recipe)));
  context.put("garmentHash",Hashing.sha256(garment));
  var job=new AuraMotionJob();job.setOwnerId(user.id());job.setPieceId(piece.getId());job.setRequestKey(request.requestKey());job.setPieceRevision(piece.getVersion());
  job.setSourceUrl(source.url());job.setSourceHash(Hashing.sha256(person));job.setTemplateId(request.motionTemplateId());job.setContextJson(Json.write(context));
  job.setConsentedAt(Instant.now());job.setStatus(Status.QUEUED);return view(jobs.save(job));
 }
 @Transactional(readOnly=true) public List<View> list(CurrentUser user){return jobs.findByOwnerIdOrderByCreatedAtDesc(user.id(),PageRequest.of(0,30)).stream().map(this::view).toList();}
 @Transactional(readOnly=true) public View get(CurrentUser user,UUID id){return view(requireJob(user,id,false));}
 private AuraMotionJob requireJob(CurrentUser user,UUID id,boolean lock){var job=(lock?jobs.findLocked(id):jobs.findById(id)).filter(j->j.getOwnerId().equals(user.id())).orElseThrow(()->ApiException.notFound("AURA"));return job;}
 @Transactional(readOnly=true) public byte[] readMedia(CurrentUser user,UUID id,boolean poster){
  var job=requireJob(user,id,false);
  if(!poster&&job.getStatus()!=Status.READY)throw error(409,"AURA_MOTION_NOT_READY","notReady");
  byte[] bytes=media.read(poster?job.getSourceUrl():job.getMediaUrl()).orElseThrow(()->ApiException.notFound("AURA"));
  if(bytes.length>(poster?6_000_000:14_000_000))throw error(422,"AURA_MOTION_QUALITY_REJECTED","qualityRejected");
  return bytes;
 }
 @Transactional public View cancel(CurrentUser user,UUID id){
  var job=requireJob(user,id,true);if(ACTIVE.contains(job.getStatus())){if(job.getProviderJobId()!=null)worker.cancel(job.getProviderJobId());job.setStatus(Status.CANCELLED);jobs.save(job);}return view(job);
 }
 @Transactional public View apply(CurrentUser user,UUID id,boolean publishConsent){
  guard.requireCanCreate(user);permissions.require(user.id(),AuraPermissionsService.AuraType.AURA_IMPERSONATION);
  var job=requireJob(user,id,true);var piece=owned(user,job.getPieceId(),true);
  if(job.getStatus()!=Status.READY||job.getMediaUrl()==null)throw error(409,"AURA_MOTION_NOT_READY","notReady");
  if(piece.getVisibility()!=Visibility.PRIVATE&&!publishConsent)throw error(400,"AURA_MOTION_PUBLISH_CONSENT","publishConsent");
  var bg=new LinkedHashMap<>(Json.map(piece.getBackgroundConfigJson()));
  Object previous=bg.get("impersonationData");if(previous instanceof Map<?,?> p&&job.getId().toString().equals(p.get("jobId")))return view(job);
  if(piece.getVersion()!=job.getPieceRevision())throw error(409,"AURA_MOTION_STALE_PIECE","conflict");
  byte[] clip=media.read(job.getMediaUrl()).orElseThrow(()->ApiException.notFound("AURA"));
  if(clip.length>14_000_000)throw error(422,"AURA_MOTION_QUALITY_REJECTED","qualityRejected");
  String appliedUrl="/api/pieces/"+piece.getId()+"/aura-media/"+job.getId();
  bg.put("auraImpersonation",true);bg.put("impersonationData",Map.of("jobId",job.getId().toString(),"ownerId",user.id().toString(),"status","READY", "renderedCardMediaUrl",appliedUrl,"renderedMediaType","video/mp4","posterUrl",Objects.toString(piece.getImageUrl(),"")));
  piece.setBackgroundConfigJson(Json.write(bg));pieces.save(piece);return view(job);
 }
 @Transactional(readOnly=true) public byte[] readAppliedMedia(CurrentUser viewer,UUID pieceId,UUID jobId){
  var piece=pieces.findById(pieceId).orElseThrow(()->ApiException.notFound("Peça"));wardrobe.requireVisiblePiece(viewer,piece);
  var bg=Json.map(piece.getBackgroundConfigJson());Object raw=bg.get("impersonationData");
  if(!Boolean.TRUE.equals(bg.get("auraImpersonation"))||!(raw instanceof Map<?,?> data)||!jobId.toString().equals(data.get("jobId")))throw ApiException.notFound("AURA");
  var job=jobs.findById(jobId).filter(j->j.getPieceId().equals(pieceId)&&j.getOwnerId().equals(piece.getUser().getId())&&j.getStatus()==Status.READY).orElseThrow(()->ApiException.notFound("AURA"));
  byte[] bytes=media.read(job.getMediaUrl()).orElseThrow(()->ApiException.notFound("AURA"));if(bytes.length>14_000_000)throw error(422,"AURA_MOTION_QUALITY_REJECTED","qualityRejected");return bytes;
 }
 @Transactional(readOnly=true) public List<UUID> pending(){return worker.available()?jobs.findByStatusInOrderByCreatedAtAsc(ACTIVE,PageRequest.of(0,3)).stream().map(AuraMotionJob::getId).toList():List.of();}
 /** One bounded worker call under a job-row lock; no wallet locks or account-wide transaction. */
 @Transactional public void process(UUID id){
  var job=jobs.findLocked(id).orElse(null);if(job==null||!ACTIVE.contains(job.getStatus())||!worker.available())return;
  try{
   if(job.getCreatedAt()!=null&&job.getCreatedAt().plus(Duration.ofMinutes(20)).isBefore(Instant.now()))throw error(504,"AURA_MOTION_TIMEOUT","failed");
   var owner=users.findById(job.getOwnerId()).orElseThrow();guard.requireCanCreate(CurrentUser.of(owner,null,null));
   permissions.require(job.getOwnerId(),AuraPermissionsService.AuraType.AURA_IMPERSONATION);
   var piece=pieces.findById(job.getPieceId()).orElseThrow();if(piece.getVersion()!=job.getPieceRevision())throw error(409,"AURA_MOTION_STALE_PIECE","conflict");
   if(job.getProviderJobId()==null){
    byte[] person=media.read(job.getSourceUrl()).orElseThrow();byte[] garment=images.imageBytes(piece);validateImage(person);validateImage(garment);
    if(!Hashing.sha256(person).equals(job.getSourceHash())||!Hashing.sha256(garment).equals(Json.map(job.getContextJson()).get("garmentHash")))throw error(409,"AURA_MOTION_INPUT_CHANGED","conflict");
    job.setStatus(Status.SUBMITTING);
    String providerId=worker.submit(job.getId().toString(),person,garment,job.getTemplateId(),Json.map(job.getContextJson()));
    if(providerId==null||!providerId.matches("[A-Za-z0-9_:-]{1,200}"))throw new IllegalArgumentException("INVALID_PROVIDER_JOB");
    job.setProviderJobId(providerId);
    job.setSubmittedAt(Instant.now());job.setStatus(Status.PROCESSING);
   }else{
    var result=worker.poll(job.getProviderJobId());
    if("FAILED".equals(result.status()))throw error(422,"AURA_MOTION_PROCESSING_FAILED","failed");
    if("READY".equals(result.status())){
     validateResult(result);
     var stored=media.put("restricted/users/"+job.getOwnerId()+"/aura-impersonation/"+job.getId()+".mp4",result.mp4(),"video/mp4");
     job.setMediaUrl(stored.url());job.setStatus(Status.READY);
    }
   }
  }catch(RuntimeException error){
   if(error instanceof ApiException e&&e.status()==503&&job.getAttempts()<2){job.setAttempts(job.getAttempts()+1);job.setStatus(job.getProviderJobId()==null?Status.QUEUED:Status.PROCESSING);job.setFailureCode("AURA_MOTION_RETRYING");}
   else {job.setStatus(Status.FAILED);job.setFailureCode(error instanceof ApiException e?e.code():"AURA_MOTION_PROCESSING_FAILED");}
  }
  jobs.save(job);
 }
 static void validateImage(byte[] bytes){
  if(bytes==null||bytes.length==0||bytes.length>6_000_000)throw error(400,"AURA_MOTION_IMAGE_LIMIT","invalidInput");
  try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))){
   var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw error(400,"AURA_MOTION_IMAGE_INVALID","invalidInput");
   var reader=readers.next();try{reader.setInput(input);int w=reader.getWidth(0),h=reader.getHeight(0);if(w<16||h<16||w>2048||h>2048||reader.read(0)==null)throw error(400,"AURA_MOTION_IMAGE_INVALID","invalidInput");}finally{reader.dispose();}
  }catch(ApiException error){throw error;}catch(Exception error){throw error(400,"AURA_MOTION_IMAGE_INVALID","invalidInput");}
 }
 static void validateResult(AuraMotionPort.Result result){
  byte[] clip=result.mp4();
  if(!"READY".equals(result.status())||clip==null||clip.length<12||clip.length>14_000_000||clip[4]!='f'||clip[5]!='t'||clip[6]!='y'||clip[7]!='p'
    ||!Double.isFinite(result.durationSeconds())||result.durationSeconds()<4.8||result.durationSeconds()>5.2||!Double.isFinite(result.fps())||result.fps()<23.9||result.fps()>24.1
    ||!result.personDetected()||!result.garmentMatched()||!result.temporalQualityPassed())throw error(422,"AURA_MOTION_QUALITY_REJECTED","qualityRejected");
 }
}
