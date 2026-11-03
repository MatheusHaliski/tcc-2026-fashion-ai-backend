package br.com.fashionai.application.lens;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.repository.GarmentEmbeddingRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensFeedbackRepository;
import br.com.fashionai.domain.repository.LensScanRepository;
import br.com.fashionai.domain.repository.PieceImageRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF54 · FashionAI Lens (docs/novos-rf/RF54_FashionAI_Lens.md). Transforma uma foto de moda numa decisão de estilo
 * pessoal: lê as peças ({@link MultiPieceService#detectPieces}, o mesmo núcleo do cadastro de várias peças, pelo
 * {@code AiEngine} — consentimento, cota, orçamento e fallback local), e liga cada uma ao guarda-roupa, ao DNA, ao Hype
 * do grupo e ao plano "Recriar".
 * <ul>
 *   <li><b>Privado:</b> todo scan é do dono; qualquer outra pessoa recebe 404 (nunca 403, não revela que existe). A
 *       imagem fica em {@code restricted/users/{id}/lens/…}, regravada em JPEG sem metadados, e só sai por
 *       {@link #image}.</li>
 *   <li><b>Camada viva calculada na leitura:</b> correspondências, compatibilidade, Hype do grupo e plano são
 *       recalculados a cada pedido (refletem o guarda-roupa, o DNA e o Hype de agora). Nada disso é gravado.</li>
 *   <li><b>Nunca gera Hype:</b> este serviço não publica eventos nem escreve em {@code hype_signal_daily}; só lê
 *       {@code hype_scores} públicos.</li>
 *   <li><b>Retenção:</b> sem salvar como inspiração, o scan expira em 30 dias ({@link #purgeExpired}); excluir a conta
 *       apaga tudo ({@link #deleteAllFor}).</li>
 * </ul>
 * Fachada (Facade) sobre colaboradores package-private por caso de uso: entrada e gravação do scan
 * ({@link LensScanIntake}, {@link LensScanRecorder}), acesso do dono ({@link LensScanAccess}), visões e correspondências
 * ({@link LensViewAssembler}, {@link LensMatcher}, {@link LensHistory}), correções ({@link LensCorrections}),
 * "Quero"/"Eu tenho" ({@link LensOwnership}), plano Recriar ({@link LensRecreatePlanner}) e retenção
 * ({@link LensRetention}). Transações, o dono do scan e a permissão de criar continuam aqui.
 */
@Service
public class LensService {
    static final String QUOTA_BUCKET = "lens:scan";

    private final Guard guard;
    private final LensRequestContext.Sources live;
    private final LensScanAccess access;
    private final LensMatcher matcher;
    private final LensViewAssembler views;
    private final LensScanIntake intake;
    private final LensHistory historyReads;
    private final LensCorrections corrections;
    private final LensOwnership ownership;
    private final LensRecreatePlanner planner;
    private final LensRetention retention;

    public LensService(LensScanRepository scans, LensDetectionRepository detections, LensFeedbackRepository feedback,
                       WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                       StyleDnaRepository dnas, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig,
                       GarmentEmbeddingRepository embeddings, PieceImageRepository pieceImages,
                       UserConsentRepository consents, MultiPieceService multiPiece, MediaStoragePort storage,
                       MediaService media, RateLimitPort rateLimit, WardrobeService wardrobe, Guard guard, LensConfig config) {
        this.guard = guard;
        this.live = new LensRequestContext.Sources(pieces, schemes, schemeItems, dnas, hypeScores, hypeConfig, embeddings,
                pieceImages, guard);
        this.access = new LensScanAccess(scans, detections, storage);
        this.matcher = new LensMatcher(config, wardrobe);
        this.views = new LensViewAssembler(matcher, hypeConfig);
        LensScanRecorder recorder = new LensScanRecorder(scans, detections, multiPiece, storage, rateLimit, config, views, live);
        this.intake = new LensScanIntake(pieces, schemes, media, guard, recorder);
        this.historyReads = new LensHistory(scans, detections, matcher, live);
        this.corrections = new LensCorrections(scans, detections, storage, new LensFeedbackLog(feedback, consents), views, live);
        this.ownership = new LensOwnership(detections, pieces, views, live);
        this.planner = new LensRecreatePlanner(access, matcher, hypeScores, hypeConfig, live);
        this.retention = new LensRetention(scans, detections, feedback, storage, config);
    }

    // ================================================================== comandos

    /** Partes do multipart do {@code POST /api/lens/scans}. */
    public record CreateCommand(String source, String intent, Integer facesRedacted, Boolean redactionConfirmed) {
    }

    public record FromAppCommand(String type, UUID id) {
    }

    public record BoxInput(Double x, Double y, Double w, Double h) {
    }

    public record AddDetectionCommand(BoxInput box, String category, String subcategory, String color) {
    }

    public record CorrectionCommand(String category, String subcategory, String color, String material, String pattern,
                                    List<String> styles, Boolean dismissed) {
    }

    public record RecreateCommand(String mode, UUID focus, Map<String, String> locked) {
    }

    // ================================================================== criar

    /**
     * Scan de uma foto enviada (câmera, galeria ou arquivo). A foto já chega com os rostos borrados no aparelho e passou
     * pela moderação do upload ({@code UploadSafetyInterceptor}); aqui é orientada (EXIF), reduzida a 2048 px e regravada
     * sem metadados antes de ser lida e guardada. Síncrono no MVP: devolve o scan pronto.
     */
    @Transactional
    public LensViews.ScanView create(CurrentUser user, CreateCommand cmd, byte[] bytes) {
        guard.requireCanCreate(user);
        return intake.create(user, cmd, bytes);
    }

    /**
     * "Ver no Lens": scan da foto de uma peça ou look do app — só se quem pede pode ver o original (dono, ou visibilidade
     * efetiva e moderação aprovada, sem bloqueio). Qualquer outro caso é 404, sem revelar que existe. Nada é registrado
     * como visualização (o Lens nunca gera sinal de Hype).
     */
    @Transactional
    public LensViews.ScanView fromApp(CurrentUser user, FromAppCommand cmd) {
        guard.requireCanCreate(user);
        return intake.fromApp(user, cmd);
    }

    // ================================================================== ler

    @Transactional(readOnly = true)
    public LensViews.ScanView get(CurrentUser user, UUID id) {
        LensScan scan = access.owned(user, id);
        return views.view(live.open(user), scan, access.all(scan));
    }

    /** Imagem gravada (sem EXIF/GPS, rostos já borrados no aparelho): só para o dono. {@code thumb} = miniatura. */
    @Transactional(readOnly = true)
    public byte[] image(CurrentUser user, UUID id, boolean thumb) {
        return access.image(access.owned(user, id), thumb);
    }

    /** Histórico e inspirações: {@code saved} filtra salvos/não salvos; {@code wanted} só scans com alguma peça "Quero". */
    @Transactional(readOnly = true)
    public Views.Page<LensViews.ScanCard> history(CurrentUser user, Boolean saved, Boolean wanted, int page, int size) {
        return historyReads.history(user, saved, wanted, page, size);
    }

    /**
     * Correspondências de uma peça no escopo: MY_CLOSET (peças próprias, piso 55) ou COMMUNITY (só peças públicas e
     * elegíveis de outras pessoas, piso 65). Top 12, ordenado só pela semelhança. Sem {@code detection}, junta as peças
     * do look (cada alvo com a melhor semelhança).
     */
    @Transactional(readOnly = true)
    public LensViews.Matches matches(CurrentUser user, UUID id, UUID detectionId, String scopeRaw) {
        LensScan scan = access.owned(user, id);
        LensSimilarity.Scope scope = LensInputs.parseEnum(LensSimilarity.Scope.class, scopeRaw, LensSimilarity.Scope.MY_CLOSET, "scope");
        return matcher.matches(user, live.open(user), scope, access.targets(scan, detectionId));
    }

    /** Leitura do look inteiro (sem {@code detection}) ou de uma peça: estilo, paleta, DNA, Hype do grupo e impacto. */
    @Transactional(readOnly = true)
    public LensViews.ReadingView reading(CurrentUser user, UUID id, UUID detectionId) {
        LensScan scan = access.owned(user, id);
        return views.reading(live.open(user), access.targets(scan, detectionId));
    }

    // ================================================================== agir

    @Transactional
    public LensViews.ScanView setSaved(CurrentUser user, UUID id, Boolean saved) {
        LensScan scan = access.owned(user, id);
        retention.setSaved(scan, saved);
        return views.view(live.open(user), scan, access.all(scan));
    }

    /** Apaga o scan inteiro: imagem, miniatura, peças detectadas e correções. */
    @Transactional
    public void delete(CurrentUser user, UUID id) {
        retention.purge(access.owned(user, id));
    }

    /**
     * Correção de atributos (chips) ou "não é roupa" ({@code dismissed}). Grava o antes/depois em {@code lens_feedback},
     * marca a peça como corrigida e devolve a peça com a correspondência recalculada na hora.
     */
    @Transactional
    public LensViews.DetectionView correct(CurrentUser user, UUID id, UUID detectionId, CorrectionCommand cmd) {
        LensScan scan = access.owned(user, id);
        return corrections.correct(user, scan, access.ownedDetection(scan, detectionId), cmd);
    }

    /** A pessoa marca uma peça que o detector não viu: caixa em % + categoria (status ADDED_BY_USER). */
    @Transactional
    public LensViews.DetectionView add(CurrentUser user, UUID id, AddDetectionCommand cmd) {
        return corrections.add(user, access.owned(user, id), cmd);
    }

    /** "Quero": marca/desmarca a peça na lista de desejos das inspirações. */
    @Transactional
    public LensViews.DetectionView want(CurrentUser user, UUID id, UUID detectionId, Boolean wanted) {
        LensScan scan = access.owned(user, id);
        return ownership.want(user, access.ownedDetection(scan, detectionId), wanted);
    }

    /**
     * "Eu tenho": com {@code itemId}, liga a peça detectada a uma peça do próprio guarda-roupa (outra pessoa ou peça
     * arquivada = 404); sem, devolve o link do cadastro pré-preenchido. A foto da peça nunca é o recorte desta imagem.
     */
    @Transactional
    public LensViews.OwnResult own(CurrentUser user, UUID id, UUID detectionId, UUID itemId) {
        LensScan scan = access.owned(user, id);
        return ownership.own(user, scan, access.ownedDetection(scan, detectionId), itemId);
    }

    // ================================================================== recriar

    /**
     * Plano "Recriar" com as peças da pessoa: um slot por peça detectada (topo, base, peça única, calçado, acessório).
     * Cada slot é {@code own} (peça sua parecida da mesma subcategoria), {@code alternative} (peça sua parecida de outra
     * subcategoria) ou {@code gap} (lacuna, com as próprias mais próximas como alternativas). O modo pesa a escolha pelo
     * {@code RecommendationScoring}; slots fixados ({@code locked}) não mudam. Os seis números são os mesmos do Copilot.
     */
    @Transactional(readOnly = true)
    public LensViews.RecreatePlan recreate(CurrentUser user, UUID id, RecreateCommand cmd) {
        return planner.recreate(user, access.owned(user, id), cmd);
    }

    // ================================================================== retenção e conta

    /** Job diário (LensRetentionJob): scans não salvos vencidos somem com imagem, peças e correções. */
    @Transactional
    public int purgeExpired(Instant now) {
        return retention.purgeExpired(now);
    }

    /** Exclusão da conta: todos os scans da pessoa (salvos ou não), sem usuário logado. */
    @Transactional
    public void deleteAllFor(UUID userId) {
        retention.deleteAllFor(userId);
    }
}
