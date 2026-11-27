package br.com.fashionai.web.controller;

import br.com.fashionai.application.laundry.LaundryService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF-PESQ-03 — ciclo de lavanderia e disponibilidade para vestir. */
@RestController
@Tag(name = "Laundry — wear cycle and availability")
public class LaundryController {
    private final LaundryService service;

    public LaundryController(LaundryService service) {
        this.service = service;
    }

    @GetMapping("/api/me/laundry")
    public Map<String, Object> board(CurrentUser user) {
        return service.board(user);
    }

    @PostMapping("/api/me/laundry/pieces/{id}/worn")
    public Map<String, Object> worn(CurrentUser user, @PathVariable UUID id) {
        return service.markWorn(user, id);
    }

    @PostMapping("/api/me/laundry/pieces/{id}/clean")
    public Map<String, Object> clean(CurrentUser user, @PathVariable UUID id) {
        return service.markClean(user, id);
    }

    @GetMapping("/api/me/laundry/pieces/{id}/history")
    public List<Map<String, Object>> history(CurrentUser user, @PathVariable UUID id) {
        return service.history(user, id);
    }

    @PostMapping("/api/me/laundry/batches")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(CurrentUser user, @RequestBody LaundryService.BatchForm body) {
        return service.createBatch(user, body);
    }

    @PostMapping("/api/me/laundry/batches/{id}/finish")
    public Map<String, Object> finish(CurrentUser user, @PathVariable UUID id, @RequestBody LaundryService.FinishForm body) {
        return service.finishBatch(user, id, body);
    }

    @PostMapping("/api/me/laundry/batches/{id}/cancel")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id, @RequestParam long expectedVersion) {
        return service.cancelBatch(user, id, expectedVersion);
    }
}
