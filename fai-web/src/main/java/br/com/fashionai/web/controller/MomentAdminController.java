package br.com.fashionai.web.controller;

import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Momentos §56 — administração: criar, editar, agendar, destacar, cancelar, arquivar (sem deploy). */
@RestController
@RequestMapping("/api/admin/moments")
@Tag(name = "Momentos — administração")
public class MomentAdminController {
    private final MomentService moments;

    public MomentAdminController(MomentService moments) {
        this.moments = moments;
    }

    @GetMapping
    public List<Map<String, Object>> list(CurrentUser admin) {
        return moments.adminList(admin);
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(CurrentUser admin, @PathVariable UUID id) {
        return moments.adminDetail(admin, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar Momento oficial (nasce como rascunho)")
    public Map<String, Object> create(CurrentUser admin, @RequestBody MomentService.AdminMomentRequest body) {
        return moments.adminSave(admin, null, body);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(CurrentUser admin, @PathVariable UUID id, @RequestBody MomentService.AdminMomentRequest body) {
        return moments.adminSave(admin, id, body);
    }

    @PostMapping("/{id}/{action}")
    @Operation(summary = "schedule | feature | unfeature | cancel | archive | draft | end")
    public Map<String, Object> transition(CurrentUser admin, @PathVariable UUID id, @PathVariable String action) {
        return moments.adminTransition(admin, id, action);
    }

    @PostMapping("/jobs/tick")
    @Operation(summary = "Rodar o job de status/avisos agora")
    public Map<String, Integer> tick(CurrentUser admin) {
        moments.adminList(admin);   // requireAdmin
        return moments.tick();
    }
}
