package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeCreatorService;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/** Card Trello RF39 — "Criar guarda-roupa 3D": marcas e celebridades criam componentes ou um guarda-roupa inteiro para a loja do quarto. */
@RestController
@Tag(name = "Criar guarda-roupa 3D — componentes e guarda-roupas de marca/celebridade para a loja do quarto")
public class RoomCreatorController {
    private final WardrobeCreatorService creator;

    public RoomCreatorController(WardrobeCreatorService creator) {
        this.creator = creator;
    }

    @GetMapping("/api/room-creator/options")
    @Operation(summary = "RF39 — blocos do móvel, materiais, cores, níveis, identidade da marca e selos ativos")
    public Map<String, Object> options(CurrentUser user) {
        return creator.options(user);
    }

    @GetMapping("/api/room-creator/items")
    @Operation(summary = "RF39 — meus componentes e guarda-roupas à venda, com vendas")
    public Map<String, Object> mine(CurrentUser user) {
        return creator.mine(user);
    }

    @PostMapping("/api/room-creator/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF39 — cria um componente (kind=COMPONENT) ou um guarda-roupa inteiro (kind=WARDROBE, bundle de blocos)")
    public Map<String, Object> create(CurrentUser user, @RequestBody WardrobeCreatorService.ItemForm body) {
        return creator.save(user, null, body);
    }

    @PutMapping("/api/room-creator/items/{sku}")
    @Operation(summary = "RF39 — edita o item e as condições (preço, nível, estoque, limite por pessoa, disponibilidade, selo)")
    public Map<String, Object> update(CurrentUser user, @PathVariable String sku, @RequestBody WardrobeCreatorService.ItemForm body) {
        return creator.save(user, sku, body);
    }

    @DeleteMapping("/api/room-creator/items/{sku}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF39 — remove o item (com vendas, só sai da loja; quem comprou continua com ele)")
    public void delete(CurrentUser user, @PathVariable String sku) {
        creator.delete(user, sku);
    }

    @PostMapping(value = "/api/room-creator/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF39 — envia o logo (kind=logo, PNG) ou a arte da marca (kind=art) aplicada nas portas")
    public Map<String, Object> upload(CurrentUser user, @RequestPart("file") MultipartFile file, @RequestParam(defaultValue = "art") String kind) {
        return creator.uploadArt(user, Uploads.image(file), kind);
    }
}
