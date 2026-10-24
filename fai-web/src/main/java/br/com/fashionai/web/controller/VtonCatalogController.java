package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.*;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.application.service.VtonBackendAnnotationService;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
@RestController
@RequestMapping("/api/admin/vton")
public class VtonCatalogController {
 private final VtonBackendAnnotationService annotations;private final CatalogImageRepository images;private final Guard guard;
 public VtonCatalogController(VtonBackendAnnotationService annotations,CatalogImageRepository images,Guard guard){this.annotations=annotations;this.images=images;this.guard=guard;}
 @PostMapping("/annotate")public Map<String,Object> annotate(CurrentUser user,@RequestBody VtonBackendAnnotationService.Request request){return annotations.annotate(user,request);}
 @GetMapping("/catalog-feed")public Map<String,Object> feed(CurrentUser user,@RequestParam(defaultValue="1970-01-01T00:00:01Z")Instant after,@RequestParam(defaultValue="")String afterId,@RequestParam(defaultValue="100")int limit){
  guard.requireAdmin(user);if(!afterId.isEmpty())try{UUID.fromString(afterId);}catch(IllegalArgumentException error){throw ApiException.badRequest("VTON_INVALID_CURSOR","Cursor do catálogo inválido.");}
  var rows=images.findVtonFeed(after,afterId,Math.max(1,Math.min(limit,100)));
  var items=rows.stream().filter(image->!forcedCopy(image)).map(image->Map.of("garment_id",image.getProductId().toString(),"image_url",image.getStoredUrl(),"updated_at",image.getUpdatedAt().toString(),"image_id",image.getId().toString())).toList();
  var last=rows.isEmpty()?null:rows.get(rows.size()-1);
  return Map.of("items",items,"cursor",Map.of("after",last==null?after.toString():last.getUpdatedAt().toString(),"afterId",last==null?afterId:last.getId().toString()));
 }
 /** Cópia gravada por decisão do responsável, sem autorização da fonte (--force-category-frame): serve só ao card, nunca à GPU. */
 static boolean forcedCopy(CatalogImage image){
  return Json.map(image.getAssetsJson()).get("persistenceDecision") instanceof Map<?,?> decision&&"FORCED_CATEGORY_FRAME".equals(decision.get("mode"));
 }
}
