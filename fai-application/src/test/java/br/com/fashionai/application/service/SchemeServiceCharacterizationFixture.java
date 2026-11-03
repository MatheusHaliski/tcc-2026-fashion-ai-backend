package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

/**
 * Mundo fixo do {@link SchemeServiceCharacterizationTest}: ids {@code UUID(0x5CE, n)}, datas de 2025, duas pessoas com
 * acervo variado (cores, materiais, preços, fotos legíveis e ilegíveis), looks em todos os estados e origens, Hype v2
 * gravado para parte dos looks e das peças, e mocks com respostas determinísticas (guarda, mídia, selos, Look do Dia).
 */
final class SchemeServiceCharacterizationFixture {
    static final String PREFIX = "00000000-0000-05ce-";
    static final Instant T0 = Instant.parse("2025-03-01T12:00:00Z");
    /** categoria, subcategoria, cor, estilos, ocasiões, material, preço, sexo */
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear", "casual", "COTTON", "80.00", "UNISSEX"},
            {"upper_piece", "hoodie", "black", "streetwear", "casual,sport", "COTTON", "150.00", "UNISSEX"},
            {"upper_piece", "blazer", "navy", "classic,tailored", "trabalho", "WOOL", "420.00", "M"},
            {"lower_piece", "jeans", "blue", "basic,streetwear", "casual", "DENIM", "200.00", "UNISSEX"},
            {"lower_piece", "tailored_pants", "black", "classic", "trabalho", "WOOL", "310.00", "M"},
            {"shoes_piece", "casual_sneakers", "white", "streetwear", "casual", "LEATHER", "350.00", "UNISSEX"},
            {"shoes_piece", "oxford_shoes", "brown", "classic", "trabalho,formal", "LEATHER", "500.00", "M"},
            {"accessory_piece", "cap", "red", "streetwear", "casual", "COTTON", "60.00", "UNISSEX"},
            {"full_body_piece", "dress", "red", "glam,romantic", "party", "SILK", "640.00", "F"},
            {"accessory_piece", "belt", "brown", "classic", "trabalho", "LEATHER", null, "UNISSEX"},
    };

    final Kit kit = new Kit();
    final List<WardrobeItem> anaPieces = new ArrayList<>();
    final List<WardrobeItem> biaPieces = new ArrayList<>();
    final List<Scheme> anaLooks = new ArrayList<>();
    final List<Scheme> biaLooks = new ArrayList<>();
    User ana;
    User bia;
    User empty;
    SchemeService service;

    static UUID id(int n) {
        return new UUID(0x5CEL, n);
    }

    SchemeServiceCharacterizationFixture() {
        kit.with(HypeScoreConfig.defaults());
        stubGuard();
        stubMedia();
        when(kit.dep(SealService.class).suggest(any(), eq(id(1203)))).thenThrow(new IllegalStateException("fora do ar"));
        when(kit.dep(DailyLookService.class).register(any(), any(), any(), any(LocalDate.class)))
                .thenReturn(null).thenThrow(new ApiException(409, "JA_REGISTRADO", "já tem Look do Dia hoje"));
        ana = person("ana", 1000, anaPieces);
        bia = person("bia", 2000, biaPieces);
        empty = person("vazia", 3000, new ArrayList<>());
        looks(ana, anaPieces, 1200, anaLooks);
        looks(bia, biaPieces, 2200, biaLooks);
        hype(HypeEntityType.SCHEME, anaLooks.get(0).getId(), 76.4, 3.0, false);
        hype(HypeEntityType.SCHEME, anaLooks.get(1).getId(), 91.2, -1.0, true);
        hype(HypeEntityType.SCHEME, anaLooks.get(2).getId(), 41.0, 6.5, true);
        hype(HypeEntityType.SCHEME, biaLooks.get(0).getId(), 63.0, 2.0, true);
        hype(HypeEntityType.PIECE, anaPieces.get(0).getId(), 55.5, 1.0, false);
        hype(HypeEntityType.PIECE, anaPieces.get(3).getId(), null, null, false);
        StyleDna dna = new StyleDna();
        dna.setUser(ana);
        dna.setColorPalette("#000000,#ffffff");
        dna.setStyleKeywords("streetwear,casual");
        dna.setIdentityPhrase("Básico com atitude");
        kit.dep(StyleDnaRepository.class).save(dna);
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        service = kit.build(SchemeService.class);
    }

    /** Mocks cujas chamadas entram no retrato (efeitos colaterais do serviço). */
    List<Object> sideEffects() {
        return List.of(kit.dep(Audit.class), kit.dep(NotificationService.class), kit.dep(ApplicationEventPublisher.class),
                kit.dep(CounterStorePort.class), kit.dep(ProjectionService.class), kit.dep(SealService.class),
                kit.dep(DailyLookService.class), kit.dep(MediaService.class), kit.dep(Guard.class));
    }

    private void stubGuard() {
        Guard guard = kit.dep(Guard.class);
        when(guard.canView(any(), any(), any())).thenAnswer(i -> visible(i.getArgument(0), i.getArgument(1), i.getArgument(2)));
        doAnswer(i -> {
            if (!visible(i.getArgument(0), i.getArgument(1), i.getArgument(2))) {
                throw new ApiException(403, "SEM_ACESSO", "sem acesso a " + i.getArgument(3));
            }
            return null;
        }).when(guard).requireView(any(), any(), any(), anyString());
        doAnswer(i -> {
            CurrentUser u = i.getArgument(0);
            if (u == null || !u.id().equals(i.getArgument(1))) {
                throw new ApiException(403, "NAO_E_DONO", "não é dono de " + i.getArgument(2));
            }
            return null;
        }).when(guard).requireOwner(any(), any(), anyString());
    }

    private static boolean visible(CurrentUser viewer, UUID owner, Visibility v) {
        return v == Visibility.PUBLIC || (viewer != null && viewer.id().equals(owner));
    }

    private void stubMedia() {
        MediaService media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, i.getArgument(2)));
        when(media.readImage(anyString())).thenAnswer(i -> String.valueOf((Object) i.getArgument(0)).contains("foto")
                ? Optional.of(swatch(new Color(0x3366AA), 240, 300)) : Optional.empty());
        when(media.read(anyString())).thenAnswer(i -> String.valueOf((Object) i.getArgument(0)).contains("foto")
                ? Optional.of(jpeg(swatch(Color.ORANGE, 64, 64))) : Optional.empty());
        when(media.retire(any(), any(), any(), any())).thenReturn(1);
    }

    private User person(String name, int base, List<WardrobeItem> into) {
        User u = Kit.user(name);
        u.assignId(id(base));
        u.markCreatedAt(T0);
        u.setProfileVisibility(Visibility.PUBLIC);
        kit.dep(UserRepository.class).save(u);
        if (name.equals("vazia")) {
            return u;
        }
        for (int i = 0; i < WARDROBE.length; i++) {
            String[] p = WARDROBE[i];
            WardrobeItem w = Kit.piece(u, p[1].replace('_', ' ') + " " + name, p[0], p[1], p[2]);
            w.assignId(id(base + 100 + i));
            w.markCreatedAt(T0.plusSeconds(60L * i));
            w.setStyleTags(p[3]);
            w.setOccasionTags(p[4]);
            w.setMaterial(p[5]);
            w.setPrice(p[6] == null ? null : new BigDecimal(p[6]));
            w.setSex(p[7]);
            w.setImageUrl(i % 3 == 0 ? "/media/foto-" + name + "-" + i + ".png" : "/media/padrao-" + i + ".svg");
            w.setThumbnailUrl(i % 3 == 0 ? "/media/foto-" + name + "-" + i + "-thumb.png" : null);
            w.setDefaultImage(i % 3 != 0);
            w.setFavorite(i % 4 == 0);
            w.setWearCount(i * 2);
            w.setLastWornDate(LocalDate.of(2025, 2, 1 + i));
            w.setSizeLabel(i % 2 == 0 ? "M" : "42");
            w.setCondition(i % 5 == 0 ? ItemCondition.NEW : ItemCondition.GOOD);
            w.setTags("fav,peca" + i);
            w.setNotes(i == 1 ? "Comprei <b>na feira</b> de Recife" : null);
            w.setFlatLayMetadataJson(i == 0 ? "{\"pattern\":\"liso\",\"texture\":\"malha\",\"colors\":[\"white\"],\"nested\":{\"x\":1}}" : null);
            into.add(kit.dep(WardrobeItemRepository.class).save(w));
        }
        return u;
    }

    private void looks(User u, List<WardrobeItem> ws, int base, List<Scheme> into) {
        int[][] pieces = {{0, 3, 5}, {2, 4, 6, 9}, {8, 6}, {1, 3, 5, 7}, {0, 4}};
        SchemeStatus[] status = {SchemeStatus.PUBLISHED, SchemeStatus.PUBLISHED, SchemeStatus.DRAFT, SchemeStatus.PUBLISHED, SchemeStatus.ARCHIVED};
        SchemeOrigin[] origin = {SchemeOrigin.CRIAR_LOOK, SchemeOrigin.COPILOT, SchemeOrigin.CRIAR_LOOK, SchemeOrigin.REMIX, SchemeOrigin.AUTOPILOTO};
        for (int i = 0; i < pieces.length; i++) {
            Scheme s = Kit.look(u, "Look " + (i + 1) + " de " + u.getUsername());
            s.assignId(id(base + i));
            s.markCreatedAt(T0.plusSeconds(86_400L * (10 - i)));
            s.setStatus(status[i]);
            s.setOrigin(origin[i]);
            s.setCreationMode(i == 2 ? CreationMode.AI_ASSISTED : CreationMode.MANUAL);
            s.setOccasion(i % 2 == 0 ? "casual" : "trabalho,casual");
            s.setStyle(i % 2 == 0 ? "streetwear" : "classic");
            s.setFavorite(i == 1);
            s.setDisponivel(i != 3);
            s.setVisibility(i == 3 ? Visibility.FOLLOWERS : Visibility.PUBLIC);
            s.setTotalPrice(new BigDecimal(100 * (i + 1) + ".50"));
            s.setSealIdsJson(i == 0 ? "[\"selo-a\",\"selo-b\"]" : null);
            s.setStudioConfigJson(i == 1 ? "{\"pieces\":{\"" + ws.get(2).getId() + "\":{\"color\":\"#AA3366\"}}}" : null);
            kit.dep(SchemeRepository.class).save(s);
            for (int j = 0; j < pieces[i].length; j++) {
                WardrobeItem w = ws.get(pieces[i][j]);
                var si = Kit.slot(s, w, br.com.fashionai.application.ai.local.LocalSchemeComposer.slotOf(w), j);
                si.assignId(id(base + 50 + i * 10 + j));
                si.setZIndex(j);
                if (j == 0) {
                    si.setPositionX(new BigDecimal("0.35"));
                    si.setPositionY(new BigDecimal("0.30"));
                    si.setRotation(new BigDecimal("-6"));
                    si.setFiltersJson("{\"brightness\":1.2,\"saturation\":0.8}");
                }
                kit.dep(SchemeItemRepository.class).save(si);
            }
            into.add(s);
        }
    }

    private void hype(HypeEntityType type, UUID entity, Double score, Double delta, boolean publicEligible) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setEntityType(type);
        h.setEntityId(entity);
        h.setAlgorithmVersion(HypeScoreConfig.defaults().algorithmVersion());
        h.setStatus(score == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        h.setScore(score == null ? null : BigDecimal.valueOf(score));
        h.setLevel(score == null || score > 90 ? null : HypeScoreConfig.defaults().level(score));
        h.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
        HypeDimensions d = new HypeDimensions();
        h.setDimensions(d);
        h.setPublicEligible(publicEligible);
        h.setCalculatedAt(T0);
        kit.dep(HypeScoreCurrentRepository.class).save(h);
    }

    static BufferedImage swatch(Color c, int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillOval(w / 8, h / 8, w * 3 / 4, h * 3 / 4);
        g.setColor(Color.WHITE);
        g.fillRect(w / 3, h / 3, w / 6, h / 6);
        g.dispose();
        return img;
    }

    static byte[] jpeg(BufferedImage src) {
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            javax.imageio.ImageIO.write(rgb, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
