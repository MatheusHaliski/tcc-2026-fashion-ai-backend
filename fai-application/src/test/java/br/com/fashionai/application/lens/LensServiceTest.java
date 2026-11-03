package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.lang.reflect.Constructor;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

/**
 * RF54 · FashionAI Lens (serviço): scan do dono (outra pessoa = 404 em toda rota), "Ver no Lens" respeitando a
 * visibilidade, NO_FASHION_FOUND, cota, borrão de rostos, origem/intenção e nenhum sinal de Hype. Correções, retenção
 * e camada viva (comunidade, Hype do grupo, Recriar) estão nos testes irmãos sobre {@link LensServiceFixture}.
 */
class LensServiceTest extends LensServiceFixture {
    @Test
    void scanGravaImagemPrivadaSemMetadadosEPecasEmOrdemDeLeitura() {
        LensViews.ScanView v = scan();
        assertThat(v.status()).isEqualTo("READY");
        assertThat(v.errorCode()).isNull();
        assertThat(v.source()).isEqualTo("CAMERA");
        assertThat(v.aiSource()).isEqualTo("ia");
        assertThat(v.algorithmVersion()).isEqualTo("LENS_V1");
        assertThat(v.facesRedacted()).isEqualTo(1);
        assertThat(v.expiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));
        assertThat(v.savedAt()).isNull();
        assertThat(v.detections()).extracting(LensViews.DetectionView::label).containsExactly("Jaqueta jeans", "Calça preta");
        LensViews.DetectionView jacket = v.detections().get(0);
        assertThat(jacket.box()).isEqualTo(new LensViews.Box(10, 10, 50, 40));
        assertThat(jacket.colors().get(0).name()).isEqualTo("denim");
        assertThat(jacket.confidenceBand()).isEqualTo("HIGH");
        assertThat(v.detections().get(1).confidenceBand()).isEqualTo("MEDIUM");
        assertThat(jacket.pattern()).isNotNull();
        assertThat(jacket.topMatch()).isNull();                                     // guarda-roupa vazio: nunca 0%
        assertThat(v.reading().trend().status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(v.reading().impact().gaps()).isEqualTo(2);
        // só em restricted/, regravada como JPEG sem EXIF (o JPEG gerado aqui não tem APP1)
        assertThat(blobs.keySet()).allMatch(k -> k.startsWith("restricted/users/" + me.getId() + "/lens/" + v.id()));
        byte[] stored = lens.image(meUser, v.id(), false);
        assertThat(new String(stored, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("Exif");
        assertThat(lens.image(meUser, v.id(), true).length).isLessThan(stored.length);
    }

    @Test
    void outraPessoaRecebe404EmTodaRota() {
        UUID id = scan().id();
        UUID did = detectionRows.values().iterator().next().getId();
        List<Executable> routes = List.of(
                () -> lens.get(otherUser, id),
                () -> lens.image(otherUser, id, false),
                () -> lens.matches(otherUser, id, did, "MY_CLOSET"),
                () -> lens.reading(otherUser, id, null),
                () -> lens.recreate(otherUser, id, new LensService.RecreateCommand("SAFE", null, null)),
                () -> lens.setSaved(otherUser, id, true),
                () -> lens.delete(otherUser, id),
                () -> lens.correct(otherUser, id, did, new LensService.CorrectionCommand("lower_piece", null, null, null, null, null, null)),
                () -> lens.add(otherUser, id, new LensService.AddDetectionCommand(new LensService.BoxInput(1.0, 1.0, 20.0, 20.0), "shoes_piece", null, null)),
                () -> lens.want(otherUser, id, did, true),
                () -> lens.own(otherUser, id, did, null));
        for (Executable route : routes) {
            assertEquals(404, status(route));
        }
        assertThat(scanRows).containsKey(id);                                      // nada mudou
        assertThat(detectionRows.values()).allMatch(d -> d.getWantedAt() == null && d.getDismissedAt() == null);
        assertThat(lens.history(otherUser, null, null, 0, 12).items()).isEmpty();
    }

    @Test
    void semPecasNaFotoNoFashionFoundEPessoaPodeMarcarUma() {
        nextPieces = List.of();
        LensViews.ScanView v = scan();
        assertThat(v.status()).isEqualTo("NO_FASHION_FOUND");
        assertThat(v.errorCode()).isEqualTo("NO_FASHION_FOUND");
        assertThat(v.detections()).isEmpty();
        LensViews.DetectionView added = lens.add(meUser, v.id(), new LensService.AddDetectionCommand(
                new LensService.BoxInput(10.0, 60.0, 30.0, 30.0), null, "casual_sneakers", "white"));
        assertThat(added.status()).isEqualTo("ADDED_BY_USER");
        assertThat(added.category()).isEqualTo("shoes_piece");
        assertThat(added.colors().get(0).name()).isEqualTo("white");
        assertThat(lens.get(meUser, v.id()).status()).isEqualTo("READY");
        assertThat(feedbackRows.values()).extracting(LensFeedback::getKind).containsExactly(LensFeedbackKind.MISSING_PIECE);
        assertEquals("CAIXA_INVALIDA", code(() -> lens.add(meUser, v.id(), new LensService.AddDetectionCommand(
                new LensService.BoxInput(99.0, 99.0, 30.0, 30.0), "shoes_piece", null, null))));
    }

    @Test
    void leituraLocalSemConsentimentoAvisaOMotivo() {
        nextSource = "local";
        nextResult = AiCallResult.CONSENT_DENIED;
        nextPieces = List.of(MultiPieceService.localPiece());
        LensViews.ScanView v = scan();
        assertThat(v.aiSource()).isEqualTo("local");
        assertThat(v.errorCode()).isEqualTo("CONSENT_REQUIRED");
        assertThat(v.detections()).hasSize(1);
        assertThat(v.detections().get(0).colors()).isNotEmpty();                  // cores medidas localmente
        assertThat(v.detections().get(0).confidenceBand()).isEqualTo("LOW");
    }

    @Test
    void verNoLensRespeitaAVisibilidade() {
        WardrobeItem privateOfOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        blobs.put("users/" + other.getId() + "/p.jpg", photo());
        privateOfOther.setImageUrl("http://x/media/users/" + other.getId() + "/p.jpg");
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", privateOfOther.getId()))));
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", UUID.randomUUID()))));

        WardrobeItem pending = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        pending.setModerationStatus(ModerationStatus.PENDING);
        pending.setImageUrl(privateOfOther.getImageUrl());
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", pending.getId()))));

        Scheme privateLook = new Scheme();
        privateLook.assignId(UUID.randomUUID());
        privateLook.setUser(other);
        privateLook.setVisibility(Visibility.PRIVATE);
        privateLook.setStatus(SchemeStatus.PUBLISHED);
        privateLook.setCoverImageUrl(privateOfOther.getImageUrl());
        schemeRows.put(privateLook.getId(), privateLook);
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("LOOK", privateLook.getId()))));
        assertThat(scanRows).isEmpty();

        WardrobeItem publicPiece = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        publicPiece.setImageUrl(privateOfOther.getImageUrl());
        LensViews.ScanView v = lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", publicPiece.getId()));
        assertThat(v.source()).isEqualTo("IN_APP_PIECE");
        assertThat(scanRows.get(v.id()).getSourceRefId()).isEqualTo(publicPiece.getId());
        assertThat(scanRows.get(v.id()).getUserId()).isEqualTo(me.getId());       // o scan é de quem pediu
        // a própria peça privada pode ser escaneada pelo dono
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        mine.setImageUrl(privateOfOther.getImageUrl());
        assertThat(lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", mine.getId())).source()).isEqualTo("IN_APP_PIECE");
        // peça sem foto legível (ilustração padrão): 422
        WardrobeItem illustrated = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        illustrated.setDefaultImage(true);
        assertEquals("LENS_SEM_IMAGEM", code(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", illustrated.getId()))));
    }

    @Test
    void cotaDiariaDe30ScansNaoGravaNada() {
        quota.put(me.getId() + LensService.QUOTA_BUCKET, 30);
        ApiException ex = assertThrows(ApiException.class, this::scan);
        assertThat(ex.status()).isEqualTo(429);
        assertThat(ex.code()).isEqualTo("QUOTA");
        assertThat(ex.details()).containsKeys("resetAt", "limit");
        assertThat(scanRows).isEmpty();
        assertThat(blobs).isEmpty();
    }

    @Test
    void semConfirmacaoDoBorraoAFotoNaoVaiParaAIaExterna() {
        for (Boolean confirmed : Arrays.asList(null, false)) {
            LensViews.ScanView v = lens.create(meUser, new LensService.CreateCommand("UPLOAD", "IDENTIFY", null, confirmed), photo());
            assertThat(v.aiSource()).isEqualTo("local");
            assertThat(v.detections()).hasSize(1);
            assertThat(scanRows.get(v.id()).isRedactionConfirmed()).isFalse();
        }
        verify(multiPiece, never()).detectPieces(any(), any());
        assertThat(scan().aiSource()).isEqualTo("ia");
        verify(multiPiece).detectPieces(any(), any());
    }

    @Test
    void origemEIntencaoValidadas() {
        assertEquals("ORIGEM_INVALIDA", code(() -> lens.create(meUser, new LensService.CreateCommand("IN_APP_PIECE", null, 0, false), photo())));
        assertEquals("VALOR_INVALIDO", code(() -> lens.create(meUser, new LensService.CreateCommand("FAX", null, 0, false), photo())));
        assertEquals("VALOR_INVALIDO", code(() -> lens.create(meUser, new LensService.CreateCommand("UPLOAD", "BUY", 0, false), photo())));
        assertThat(lens.create(meUser, new LensService.CreateCommand(null, "RECREATE", null, null), photo()).intent()).isEqualTo("RECREATE");
    }

    /**
     * O Lens nunca gera Hype: o serviço não recebe publicador de eventos nem nada que escreva em hype_signal_daily, e do
     * WardrobeService só usa o estado de quem vê (o detalhe da peça, que registra visualização, nunca é chamado).
     */
    @Test
    void lensNuncaEscreveSinalDeHype() {
        Set<String> deps = Arrays.stream(LensService.class.getConstructors()).map(Constructor::getParameterTypes)
                .flatMap(Arrays::stream).map(Class::getSimpleName).collect(Collectors.toSet());
        assertThat(deps).doesNotContain("ApplicationEventPublisher", "HypeSignalRecorder", "HypeSignalDailyRepository",
                "HypeSnapshotService", "HypeLiveRecalc", "DomainEventPublisherPort");
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        publicHype(piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC), 70);
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(0).id();
        lens.get(meUser, v.id());
        lens.matches(meUser, v.id(), did, "MY_CLOSET");
        lens.matches(meUser, v.id(), did, "COMMUNITY");
        lens.reading(meUser, v.id(), did);
        lens.recreate(meUser, v.id(), new LensService.RecreateCommand("DISCOVERY", did, null));
        lens.own(meUser, v.id(), did, mine.getId());
        verify(wardrobe, atLeast(1)).viewerState(any(), any());
        verifyNoMoreInteractions(wardrobe);
    }
}
