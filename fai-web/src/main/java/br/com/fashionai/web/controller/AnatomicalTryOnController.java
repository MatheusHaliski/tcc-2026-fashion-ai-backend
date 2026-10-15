package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AnatomicalTryOnService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;

@RestController
@RequestMapping("/api/try-on")
public class AnatomicalTryOnController {
    private final AnatomicalTryOnService service;

    public AnatomicalTryOnController(AnatomicalTryOnService service) {
        this.service = service;
    }

    @PostMapping("/anatomical-renders")
    @Operation(summary = "Provador anatômico com evidências verificadas e consentimento por solicitação")
    public ResponseEntity<Map<String, Object>> render(CurrentUser user,
            @RequestBody AnatomicalTryOnService.Request request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.render(user, request));
    }
    @PostMapping("/body-pose")
    @Operation(summary = "Diagnóstico de pose corporal; não certifica encaixe anatômico")
    public ResponseEntity<Map<String,Object>> pose(CurrentUser user,
            @RequestBody AnatomicalTryOnService.PersonRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.probe(user,request));
    }
}
