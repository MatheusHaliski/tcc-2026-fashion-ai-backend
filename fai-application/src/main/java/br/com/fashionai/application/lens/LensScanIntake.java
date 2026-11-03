package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.LensIntent;
import br.com.fashionai.domain.model.enums.LensSource;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Entrada de um scan: a foto enviada (origem, intenção, imagem aceita e reduzida) ou a foto de uma peça/look do app
 * ("Ver no Lens", só se quem pede pode ver o original). Depois, cota e gravação pelo {@link LensScanRecorder}.
 */
final class LensScanIntake {
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final MediaService media;
    private final Guard guard;
    private final LensScanRecorder recorder;

    LensScanIntake(WardrobeItemRepository pieces, SchemeRepository schemes, MediaService media, Guard guard,
                   LensScanRecorder recorder) {
        this.pieces = pieces;
        this.schemes = schemes;
        this.media = media;
        this.guard = guard;
        this.recorder = recorder;
    }

    /** Foto enviada: orientada (EXIF), reduzida a 2048 px e regravada sem metadados antes de ser lida e guardada. */
    LensViews.ScanView create(CurrentUser user, LensService.CreateCommand cmd, byte[] bytes) {
        LensSource source = LensInputs.parseEnum(LensSource.class, cmd == null ? null : cmd.source(), LensSource.UPLOAD, "source");
        if (source.inApp()) {
            throw ApiException.badRequest("ORIGEM_INVALIDA", Msg.t("lens.origem_invalida"), Map.of("field", "source"));
        }
        LensIntent intent = LensInputs.parseEnum(LensIntent.class, cmd == null ? null : cmd.intent(), LensIntent.IDENTIFY, "intent");
        if (bytes == null || bytes.length == 0) {
            throw ApiException.badRequest("ARQUIVO_VAZIO", Msg.t("uploads.envie_uma_imagem"));
        }
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage photo = ImageOps.scaleToFit(ImageOps.decode(bytes), LensConfig.IMAGE_MAX_SIDE, LensConfig.IMAGE_MAX_SIDE);
        int faces = cmd == null || cmd.facesRedacted() == null ? 0 : Math.max(0, Math.min(500, cmd.facesRedacted()));
        boolean confirmed = cmd != null && Boolean.TRUE.equals(cmd.redactionConfirmed());
        recorder.acquireQuota(user);
        return recorder.process(user, source, null, intent, photo, faces, confirmed);
    }

    /** "Ver no Lens": peça ou look visível para quem pede (senão 404); sem foto legível, 422. */
    LensViews.ScanView fromApp(CurrentUser user, LensService.FromAppCommand cmd) {
        if (cmd == null || cmd.id() == null || cmd.type() == null) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("lens.tipo_invalido"), Map.of("field", "type"));
        }
        String type = cmd.type().trim().toUpperCase(Locale.ROOT);
        List<String> urls;
        LensSource source;
        if ("PIECE".equals(type)) {
            WardrobeItem w = pieces.findById(cmd.id()).filter(p -> visiblePiece(user, p))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            source = LensSource.IN_APP_PIECE;
            urls = new ArrayList<>();
            if (!w.isDefaultImage()) {
                urls.add(w.getStudioImageUrl());
                urls.add(w.getImageUrl());
                urls.add(w.getOriginalImageUrl());
            }
        } else if ("LOOK".equals(type)) {
            Scheme s = schemes.findById(cmd.id()).filter(x -> visibleScheme(user, x))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("lens.look")));
            source = LensSource.IN_APP_LOOK;
            urls = new ArrayList<>();
            urls.add(s.getCoverImageUrl());
        } else {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("lens.tipo_invalido"), Map.of("field", "type"));
        }
        BufferedImage photo = null;
        for (String url : urls) {
            Optional<byte[]> bytes = url == null ? Optional.empty() : media.read(url);
            if (bytes.isPresent()) {
                try {
                    photo = ImageOps.decode(bytes.get());
                    break;
                } catch (ApiException ex) {
                    // formato que o servidor não lê: tenta a próxima versão da foto
                }
            }
        }
        if (photo == null) {
            throw new ApiException(422, "LENS_SEM_IMAGEM", Msg.t("lens.sem_imagem"));
        }
        recorder.acquireQuota(user);
        return recorder.process(user, source, cmd.id(), LensIntent.IDENTIFY,
                ImageOps.scaleToFit(photo, LensConfig.IMAGE_MAX_SIDE, LensConfig.IMAGE_MAX_SIDE), 0, false);
    }

    /** Peça visível para quem pede: dono, ou aprovada, não arquivada e visível (peça × perfil, sem bloqueio). */
    private boolean visiblePiece(CurrentUser user, WardrobeItem w) {
        if (w.getUser() == null) {
            return false;
        }
        if (user.id().equals(w.getUser().getId())) {
            return true;
        }
        return w.getModerationStatus() == ModerationStatus.APPROVED && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED
                && guard.canView(user, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    /** Look visível para quem pede: dono, ou não arquivado e visível (look × perfil do autor, sem bloqueio). */
    private boolean visibleScheme(CurrentUser user, Scheme s) {
        if (s.getUser() == null) {
            return false;
        }
        if (user.id().equals(s.getUser().getId())) {
            return true;
        }
        return s.getStatus() != SchemeStatus.ARCHIVED && guard.canView(user, s.getUser().getId(),
                SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }
}
