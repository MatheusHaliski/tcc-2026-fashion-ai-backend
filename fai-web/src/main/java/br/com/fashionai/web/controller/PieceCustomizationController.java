package br.com.fashionai.web.controller;

import br.com.fashionai.application.piece3d.PieceCustomizationService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Editor 3D da peça: personalização por pessoa vinculada à peça original. */
@RestController
public class PieceCustomizationController {
    private final PieceCustomizationService service;

    public PieceCustomizationController(PieceCustomizationService service) {
        this.service = service;
    }

    @GetMapping("/api/pieces/{id}/customization")
    public Map<String, Object> get(CurrentUser user, @PathVariable UUID id) {
        return service.get(user, id);
    }

    @PutMapping("/api/pieces/{id}/customization")
    public Map<String, Object> save(CurrentUser user, @PathVariable UUID id, @RequestBody PieceCustomizationService.SaveCmd body) {
        return service.save(user, id, body);
    }

    @DeleteMapping("/api/pieces/{id}/customization")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(CurrentUser user, @PathVariable UUID id) {
        service.reset(user, id);
    }
}
