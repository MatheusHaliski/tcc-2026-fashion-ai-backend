package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.EraStudioService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
public class EraStudioController {
 private final EraStudioService studio;
 public EraStudioController(EraStudioService studio){this.studio=studio;}
 @PostMapping(value="/api/era-studio/uploads",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,Object> upload(CurrentUser user,@RequestPart("file") org.springframework.web.multipart.MultipartFile file){return studio.upload(user,br.com.fashionai.web.support.Uploads.image(file));}
 public record Draft(String prompt) {}
 @PostMapping("/api/era-studio/draft") public Map<String,Object> draft(CurrentUser user,@RequestBody Draft body){return studio.draft(user,body.prompt());}
}
