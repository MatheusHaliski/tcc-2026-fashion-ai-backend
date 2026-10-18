package br.com.fashionai.application.service;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
/** Private photo ingestion only: uploading never invokes a remote AI model or grants XP. */
@Service
public class TryOnPersonPhotoService {
 private final MediaService media;private final UserRepository users;private final Guard guard;
 public TryOnPersonPhotoService(MediaService media,UserRepository users,Guard guard){this.media=media;this.users=users;this.guard=guard;}
 @Transactional public Map<String,Object> upload(CurrentUser user,byte[] bytes){
  guard.requireCanCreate(user);
  if(bytes==null||bytes.length==0||bytes.length>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT",Msg.t("auraMotion.invalidInput"));
  String mime=ImageOps.requireAcceptedImage(bytes);var image=ImageOps.decode(bytes);
  if(Math.min(image.getWidth(),image.getHeight())<256)throw ApiException.badRequest("VTON_IMAGE_SMALL",Msg.t("tryOnPhoto.small"));
  users.findById(user.id()).orElseThrow(()->ApiException.notFound("Usuário"));
  var fitted=ImageOps.scaleToFit(image,1536,1536);byte[] jpeg=ImageOps.jpeg(fitted,.9f);
  String base="restricted/users/"+user.id()+"/tryon/person/"+UUID.randomUUID();
  String extension="image/png".equals(mime)?"png":"image/webp".equals(mime)?"webp":"jpg";
  media.put(base+"/original."+extension,bytes,mime);
  var saved=media.put(base+"/person.jpg",jpeg,"image/jpeg");
  return Map.of("url",saved.url(),"width",fitted.getWidth(),"height",fitted.getHeight());
 }
}
