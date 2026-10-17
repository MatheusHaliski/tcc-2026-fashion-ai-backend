package br.com.fashionai.application.service;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.AnatomicalTryOnPort;
import br.com.fashionai.application.security.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
@Service
public class AnatomicalTryOnService {
 private final AnatomicalTryOnPort worker;private final WardrobeService wardrobe;private final TryOnService legacy;private final MediaService media;private final Guard guard;
 public AnatomicalTryOnService(AnatomicalTryOnPort worker,WardrobeService wardrobe,TryOnService legacy,MediaService media,Guard guard){this.worker=worker;this.wardrobe=wardrobe;this.legacy=legacy;this.media=media;this.guard=guard;}
 public record PersonRequest(String personMediaUrl,boolean processingConsent){}
 public Map<String,Object> probe(CurrentUser user,PersonRequest request){
  guard.requireCanCreate(user);
  if(request==null||!request.processingConsent())throw ApiException.badRequest("VTON_CONSENT_REQUIRED","Confirme o processamento da sua fotografia.");
  var owned=media.requireOwnedMedia(user.id(),request.personMediaUrl(),Set.of(MediaService.MediaScope.OWNER),"personMediaUrl");
  if(!worker.available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado.");
  byte[] person=media.read(owned.url()).orElseThrow(()->ApiException.notFound("Foto"));
  if(person.length==0||person.length>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT","Use uma fotografia de até 6 MB.");
  return worker.probePerson(person);
 }
 /**
  * Foto da pessoa para a prova com IA: grava só na pasta do próprio usuário ({@code users/{id}/tryon/}), já reduzida ao
  * limite da GPU (1536 px no maior lado) e regravada em JPEG sem metadados. Não entra na biblioteca de fotos.
  */
 public Map<String,Object> uploadPerson(CurrentUser user,byte[] bytes){
  guard.requireCanCreate(user);
  ImageOps.requireAcceptedImage(bytes);
  java.awt.image.BufferedImage img=ImageOps.decode(bytes);
  if(Math.min(img.getWidth(),img.getHeight())<256)throw ApiException.badRequest("VTON_IMAGE_SMALL","Use uma foto com pelo menos 256 px no menor lado.");
  java.awt.image.BufferedImage fitted=ImageOps.scaleToFit(img,1536,1536);
  var saved=media.put("users/"+user.id()+"/tryon/person-"+UUID.randomUUID()+".jpg",ImageOps.jpeg(fitted,0.9f),"image/jpeg");
  return Map.of("url",saved.url(),"width",fitted.getWidth(),"height",fitted.getHeight());
 }
 public record Request(UUID pieceId,String personMediaUrl,Map<String,Object> bodyEvidence,boolean mirror,boolean processingConsent){}
 public Map<String,Object> render(CurrentUser user,Request request){
  guard.requireCanCreate(user);
  if(request==null||request.pieceId()==null||!request.processingConsent())throw ApiException.badRequest("VTON_CONSENT_REQUIRED","Escolha sua peça e confirme o processamento da sua fotografia.");
  var piece=wardrobe.owned(user,request.pieceId());
  var owned=media.requireOwnedMedia(user.id(),request.personMediaUrl(),Set.of(MediaService.MediaScope.OWNER),"personMediaUrl");
  if(!worker.available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado. A prova 3D convencional continua disponível.");
  byte[] garment=legacy.imageBytes(piece);byte[] person=media.read(owned.url()).orElseThrow(()->ApiException.notFound("Foto"));
  if(garment==null||garment.length==0||garment.length>6_000_000||person.length>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT","Use imagens de até 6 MB e 1536 px.");
  if(request.bodyEvidence()!=null&&Json.write(request.bodyEvidence()).length()>25_000_000)throw ApiException.badRequest("VTON_EVIDENCE_LIMIT","Máscaras anatômicas excederam o limite.");
  var result=worker.render("piece:"+piece.getId(),garment,person,piece.getCategory(),request.bodyEvidence(),request.mirror());
  if(!"READY".equals(result.get("status")))return result;
  Object encoded=result.get("image_png");if(!(encoded instanceof String value)||value.length()>8_000_000)throw new ApiException(502,"VTON_INVALID_IMAGE","Imagem inválida retornada pelo worker.");
  byte[] png;try{png=Base64.getDecoder().decode((String)encoded);}catch(Exception e){throw new ApiException(502,"VTON_INVALID_IMAGE","Imagem inválida retornada pelo worker.");}
  validateOutput(png);
  var saved=media.put("users/"+user.id()+"/tryon/anatomical-"+UUID.randomUUID()+".png",png,"image/png");
  return Map.of("status","READY","url",saved.url(),"diagnostics",result.getOrDefault("diagnostics",Map.of()),"physicalFitCertified",false);
 }
 private static void validateOutput(byte[] bytes) {
  byte[] signature={(byte)137,80,78,71,13,10,26,10};
  if(bytes.length<signature.length||!Arrays.equals(Arrays.copyOf(bytes,8),signature))throw invalidOutput();
  try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))){
   var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw invalidOutput();
   var reader=readers.next();
   try{
    reader.setInput(input,true,true);
    int width=reader.getWidth(0),height=reader.getHeight(0);
    if(!"png".equalsIgnoreCase(reader.getFormatName())||width<16||height<16||width>1536||height>1536)throw invalidOutput();
    if(reader.read(0)==null)throw invalidOutput();
   }finally{reader.dispose();}
  }catch(ApiException error){throw error;}
  catch(Exception error){throw invalidOutput();}
 }
 private static ApiException invalidOutput(){return new ApiException(502,"VTON_INVALID_IMAGE","O worker deve retornar um PNG válido de até 1536 px.");}
}
