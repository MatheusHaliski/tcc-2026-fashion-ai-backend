package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AccountService;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
@Tag(name = "RF3 — Minha conta, privacidade e dados (LGPD)")
public class MeController {
    private final AccountService account;

    public MeController(AccountService account) {
        this.account = account;
    }

    @GetMapping
    @Operation(summary = "RF3 — Dados da conta autenticada")
    public Map<String, Object> me(CurrentUser user) {
        return account.me(user);
    }

    @PatchMapping("/sensitive")
    @Operation(summary = "RF3.CA05 — Alterar senha, e-mail, telefone, nascimento ou 2FA (pede reautenticação)")
    public Map<String, Object> updateSensitive(CurrentUser user, @RequestBody AccountService.SensitiveUpdate body) {
        return account.updateSensitive(user, body);
    }

    public record CodeRequest(@NotBlank String code) {
    }

    @PostMapping("/email-change/confirm")
    @Operation(summary = "RF3.CA05 — Confirmar troca de e-mail com o código enviado ao novo endereço")
    public Object confirmEmailChange(CurrentUser user, @RequestBody CodeRequest body) {
        return account.confirmEmailChange(user, body.code());
    }

    public record PrivacyRequest(@NotNull Visibility visibility) {
    }

    @PutMapping("/privacy")
    @Operation(summary = "RF3.CA10 — Visibilidade padrão do perfil e conteúdo")
    public Map<String, Object> privacy(CurrentUser user, @RequestBody PrivacyRequest body) {
        return account.updatePrivacy(user, body.visibility());
    }

    @GetMapping("/consents")
    @Operation(summary = "RF24/LGPD — Consentimentos por finalidade")
    public List<Map<String, Object>> consents(CurrentUser user) {
        return account.consents(user);
    }

    public record ConsentRequest(boolean granted) {
    }

    @PutMapping("/consents/{purpose}")
    @Operation(summary = "RF24/LGPD — Conceder ou retirar um consentimento")
    public List<Map<String, Object>> setConsent(CurrentUser user, @PathVariable ConsentPurpose purpose, @RequestBody ConsentRequest body) {
        return account.setConsent(user, purpose, body.granted());
    }

    @PostMapping("/exports")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "RF3.CA12 — Solicitar exportação dos meus dados")
    public Map<String, Object> requestExport(CurrentUser user) {
        return account.requestExport(user);
    }

    @GetMapping("/exports")
    @Operation(summary = "RF3.CA12 — Minhas exportações")
    public List<Map<String, Object>> exports(CurrentUser user) {
        return account.exportsOf(user);
    }

    @GetMapping("/exports/{exportId}/file")
    @Operation(summary = "RF3.CA12 — Baixar o pacote exportado")
    public ResponseEntity<byte[]> download(CurrentUser user, @PathVariable UUID exportId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fashionai-dados-" + exportId + ".zip\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(account.downloadExport(user, exportId));
    }

    public record DeletionRequest(@NotBlank String password) {
    }

    @PostMapping("/deletion")
    @Operation(summary = "RF3.CA13 — Agendar exclusão da conta (janela de arrependimento)")
    public Map<String, Object> requestDeletion(CurrentUser user, @RequestBody DeletionRequest body) {
        return account.requestDeletion(user, body.password());
    }

    @DeleteMapping("/deletion")
    @Operation(summary = "RF3.CA13 — Cancelar a exclusão agendada")
    public Map<String, Object> cancelDeletion(CurrentUser user) {
        return account.cancelDeletion(user);
    }
}
