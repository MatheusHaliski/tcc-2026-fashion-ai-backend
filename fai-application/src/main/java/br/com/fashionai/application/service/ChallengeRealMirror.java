package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.application.service.ChallengeService.MirrorUpload;

import java.awt.image.BufferedImage;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.dayRef;
import static br.com.fashionai.application.service.ChallengeRules.mirrorPhotoUrl;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.windowStart;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONCLUIU;

/**
 * Espelho de Verdade (DET-C08, ETI-05): foto do dia privada, leitura autorizada e confirmação por colega.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeRealMirror {
    private final Guard guard;
    private final UserRepository users;
    private final ChallengeParticipantRepository participants;
    private final ChallengeEventRepository evidence;
    private final MediaService media;
    private final ChallengeStore store;
    private final ChallengeConclusion conclusion;

    ChallengeRealMirror(Guard guard, UserRepository users, ChallengeParticipantRepository participants, ChallengeEventRepository evidence,
                        MediaService media, ChallengeStore store, ChallengeConclusion conclusion) {
        this.guard = guard;
        this.users = users;
        this.participants = participants;
        this.evidence = evidence;
        this.media = media;
        this.store = store;
        this.conclusion = conclusion;
    }

    /**
     * Foto do dia (ETI-05: privada por padrão). Recodificada em JPEG (sai EXIF/GPS), com nome aleatório e em
     * {@code restricted/}: o /media só a entrega a admin. Dono, colegas com o consentimento dele e admin a veem por
     * {@link #mirrorPhoto} (GET /api/challenges/{id}/mirror-photos/{photoId}).
     */
    Map<String, Object> realMirror(CurrentUser user, UUID id, byte[] bytes) {
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = store.template(i.getTemplateCode());
        if (!t.getCode().equals("REAL_MIRROR") || !ATIVO.equals(i.getState())) {
            throw ApiException.badRequest("DESAFIO_INVALIDO", Msg.t("challenge.este_envio_vale_so_para"));
        }
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        ZonedDateTime ws = windowStart(id, today());
        ZonedDateTime now = ZonedDateTime.now(FaiPointsService.ZONE);
        if (now.isBefore(ws) || now.isAfter(ws.plusMinutes(30))) {
            throw new ApiException(409, "FORA_DA_JANELA", Msg.t("challenge.a_janela_de_hoje_e", ws.toLocalTime(), ws.plusMinutes(30).toLocalTime()));
        }
        if (bytes == null || bytes.length == 0 || bytes.length > 10 * 1024 * 1024) {
            throw ApiException.badRequest("FOTO_INVALIDA", Msg.t("challenge.envie_uma_foto_de_ate"));
        }
        User owner = users.findById(user.id()).orElseThrow();
        MirrorUpload upload = storePrivateMirrorPhoto(owner, id, bytes);
        UUID photoId = upload.photoId();
        MediaStoragePort.StoredObject stored = upload.stored();
        Map<String, Object> goal = Json.map(me.getPersonalGoalJson());
        @SuppressWarnings("unchecked") Map<String, Object> photos = goal.get("photos") instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : new LinkedHashMap<>();
        // "url" é a do storage (restricted/, uso interno para ler o arquivo); o cliente só recebe a URL da API
        photos.put(today().toString(), Map.of("photoId", photoId.toString(), "url", stored.url()));
        goal.put("photos", photos);
        me.setPersonalGoalJson(Json.write(goal));
        participants.save(me);
        store.record(i, user.id(), "REAL_PHOTO", dayRef(id, today()));
        conclusion.refresh(i, t);
        return Map.of("recorded", true, "private", !Boolean.TRUE.equals(goal.get("photoConsent")),
                "photoId", photoId, "url", mirrorPhotoUrl(id, photoId.toString()),
                "note", Msg.t("challenge.foto_privada_por_padrao_a"));
    }

    /**
     * Grava a foto do Espelho de Verdade: valida pelo conteúdo, recodifica em JPEG (a recodificação descarta EXIF/GPS e
     * qualquer outro metadado), usa nome aleatório (nada de data/ids adivinháveis) e guarda em {@code restricted/}.
     */
    MirrorUpload storePrivateMirrorPhoto(User owner, UUID instanceId, byte[] bytes) {
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.scaleToFit(ImageOps.decode(bytes), 2048, 2048);
        byte[] jpeg = ImageOps.jpeg(img, 0.9f);
        UUID photoId = UUID.randomUUID();
        MediaStoragePort.StoredObject stored = media.put("restricted/challenges/" + instanceId + "/" + owner.getId() + "/" + photoId + ".jpg",
                jpeg, "image/jpeg");
        media.register(owner, PhotoOrigin.LOOSE, instanceId, stored, null, null, jpeg, img.getWidth(), img.getHeight(), null,
                ModerationStatus.PENDING, Map.of("challenge", "REAL_MIRROR", "private", true, "mirrorPhotoId", photoId.toString()));
        return new MirrorUpload(photoId, stored);
    }

    /** Fotos do Espelho de Verdade de um participante, por dia, com a URL autenticada da API. */
    List<Map<String, Object>> mirrorPhotos(ChallengeInstance i, ChallengeParticipant p) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (Json.map(p.getPersonalGoalJson()).get("photos") instanceof Map<?, ?> photos) {
            Map<String, Object> byDay = new TreeMap<>();
            photos.forEach((day, v) -> byDay.put(String.valueOf(day), v));
            byDay.forEach((day, v) -> {
                if (v instanceof Map<?, ?> m && m.get("photoId") != null) {
                    String photoId = String.valueOf(m.get("photoId"));
                    out.add(Map.of("day", day, "photoId", photoId, "url", mirrorPhotoUrl(i.getId(), photoId)));
                }
            });
        }
        return out;
    }

    /**
     * Bytes da foto do Espelho de Verdade (ETI-05): o autor; um colega ativo do mesmo desafio (fora do modo Comunidade)
     * quando o autor consentiu e não há bloqueio entre os dois; ou admin. Quem não pode recebe 403 auditado.
     */
    byte[] mirrorPhoto(CurrentUser user, UUID id, UUID photoId) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        ChallengeInstance i = store.instance(id);
        for (ChallengeParticipant p : participants.findByInstanceId(id)) {
            Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
            if (!(goal.get("photos") instanceof Map<?, ?> photos)) {
                continue;
            }
            for (Object v : photos.values()) {
                if (!(v instanceof Map<?, ?> m) || !photoId.toString().equals(String.valueOf(m.get("photoId")))) {
                    continue;
                }
                boolean author = p.getUserId().equals(user.id());
                boolean teammate = !author && !"COMUNIDADE".equals(i.getMode()) && Boolean.TRUE.equals(goal.get("photoConsent"))
                        && participants.findByInstanceIdAndUserId(id, user.id())
                        .filter(x -> P_ATIVO.equals(x.getStatus()) || P_CONCLUIU.equals(x.getStatus())).isPresent()
                        && !guard.blocked(user.id(), p.getUserId());
                if (!author && !teammate && !user.admin()) {
                    throw guard.deny(user, "challenge-photo:" + photoId, Msg.t("challenge.esta_pessoa_nao_autorizou_a"));
                }
                return media.readRestricted(String.valueOf(m.get("url"))).orElseThrow(() -> ApiException.notFound(Msg.t("challenge.foto_do_dia")));
            }
        }
        throw ApiException.notFound(Msg.t("challenge.foto_do_dia"));
    }

    /** Em Equipe, a confirmação vem de um colega (§4) — só vê a foto quem tem o consentimento do autor. */
    Map<String, Object> confirmRealMirror(CurrentUser user, UUID id, UUID memberId, LocalDate day) {
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = store.template(i.getTemplateCode());
        if (!"EQUIPE".equals(i.getMode())) {
            throw ApiException.badRequest("SEM_CONFIRMACAO", Msg.t("challenge.confirmacao_por_colega_existe_so"));
        }
        participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        if (memberId.equals(user.id())) {
            throw ApiException.badRequest("AUTOCONFIRMACAO", Msg.t("challenge.a_confirmacao_precisa_vir_de"));
        }
        ChallengeParticipant member = participants.findByInstanceIdAndUserId(id, memberId).orElseThrow(() -> ApiException.notFound("Participante"));
        if (!Boolean.TRUE.equals(Json.map(member.getPersonalGoalJson()).get("photoConsent"))) {
            throw guard.deny(user, "challenge-photo:" + memberId, Msg.t("challenge.esta_pessoa_nao_autorizou_a"));
        }
        LocalDate d = day == null ? today() : day;
        if (!evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(id, memberId, "REAL_PHOTO", dayRef(id, d))) {
            throw ApiException.notFound(Msg.t("challenge.foto_do_dia"));
        }
        ChallengeEvent e = new ChallengeEvent();
        e.setId(UUID.randomUUID());
        e.setInstanceId(id);
        e.setUserId(memberId);
        e.setEvidenceType("REAL_PHOTO_CONFIRMED");
        e.setRefId(dayRef(id, d));
        if (!evidence.existsByInstanceIdAndUserIdAndEvidenceTypeAndRefId(id, memberId, "REAL_PHOTO_CONFIRMED", dayRef(id, d))) {
            evidence.save(e);
        }
        conclusion.refresh(i, t);
        return Map.of("confirmed", true);
    }
}
