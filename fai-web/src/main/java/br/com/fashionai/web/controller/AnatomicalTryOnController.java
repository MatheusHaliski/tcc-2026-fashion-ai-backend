package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AnatomicalTryOnService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
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
    @PostMapping(value = "/person-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Foto da pessoa para a prova com IA: até 1536 px, sem metadados, só na pasta do próprio usuário")
    public Map<String, Object> personPhoto(CurrentUser user, @RequestPart("file") MultipartFile file) throws IOException {
        return service.uploadPerson(user, file.getBytes());
    }

    @PostMapping("/look-renders")
    @Operation(summary = "Look inteiro na GPU (Meu Quarto e Provador): peça inteira, parte de baixo e de cima em sequência")
    public ResponseEntity<Map<String, Object>> look(CurrentUser user, @RequestBody AnatomicalTryOnService.LookRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.renderLook(user, request));
    }

    @PostMapping("/body-pose")
    @Operation(summary = "Diagnóstico de pose corporal; não certifica encaixe anatômico")
    public ResponseEntity<Map<String,Object>> pose(CurrentUser user,
            @RequestBody AnatomicalTryOnService.PersonRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.probe(user,request));
    }
}
