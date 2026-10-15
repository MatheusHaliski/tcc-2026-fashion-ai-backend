package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AuraCommerceService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class AuraCommerceController {
 private final AuraCommerceService arts;
 public AuraCommerceController(AuraCommerceService arts){this.arts=arts;}
 @GetMapping("/api/aura-store") public List<Map<String,Object>> catalog(){return arts.catalog();}
 @GetMapping("/api/admin/aura-store") public List<Map<String,Object>> adminCatalog(CurrentUser user){return arts.adminCatalog(user);}
 @PostMapping("/api/admin/aura-store") public Map<String,Object> save(CurrentUser user,@RequestBody AuraCommerceService.OfferForm form){return arts.save(user,form);}
 @PostMapping("/api/aura-store/{code}/purchase") public Map<String,Object> purchase(CurrentUser user,@PathVariable String code){return arts.purchase(user,code);}
 @GetMapping("/api/me/arts") public List<Map<String,Object>> mine(CurrentUser user){return arts.mine(user);}
}
