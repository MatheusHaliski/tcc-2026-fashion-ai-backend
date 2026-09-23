package br.com.fashionai.web.controller;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rf3/users")
public class AccountController {
    @GetMapping("/{userId}/privacy-probe")
    @PreAuthorize("@fashionAuthorization.canAccessUser(#userId, authentication)")
    @Operation(summary = "RF3.CA14 - Prova controle de acesso por dono do recurso")
    public Map<String, String> privacyProbe(@PathVariable("userId") UUID userId) {
        return Map.of("userId", userId.toString(), "status", "visible");
    }
}
