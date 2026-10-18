package br.com.fashionai.web.controller;
import br.com.fashionai.application.hype.AuraHypeDropService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class AuraHypeDropController {
 private final AuraHypeDropService drops;
 public AuraHypeDropController(AuraHypeDropService drops){this.drops=drops;}
 @GetMapping("/api/admin/aura-hype/drops") public List<Map<String,Object>> list(CurrentUser user){return drops.list(user);}
 @PostMapping("/api/admin/aura-hype/drops") public Map<String,Object> confirm(CurrentUser user,@RequestBody AuraHypeDropService.Form form){return drops.confirm(user,form);}
}
