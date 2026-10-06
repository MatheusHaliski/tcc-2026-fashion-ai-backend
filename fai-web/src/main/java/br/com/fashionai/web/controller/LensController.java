package br.com.fashionai.web.controller;

import br.com.fashionai.application.lens.LensService;
import br.com.fashionai.application.lens.LensViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * RF54 · FashionAI Lens. Tudo exige login e tudo é do dono: outra pessoa recebe 404 em qualquer rota (o serviço filtra
 * pelo dono, nunca devolve 403). O upload multipart passa pelo {@code UploadSafetyInterceptor} (ALLOW/REVIEW/BLOCK) como
 * todo multipart de {@code /api/**}. MVP síncrono: o POST já devolve o scan pronto.
 */
@RestController
@Tag(name = "RF54 — FashionAI Lens")
public class LensController {
    private final LensService lens;

    public LensController(LensService lens) {
        this.lens = lens;
    }

    public record SavedBody(Boolean saved) {
    }

    public record WantBody(Boolean wanted) {
    }

    public record OwnBody(UUID itemId) {
    }

    @PostMapping(value = "/api/lens/scans", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF54 — Novo scan: imagem (rostos já borrados no aparelho) + source, intent, facesRedacted, redactionConfirmed",
            description = "Sem redactionConfirmed=true (borrão feito no aparelho ou confirmação de que não há rostos) a leitura é só "
                    + "local: a foto não vai para a IA externa e o scan volta com errorCode REDACTION_UNCONFIRMED.")
    public LensViews.ScanView create(CurrentUser user, @RequestPart("image") MultipartFile image,
                                     @RequestParam(value = "source", required = false) String source,
                                     @RequestParam(value = "intent", required = false) String intent,
                                     @RequestParam(value = "facesRedacted", required = false) Integer facesRedacted,
                                     @RequestParam(value = "redactionConfirmed", required = false) Boolean redactionConfirmed) {
        return lens.create(user, new LensService.CreateCommand(source, intent, facesRedacted, redactionConfirmed), Uploads.image(image));
    }

    @PostMapping("/api/lens/scans/from-app")
    @Operation(summary = "RF54 — Ver no Lens: scan da foto de uma peça ou look do app (404 se quem pede não pode vê-lo)")
    public LensViews.ScanView fromApp(CurrentUser user, @RequestBody LensService.FromAppCommand body) {
        return lens.fromApp(user, body);
    }

    @GetMapping("/api/lens/scans/{id}")
    @Operation(summary = "RF54 — Scan com as peças detectadas e a leitura do look (só o dono)")
    public LensViews.ScanView get(CurrentUser user, @PathVariable UUID id) {
        return lens.get(user, id);
    }

    @GetMapping("/api/lens/scans/{id}/image")
    @Operation(summary = "RF54 — Imagem do scan, sem EXIF/GPS (só o dono); variant=thumb devolve a miniatura")
    public ResponseEntity<byte[]> image(CurrentUser user, @PathVariable UUID id,
                                        @RequestParam(value = "variant", required = false) String variant) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePrivate())
                .body(lens.image(user, id, "thumb".equalsIgnoreCase(variant)));
    }

    @GetMapping("/api/me/lens/scans")
    @Operation(summary = "RF54 — Histórico e inspirações (saved=true|false; wanted=true só com peças marcadas \"Quero\")")
    public Views.Page<LensViews.ScanCard> history(CurrentUser user,
                                                  @RequestParam(value = "saved", required = false) Boolean saved,
                                                  @RequestParam(value = "wanted", required = false) Boolean wanted,
                                                  @RequestParam(value = "page", defaultValue = "0") int page,
                                                  @RequestParam(value = "size", defaultValue = "12") int size) {
        return lens.history(user, saved, wanted, page, size);
    }

    @PatchMapping("/api/lens/scans/{id}")
    @Operation(summary = "RF54 — Salvar (inspiração, não expira) ou tirar dos salvos")
    public LensViews.ScanView setSaved(CurrentUser user, @PathVariable UUID id, @RequestBody SavedBody body) {
        return lens.setSaved(user, id, body == null ? null : body.saved());
    }

    @DeleteMapping("/api/lens/scans/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF54 — Excluir o scan (imagem, peças detectadas e correções)")
    public void delete(CurrentUser user, @PathVariable UUID id) {
        lens.delete(user, id);
    }

    @GetMapping("/api/lens/scans/{id}/matches")
    @Operation(summary = "RF54 — Peças parecidas: MY_CLOSET (piso 55) ou COMMUNITY (só públicas de outras pessoas, piso 65)")
    public LensViews.Matches matches(CurrentUser user, @PathVariable UUID id,
                                     @RequestParam(value = "detection", required = false) UUID detection,
                                     @RequestParam(value = "scope", required = false) String scope) {
        return lens.matches(user, id, detection, scope);
    }

    @GetMapping("/api/lens/scans/{id}/reading")
    @Operation(summary = "RF54 — Leitura do look (ou de uma peça): estilo, paleta, compatibilidade com o DNA, Hype do grupo, impacto")
    public LensViews.ReadingView reading(CurrentUser user, @PathVariable UUID id,
                                         @RequestParam(value = "detection", required = false) UUID detection) {
        return lens.reading(user, id, detection);
    }

    @PostMapping("/api/lens/scans/{id}/recreate")
    @Operation(summary = "RF54 — Recriar o look com as suas peças (SAFE/DISCOVERY/EXPERIMENTAL; slots fixados não mudam)")
    public LensViews.RecreatePlan recreate(CurrentUser user, @PathVariable UUID id,
                                           @RequestBody(required = false) LensService.RecreateCommand body) {
        return lens.recreate(user, id, body);
    }

    @PatchMapping("/api/lens/scans/{id}/detections/{did}")
    @Operation(summary = "RF54 — Corrigir atributos da peça (refaz as correspondências) ou marcar \"não é roupa\" (dismissed)")
    public LensViews.DetectionView correct(CurrentUser user, @PathVariable UUID id, @PathVariable UUID did,
                                           @RequestBody LensService.CorrectionCommand body) {
        return lens.correct(user, id, did, body);
    }

    @PostMapping("/api/lens/scans/{id}/detections")
    @Operation(summary = "RF54 — Marcar uma peça que o detector não viu (caixa em % + categoria)")
    public LensViews.DetectionView add(CurrentUser user, @PathVariable UUID id, @RequestBody LensService.AddDetectionCommand body) {
        return lens.add(user, id, body);
    }

    @PutMapping("/api/lens/scans/{id}/detections/{did}/want")
    @Operation(summary = "RF54 — \"Quero\" (lista de desejos das inspirações)")
    public LensViews.DetectionView want(CurrentUser user, @PathVariable UUID id, @PathVariable UUID did, @RequestBody WantBody body) {
        return lens.want(user, id, did, body == null ? null : body.wanted());
    }

    @PostMapping("/api/lens/scans/{id}/detections/{did}/own")
    @Operation(summary = "RF54 — \"Eu tenho\": liga a uma peça sua (itemId) ou devolve o cadastro pré-preenchido")
    public LensViews.OwnResult own(CurrentUser user, @PathVariable UUID id, @PathVariable UUID did,
                                   @RequestBody(required = false) OwnBody body) {
        return lens.own(user, id, did, body == null ? null : body.itemId());
    }
}
