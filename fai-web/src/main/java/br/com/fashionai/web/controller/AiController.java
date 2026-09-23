package br.com.fashionai.web.controller;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import br.com.fashionai.application.rf.Rf24AiEngineUseCase;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final Rf24AiEngineUseCase aiEngineUseCase;

    public AiController(Rf24AiEngineUseCase aiEngineUseCase) {
        this.aiEngineUseCase = aiEngineUseCase;
    }

    @PostMapping("/invoke")
    @Operation(summary = "RF24 - Invocar motor transversal de IA com auditoria e resiliencia")
    public AiResponse invoke(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InvokeAiRequest request) {
        UUID userId = UUID.fromString(jwt.getClaimAsString("user_id"));
        return aiEngineUseCase.execute(new AiRequest(
                userId,
                request.capability(),
                request.provider(),
                request.model(),
                request.input() == null ? Map.of() : request.input()
        ));
    }

    public record InvokeAiRequest(
            @NotNull AiCapability capability,
            @NotBlank String provider,
            @NotBlank String model,
            Map<String, Object> input
    ) {
    }
}
