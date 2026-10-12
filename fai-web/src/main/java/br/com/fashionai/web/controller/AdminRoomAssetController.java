package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.RoomAssetService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/room-assets")
public class AdminRoomAssetController {
    private final RoomAssetService assets;
    public AdminRoomAssetController(RoomAssetService assets) { this.assets = assets; }
    @GetMapping public Map<String, Object> list(CurrentUser user) { return assets.list(user); }
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> create(CurrentUser user, @RequestParam("command") String command,
                                     @RequestPart("image") MultipartFile image) throws IOException {
        if (image.getSize() > 8L * 1024 * 1024) throw new br.com.fashionai.application.common.ApiException(413, "ASSET_IMAGE_TOO_LARGE", br.com.fashionai.application.common.Msg.t("roomAssets.error"));
        RoomAssetService.Command parsed;
        try { parsed = br.com.fashionai.application.common.Json.MAPPER.readValue(command, RoomAssetService.Command.class); }
        catch (RuntimeException ex) { throw new br.com.fashionai.application.common.ApiException(400, "ASSET_METADATA_INVALID", br.com.fashionai.application.common.Msg.t("roomAssets.error")); }
        return assets.create(user, parsed, br.com.fashionai.web.support.Uploads.image(image));
    }
    @PostMapping(value = "/import-meshy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> importMeshy(CurrentUser user, @RequestParam("command") String command,
                                          @RequestParam("taskId") String taskId, @RequestPart("image") MultipartFile image) throws IOException {
        if (image.getSize() > 8L * 1024 * 1024) throw new br.com.fashionai.application.common.ApiException(413, "ASSET_IMAGE_TOO_LARGE", br.com.fashionai.application.common.Msg.t("roomAssets.error"));
        RoomAssetService.Command parsed;
        try { parsed = br.com.fashionai.application.common.Json.MAPPER.readValue(command, RoomAssetService.Command.class); }
        catch (RuntimeException ex) { throw new br.com.fashionai.application.common.ApiException(400, "ASSET_METADATA_INVALID", br.com.fashionai.application.common.Msg.t("roomAssets.error")); }
        return assets.importMeshy(user, parsed, br.com.fashionai.web.support.Uploads.image(image), taskId);
    }
    public record Review(boolean approve) {}
    @PostMapping("/{id}/review") public Map<String, Object> review(CurrentUser user, @PathVariable UUID id, @RequestBody Review command) { return assets.review(user, id, command.approve()); }
    @PostMapping("/{id}/publish") public Map<String, Object> publish(CurrentUser user, @PathVariable UUID id) { return assets.publish(user, id); }
}
