package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF32 — Meu Quarto (guarda-roupa espacial)")
public class RoomController {
    private final RoomService room;

    public RoomController(RoomService room) {
        this.room = room;
    }

    @GetMapping("/api/me/room")
    @Operation(summary = "RF32.CA01 — Meu quarto: módulos, nível, decorações e peças por endereço")
    public Map<String, Object> room(CurrentUser user) {
        return room.room(user);
    }

    @GetMapping("/api/users/{ownerId}/room-tour")
    @Operation(summary = "RF32.CA12 — Visitar o quarto de alguém (precisa da chave)")
    public Map<String, Object> tour(CurrentUser viewer, @PathVariable UUID ownerId) {
        return room.tour(viewer, ownerId);
    }

    public record KeyRequest(@NotNull UUID guestId) {
    }

    @PostMapping("/api/me/room/keys")
    @Operation(summary = "RF32.CA12 — Dar a chave do meu quarto a um seguidor")
    public Map<String, Object> giveKey(CurrentUser user, @RequestBody KeyRequest body) {
        return room.giveKey(user, body.guestId());
    }

    @GetMapping("/api/me/room/list")
    @Operation(summary = "RF32.CA03 — Visão em lista (endereço, última utilização, esquecidas)")
    public List<Map<String, Object>> listView(CurrentUser user) {
        return room.listView(user);
    }

    @GetMapping("/api/me/room/modules/{moduleId}")
    @Operation(summary = "RF32.CA02 — Abrir porta/gaveta/módulo")
    public Map<String, Object> open(CurrentUser user, @PathVariable String moduleId) {
        return room.open(user, moduleId);
    }

    public record AddressRequest(@NotBlank String address) {
    }

    @PutMapping("/api/pieces/{pieceId}/room-address")
    @Operation(summary = "RF32.CA04 — Mover peça para um endereço (door:1/hanger:3, drawer:2, shoe:4…)")
    public Map<String, Object> move(CurrentUser user, @PathVariable UUID pieceId, @RequestBody AddressRequest body) {
        return room.move(user, pieceId, body.address());
    }

    public record LabelRequest(@NotBlank String label) {
    }

    @PutMapping("/api/me/room/drawers/{drawer}")
    @Operation(summary = "RF32.CA05 — Renomear gaveta")
    public Map<String, String> renameDrawer(CurrentUser user, @PathVariable int drawer, @RequestBody LabelRequest body) {
        return room.renameDrawer(user, drawer, body.label());
    }

    @GetMapping("/api/pieces/{pieceId}/room-location")
    @Operation(summary = "RF32.CA06 — Onde está esta peça no quarto")
    public Map<String, Object> showInRoom(CurrentUser user, @PathVariable UUID pieceId) {
        return room.showInRoom(user, pieceId);
    }

    public record SeasonRequest(List<UUID> pieceIds, boolean store) {
    }

    @PostMapping("/api/me/room/season-storage")
    @Operation(summary = "RF32.CA07 — Guardar/retirar peças do baú de estação")
    public Map<String, Object> seasonStorage(CurrentUser user, @RequestBody SeasonRequest body) {
        return room.seasonStorage(user, body.pieceIds(), body.store());
    }

    @GetMapping("/api/me/room/organization/preview")
    @Operation(summary = "RF32.CA08 — Prévia da organização automática (com ou sem IA)")
    public Map<String, Object> organizePreview(CurrentUser user, @RequestParam(defaultValue = "false") boolean useAi) {
        return room.organizePreview(user, useAi);
    }

    public record OrganizeRequest(Map<String, String> labels, List<Map<String, Object>> moves) {
    }

    @PostMapping("/api/me/room/organization")
    @Operation(summary = "RF32.CA08 — Aplicar organização (rótulos e movimentos)")
    public Map<String, Object> applyOrganization(CurrentUser user, @RequestBody OrganizeRequest body) {
        return room.applyOrganization(user, body.labels() == null ? Map.of() : body.labels(), body.moves() == null ? List.of() : body.moves());
    }

    @DeleteMapping("/api/me/room/organization")
    @Operation(summary = "RF32.CA08 — Desfazer a última organização")
    public Map<String, Object> undoOrganization(CurrentUser user) {
        return room.undoOrganization(user);
    }

    @GetMapping("/api/pieces/{pieceId}/tag")
    @Operation(summary = "RF32.CA09 — Etiqueta da peça (ETI-01..07)")
    public Map<String, Object> pieceTag(CurrentUser user, @PathVariable UUID pieceId) {
        return room.pieceTag(user, pieceId);
    }

    public record DiaryRequest(@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date, String occasion, String note) {
    }

    @PostMapping("/api/pieces/{pieceId}/diary")
    @Operation(summary = "RF32.CA10 — Registrar uso da peça no diário")
    public Map<String, Object> diary(CurrentUser user, @PathVariable UUID pieceId, @RequestBody DiaryRequest body) {
        return room.diaryEntry(user, pieceId, body.date(), body.occasion(), body.note());
    }

    public record IslandRequest(List<UUID> schemeIds) {
    }

    @PostMapping("/api/me/room/island")
    @Operation(summary = "RF32.CA11 — Ilha central: esquemas em destaque")
    public Map<String, Object> island(CurrentUser user, @RequestBody IslandRequest body) {
        return room.island(user, body.schemeIds() == null ? List.of() : body.schemeIds());
    }

    public record MonogramRequest(@NotBlank String initials) {
    }

    @PutMapping("/api/me/room/monogram")
    @Operation(summary = "RF32 — Monograma do quarto")
    public Map<String, Object> monogram(CurrentUser user, @RequestBody MonogramRequest body) {
        return room.setMonogram(user, body.initials());
    }
}
