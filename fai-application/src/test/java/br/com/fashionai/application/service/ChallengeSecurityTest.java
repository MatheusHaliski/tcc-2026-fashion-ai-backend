package br.com.fashionai.application.service;

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
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF36 — Espelho de Verdade privado de verdade (ETI-05) e votação às cegas com um voto por pessoa. */
class ChallengeSecurityTest {
    private final UUID instanceId = UUID.randomUUID();
    private final UUID author = UUID.randomUUID();
    private final UUID mate = UUID.randomUUID();
    private final UUID stranger = UUID.randomUUID();
    private final UUID photoId = UUID.randomUUID();
    private final List<String> putKeys = new ArrayList<>();
    private final List<byte[]> putBytes = new ArrayList<>();
    private ChallengeInstanceRepository instances;
    private ChallengeParticipantRepository participants;
    private ChallengeVoteRepository votes;
    private ChallengeEventRepository evidence;
    private ChallengeTemplateRepository templates;
    private MediaService media;
    private ChallengeService service;
    private ChallengeInstance instance;
    private ChallengeParticipant authorRow;
    private ChallengeParticipant mateRow;

    @BeforeEach
    void setUp() {
        instances = mock(ChallengeInstanceRepository.class);
        participants = mock(ChallengeParticipantRepository.class);
        votes = mock(ChallengeVoteRepository.class);
        evidence = mock(ChallengeEventRepository.class);
        templates = mock(ChallengeTemplateRepository.class);
        media = mock(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv -> {
            putKeys.add(inv.getArgument(0));
            putBytes.add(inv.getArgument(1));
            return new MediaStoragePort.StoredObject(inv.getArgument(0), "http://api/media/" + inv.getArgument(0),
                    ((byte[]) inv.getArgument(1)).length, inv.getArgument(2));
        });
        when(media.register(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(new Photo());
        when(media.readRestricted("http://api/media/restricted/challenges/x.jpg")).thenReturn(Optional.of(new byte[]{1, 2, 3}));
        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> {
        }, follows);

        instance = new ChallengeInstance();
        instance.setId(instanceId);
        instance.setMode("EQUIPE");
        instance.setState(ChallengeService.ATIVO);
        instance.setTemplateCode("REAL_MIRROR");
        when(instances.findById(instanceId)).thenReturn(Optional.of(instance));
        authorRow = participant(author, false);
        mateRow = participant(mate, false);
        when(participants.findByInstanceId(instanceId)).thenReturn(List.of(authorRow, mateRow));
        when(participants.findByInstanceIdAndUserId(instanceId, author)).thenReturn(Optional.of(authorRow));
        when(participants.findByInstanceIdAndUserId(instanceId, mate)).thenReturn(Optional.of(mateRow));
        when(participants.findByInstanceIdAndUserId(instanceId, stranger)).thenReturn(Optional.empty());

        service = new ChallengeService(templates, instances, participants, evidence, null, votes, null, null, null, null, null,
                follows, null, null, null, null, null, media, guard, null, null);
    }

    private ChallengeParticipant participant(UUID userId, boolean consent) {
        ChallengeParticipant p = new ChallengeParticipant();
        p.setId(UUID.randomUUID());
        p.setInstanceId(instanceId);
        p.setUserId(userId);
        p.setStatus(ChallengeService.P_ATIVO);
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("photoConsent", consent);
        if (userId.equals(author)) {
            goal.put("photos", Map.of("2026-09-28", Map.of("photoId", photoId.toString(), "url", "http://api/media/restricted/challenges/x.jpg")));
        }
        p.setPersonalGoalJson(Json.write(goal));
        return p;
    }

    private void consent(boolean given) {
        Map<String, Object> goal = new LinkedHashMap<>(Json.map(authorRow.getPersonalGoalJson()));
        goal.put("photoConsent", given);
        authorRow.setPersonalGoalJson(Json.write(goal));
    }

    private static CurrentUser user(UUID id, String role) {
        return new CurrentUser(id, "u", role, ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    }

    /** JPEG com APP1 Exif carregando um "GPS" em texto — tem de sumir na recodificação. */
    private static byte[] jpegWithGps() {
        BufferedImage img = new BufferedImage(64, 48, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillRect(0, 0, 64, 48);
        g.dispose();
        byte[] jpeg = ImageOps.jpeg(img, 0.9f);
        byte[] secret = "GPSLatitude=-23.5505;GPSLongitude=-46.6333".getBytes(StandardCharsets.US_ASCII);
        byte[] tiff = {'I', 'I', 0x2A, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0};    // IFD0 vazio, sem próximo IFD
        int len = 2 + 6 + tiff.length + secret.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);                                              // SOI
        out.writeBytes(new byte[]{(byte) 0xFF, (byte) 0xE1, (byte) (len >> 8), (byte) len, 'E', 'x', 'i', 'f', 0, 0});
        out.writeBytes(tiff);
        out.writeBytes(secret);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }

    @Test
    void fotoDoEspelhoVaiParaRestrictedRecodificadaSemExifEComNomeAleatorio() {
        byte[] original = jpegWithGps();
        assertThat(contains(original, "GPSLatitude")).isTrue();
        User owner = new User();
        owner.assignId(author);

        ChallengeService.MirrorUpload up = service.storePrivateMirrorPhoto(owner, instanceId, original);

        String key = putKeys.get(0);
        assertThat(key).startsWith("restricted/challenges/" + instanceId + "/" + author + "/").endsWith(".jpg")
                .contains(up.photoId().toString());
        assertThat(key).doesNotContain(ChallengeService.today().toString());       // nada de data adivinhável no nome
        byte[] stored = putBytes.get(0);
        assertThat(ImageOps.detectMime(stored)).isEqualTo("image/jpeg");
        assertThat(contains(stored, "GPSLatitude")).isFalse();
        assertThat(contains(stored, "Exif")).isFalse();
        assertThat(ChallengeService.mirrorPhotoUrl(instanceId, up.photoId().toString()))
                .isEqualTo("/api/challenges/" + instanceId + "/mirror-photos/" + up.photoId());
    }

    @Test
    void fotoSoSaiParaOAutorColegaComConsentimentoOuAdmin() {
        assertThat(service.mirrorPhoto(user(author, "USER"), instanceId, photoId)).containsExactly(1, 2, 3);

        // sem consentimento, nem colega de equipe vê
        assertThatThrownBy(() -> service.mirrorPhoto(user(mate, "USER"), instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        consent(true);
        assertThat(service.mirrorPhoto(user(mate, "USER"), instanceId, photoId)).containsExactly(1, 2, 3);

        // quem não participa não vê nem com consentimento; admin vê
        assertThatThrownBy(() -> service.mirrorPhoto(user(stranger, "USER"), instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThat(service.mirrorPhoto(user(stranger, "ADMIN"), instanceId, photoId)).containsExactly(1, 2, 3);

        // modo Comunidade: participantes são desconhecidos entre si — só o autor
        instance.setMode("COMUNIDADE");
        assertThatThrownBy(() -> service.mirrorPhoto(user(mate, "USER"), instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);

        assertThatThrownBy(() -> service.mirrorPhoto(user(author, "USER"), instanceId, UUID.randomUUID()))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(404);
        assertThatThrownBy(() -> service.mirrorPhoto(null, instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(401);
    }

    @Test
    void detalheDevolveURLDaApiENuncaDoStorage() {
        List<Map<String, Object>> photos = service.mirrorPhotos(instance, authorRow);
        assertThat(photos).hasSize(1);
        assertThat(photos.get(0)).containsEntry("url", "/api/challenges/" + instanceId + "/mirror-photos/" + photoId)
                .containsEntry("day", "2026-09-28").doesNotContainValue("http://api/media/restricted/challenges/x.jpg");
    }

    // ------------------------------------------------------------------ votação

    private void battle() {
        instance.setMode("DUELO");
        instance.setTemplateCode("RUNWAY_BATTLE");
        ChallengeTemplate t = new ChallengeTemplate();
        t.setCode("RUNWAY_BATTLE");
        t.setActive(true);
        when(templates.findById("RUNWAY_BATTLE")).thenReturn(Optional.of(t));
        ChallengeEvent entry = new ChallengeEvent();
        entry.setEvidenceType("LOOK_ENTRY");
        entry.setUserId(author);
        entry.setRefId(photoId);
        when(evidence.findByInstanceId(instanceId)).thenReturn(List.of(entry));
    }

    @Test
    void votoExigeContaVerificada() {
        battle();
        CurrentUser unverified = new CurrentUser(stranger, "u", "USER", ProfileType.PESSOAL, false,
                AccountStatus.PENDING_EMAIL_VERIFICATION, null, null);
        assertThatThrownBy(() -> service.vote(unverified, instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("EMAIL_NAO_CONFIRMADO");
        assertThatThrownBy(() -> service.vote(null, instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(401);
    }

    @Test
    void votoDuplicadoEmCorridaViraConflitoEnaoErro500() {
        battle();
        when(votes.existsByInstanceIdAndVoterUserId(instanceId, stranger)).thenReturn(false);
        when(votes.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq_ch_vote_voter"));
        assertThatThrownBy(() -> service.vote(user(stranger, "USER"), instanceId, photoId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    assertThat(((ApiException) e).status()).isEqualTo(409);
                    assertThat(((ApiException) e).code()).isEqualTo("JA_VOTOU");
                });

        when(votes.existsByInstanceIdAndVoterUserId(instanceId, stranger)).thenReturn(true);
        assertThatThrownBy(() -> service.vote(user(stranger, "USER"), instanceId, photoId))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("JA_VOTOU");
    }
}
