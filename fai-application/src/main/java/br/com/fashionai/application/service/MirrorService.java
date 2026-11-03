package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.TipoLookRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * RF33 — Smart Mirror e "Vista-me". O espelho é mais uma interface para iniciar o Criar Look (RF5), não uma
 * cópia dele: montagem manual por slots (§2.1), completude determinística sem IA, Vista-me com interpretação,
 * elegibilidade, validação anti-alucinação (CA09), localização no quarto (CA10), "Usar este look" que sempre
 * materializa um Esquema (§2.3) e entrega para o RF5 via RoomLookDraft (§2.4).
 * <p>
 * RF53 · P3-07 — o look no espelho traz os mesmos seis números do Copilot e do Autopiloto ({@link LookScorer}):
 * compatibilidade com o DNA, Hype, novidade, reutilização, uso comprovado e sustentabilidade, lado a lado e nunca somados.
 * <p>
 * Fachada (Facade) sobre os colaboradores por caso de uso, no mesmo pacote: {@link MirrorStore} (estado e acervo),
 * {@link MirrorStateView} (resposta do estado), {@link MirrorAssembly} (montagem manual), {@link MirrorSlotSuggestions}
 * (sugestão por slot e escolha do guarda-roupa), {@link MirrorVistaMe} com {@link MirrorInterpretation} e
 * {@link MirrorComposer}, {@link MirrorTakeOneOff}, {@link MirrorHandoff} (usar/salvar/RF5) e {@link MirrorStoryboard};
 * regras puras dos slots em {@link MirrorSlots}. Transação e contrato público ficam aqui.
 */
@Service
public class MirrorService {
    public static final List<String> SLOTS = List.of("upper", "lower", "dress", "shoes", "outer_layer", "accessory");
    public static final int MAX_ACCESSORIES = 4;
    public static final int MAX_SHOWN = 50;
    static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    /** Palavras-chave do Vista-me (pt, en, es) → ocasiões; também lidas pelo Autopiloto. */
    static final Map<String, List<String>> KEYWORDS = MirrorInterpretation.KEYWORDS;

    /** RF36.CA14 — desafios com conjunto de peças (10×10, Cápsula) restringem o Vista-me; implementado pelo ChallengeService. */
    public interface PieceRestrictionProvider {
        Optional<Restriction> restriction(UUID userId);

        record Restriction(String challengeName, Set<UUID> allowedPieceIds) {
        }
    }

    public record Interpretation(List<String> occasion, String mood, List<UUID> anchors, List<String> constraints, String season) {
    }

    private final MirrorStore store;
    private final MirrorStateView view;
    private final MirrorAssembly assembly;
    private final MirrorSlotSuggestions suggestions;
    private final MirrorVistaMe vistaMeFlow;
    private final MirrorTakeOneOff takeOneOff;
    private final MirrorHandoff handoff;
    private final MirrorStoryboard storyboard;

    public MirrorService(MirrorStateRepository mirrors, WardrobeItemRepository pieces, WardrobeService wardrobe, RoomService room,
                         SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                         DailyLookService dailyLooks, StyleDnaRepository dnas, ObjectProvider<PieceRestrictionProvider> restrictions,
                         AiEngine ai, Audit audit, ApplicationEventPublisher events, HypeQueryService hype,
                         TipoLookRepository tiposLook) {
        /* P3-07 — a mesma régua de looks do Copilot e do Autopiloto (só lê o Hype gravado; nada recalcula nem vira sinal). */
        LookScorer scorer = new LookScorer(pieces, schemes, schemeItems, dnas, hype);
        this.store = new MirrorStore(mirrors, pieces, wardrobe, room, restrictions);
        this.view = new MirrorStateView(store, mirrors, room, dnas, scorer);
        this.assembly = new MirrorAssembly(store, view, mirrors, wardrobe, room, events, tiposLook);
        this.suggestions = new MirrorSlotSuggestions(store, view, mirrors, room, ai, audit);
        this.vistaMeFlow = new MirrorVistaMe(store, view, new MirrorInterpretation(ai), new MirrorComposer(ai, audit), mirrors, room, events);
        this.takeOneOff = new MirrorTakeOneOff(store, view, assembly, room, ai, events);
        this.handoff = new MirrorHandoff(store, schemeService, schemes, schemeItems, dailyLooks, events);
        this.storyboard = new MirrorStoryboard(store, room, events);
    }

    // ================================================================== regras puras usadas fora do espelho
    public static String slotOf(WardrobeItem w) {
        return MirrorSlots.slotOf(w);
    }

    static boolean complete(Map<String, Object> slots) {
        return MirrorSlots.complete(slots);
    }

    static List<Map<String, Object>> missing(Map<String, Object> slots) {
        return MirrorSlots.missing(slots);
    }

    static Interpretation localInterpretation(String prompt, List<UUID> anchors) {
        return MirrorInterpretation.localInterpretation(prompt, anchors);
    }

    static List<WardrobeItem> localCompose(Interpretation it, List<WardrobeItem> eligible, Set<String> shown) {
        return MirrorComposer.localCompose(it, eligible, shown);
    }

    // ================================================================== estado e montagem manual (CA01/CA02/CA05)
    @Transactional
    public Map<String, Object> state(CurrentUser user) {
        return view.state(user);
    }

    @Transactional
    public Map<String, Object> updateTipoLook(CurrentUser user, UUID tipoLookId) {
        return assembly.updateTipoLook(user, tipoLookId);
    }

    @Transactional
    public Map<String, Object> place(CurrentUser user, UUID pieceId) {
        return assembly.place(user, pieceId);
    }

    /** Leva a peça ao espelho: entra na lista para provar (sem vestir). Repetir o pedido não duplica. */
    @Transactional
    public Map<String, Object> bring(CurrentUser user, UUID pieceId) {
        return assembly.bring(user, pieceId);
    }

    /** Tira a peça da lista do espelho (e do corpo, se estava vestida). A peça continua no guarda-roupa. */
    @Transactional
    public Map<String, Object> unbring(CurrentUser user, UUID pieceId) {
        return assembly.unbring(user, pieceId);
    }

    @Transactional
    public Map<String, Object> remove(CurrentUser user, UUID pieceId) {
        return assembly.remove(user, pieceId);
    }

    @Transactional
    public Map<String, Object> clear(CurrentUser user) {
        return assembly.clear(user);
    }

    /** Só peças disponíveis (RF31.CA02), dentro da estação (Penthouse) e permitidas pelo desafio ativo (RF36.CA14). */
    public List<WardrobeItem> eligible(UUID userId) {
        return store.eligible(userId);
    }

    // ================================================================== sugerir para um slot (CA04 / CA12) e escolher à mão
    @Transactional
    public Map<String, Object> suggest(CurrentUser user, String slot) {
        return suggestions.suggest(user, slot);
    }

    /** Todas as peças que podem ir para o slot, para a pessoa escolher à mão (WARDROBE-FIX): sem IA e sem custo. */
    @Transactional(readOnly = true)
    public Map<String, Object> wardrobe(CurrentUser user, String slot) {
        return suggestions.wardrobe(user, slot);
    }

    // ================================================================== Vista-me (CA08–CA15)
    @Transactional
    public Map<String, Object> vistaMe(CurrentUser user, String rawPrompt, List<UUID> anchorIds, UUID focusPieceId, boolean keepMirror) {
        return vistaMeFlow.vistaMe(user, rawPrompt, anchorIds, focusPieceId, keepMirror);
    }

    /** RF33.CA13 — outra sugestão para o mesmo pedido, sem repetir as já mostradas na sessão. */
    @Transactional
    public Map<String, Object> another(CurrentUser user) {
        return vistaMeFlow.another(user);
    }

    /** RF33.CA12 — "Trocar uma peça": até 3 alternativas para o slot, mantendo as demais. */
    @Transactional
    public Map<String, Object> swap(CurrentUser user, String slot) {
        return suggest(user, slot);
    }

    // ================================================================== "Tira uma coisa" (DET-M01)
    @Transactional
    public Map<String, Object> takeOneOff(CurrentUser user) {
        return takeOneOff.takeOneOff(user);
    }

    // ================================================================== usar / salvar / entregar ao RF5
    /** RF33.CA11 / §2.3 — "Usar este look": cria o esquema se necessário e registra o Look do Dia. */
    @Transactional
    public Map<String, Object> useLook(CurrentUser user) {
        return handoff.useLook(user);
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, String title, boolean publish) {
        return handoff.save(user, title, publish);
    }

    /** RF33.CA07 / §2.4 — payload RoomLookDraft para o Criar Look (sessionStorage 'sai_room_look_draft'). */
    @Transactional(readOnly = true)
    public Map<String, Object> draft(CurrentUser user, String originOverride) {
        return handoff.draft(user, originOverride);
    }

    /** DET-K02 — "Arrume-se Comigo": storyboard (≤ 15 s) das portas acendendo, peças indo ao espelho e o look pronto. */
    @Transactional
    public Map<String, Object> grwmStoryboard(CurrentUser user) {
        return storyboard.grwmStoryboard(user);
    }
}
