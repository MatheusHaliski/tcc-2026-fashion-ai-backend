package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MetamorphoseInventoryService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
public class MetamorphoseInventoryController {
 private final MetamorphoseInventoryService inventory;
 public MetamorphoseInventoryController(MetamorphoseInventoryService inventory){this.inventory=inventory;}
 @GetMapping("/api/me/arts/metamorphoses")
 public List<MetamorphoseInventoryService.Art> mine(CurrentUser user){return inventory.mine(user);}
}
