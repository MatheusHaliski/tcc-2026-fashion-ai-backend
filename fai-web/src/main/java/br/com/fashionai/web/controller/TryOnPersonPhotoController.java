package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.TryOnPersonPhotoService;
import br.com.fashionai.application.common.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
@RestController @RequestMapping("/api/try-on")
public class TryOnPersonPhotoController {
 private final TryOnPersonPhotoService service;
 public TryOnPersonPhotoController(TryOnPersonPhotoService service){this.service=service;}
 @PostMapping(value="/person-photos",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ResponseEntity<Map<String,Object>> upload(CurrentUser user,@RequestPart("file") MultipartFile file)throws java.io.IOException{
  if(file.isEmpty()||file.getSize()>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT",Msg.t("auraMotion.invalidInput"));
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.upload(user,file.getBytes()));
 }
}
