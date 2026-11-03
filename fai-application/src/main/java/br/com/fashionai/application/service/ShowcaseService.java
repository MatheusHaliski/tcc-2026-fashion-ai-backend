package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Vitrines 3D (cards Trello "Passarela 3D", "Eras da celebridade" e "Coleções da marca", e o botão "Gerar 3D" das
 * anatomias): monta o look de um esquema para o manequim (sexo do cadastro RF1, cabeça com a foto de perfil), a
 * passarela diária do Explorar com o Look do Dia de cada pessoa, e a busca/ranking de eras e coleções do RF22.
 * <p>
 * Tudo aqui é leitura de dados que já existem (esquemas, peças, agrupamentos, Look do Dia): a renderização 3D roda
 * no navegador (Three.js). Peças com modelo do RF16 pronto entram como GLB; as demais entram como a foto recortada
 * aplicada no manequim.
 * <p>
 * HypeScore v2 (RF53 · Lote 1 da auditoria de abas): rankings da Passarela, ordenação e insights de Eras/Coleções e o
 * look do My Stage leem o estado do job ({@code hype_scores}). Para terceiros só vale o Hype {@code publicEligible} e
 * disponível (sem Hype público = "—" e por último); o dono do perfil/look vê o Hype pessoal. "Em alta" é crescimento
 * (TREND/momento), nunca curtidas: popularidade aparece à parte. O {@code hypeScore} v1 das respostas fica DEPRECADO.
 */
@Service
public class ShowcaseService {
    /** Aba Eras (celebridade): eras, fases e turnês. Aba Coleções (marca): coleções. */
    static final Set<GroupingType> ERA_TYPES = EnumSet.of(GroupingType.ERA, GroupingType.PHASE, GroupingType.TOUR);
    static final Set<GroupingType> COLLECTION_TYPES = EnumSet.of(GroupingType.COLLECTION);
    /**
     * Pesos da pontuação de POPULARIDADE dos insights (curtidas e volume de itens, normalizados pelo maior valor do
     * perfil). O HypeScore não entra: popularidade ≠ Hype, e o Hype v2 (maior e médio, com faixa) aparece à parte.
     */
    static final double W_LIKES = 0.75, W_ITEMS = 0.25;
    static final int RUNWAY_MAX = 24;

    // Colaboradores por caso de uso (package-private, sem Spring): o serviço é a fachada transacional.
    final ShowcaseHype hypes;
    final ShowcaseMannequin mannequins;
    final ShowcaseLooks3d looks3d;
    final ShowcasePhotos photos;
    final ShowcaseRunway runwayFlow;
    final ShowcaseGroupings groupingsBase;
    final ShowcaseGroupingItems groupingItems;
    final ShowcaseInsights groupingInsights;
    final ShowcaseStage stageFlow;

    public ShowcaseService(FollowRepository follows, UserRepository users, MediaService media, SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                           SchemeGroupingRepository groupings, DailyLookRepository dailyLooks, DailyLookService dailyLookService,
                           UserPreferencesRepository preferences, CelebrityProfileRepository celebrities,
                           SchemeService schemeService, InstitutionalService institutional, Model3dService model3d, Guard guard,
                           Avatar3dService avatars3d, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.hypes = new ShowcaseHype(hypeScores, hypeConfig);
        this.mannequins = new ShowcaseMannequin(schemeItems, preferences, avatars3d, hypes, hypeConfig);
        this.looks3d = new ShowcaseLooks3d(schemes, schemeItems, pieces, schemeService, model3d, guard, mannequins);
        this.photos = new ShowcasePhotos(pieces, groupings, schemeService, guard, media);
        this.runwayFlow = new ShowcaseRunway(schemeItems, dailyLooks, dailyLookService, users, follows, schemeService, mannequins, hypes, hypeConfig);
        this.groupingsBase = new ShowcaseGroupings(institutional, groupings, schemes, pieces, schemeService, guard, hypes);
        this.groupingItems = new ShowcaseGroupingItems(groupingsBase, schemeItems, schemeService, hypes);
        this.groupingInsights = new ShowcaseInsights(groupingsBase, hypes, hypeConfig);
        this.stageFlow = new ShowcaseStage(groupingsBase, celebrities, mannequins, hypes);
    }

    /** Estado v2 de uma lista numa consulta (sem repositório = vazio: tudo neutro, nada vira 0). */
    Map<UUID, HypeScoreCurrent> hypeOf(HypeEntityType type, Collection<UUID> ids) {
        return hypes.of(type, ids);
    }

    // ================================================================== look no manequim ("Gerar 3D")

    @Transactional(readOnly = true)
    public Map<String, Object> look3d(CurrentUser viewer, UUID schemeId) {
        return looks3d.look3d(viewer, schemeId);
    }

    /** Uma peça sozinha no manequim (card de peça): o modelo do RF16 quando existe, senão a foto aplicada. */
    @Transactional(readOnly = true)
    public Map<String, Object> piece3d(CurrentUser viewer, UUID pieceId) {
        return looks3d.piece3d(viewer, pieceId);
    }

    /** Dono pede o RF16 para todas as peças do esquema que ainda não têm modelo 3D (cada uma vira um job). */
    @Transactional
    public Map<String, Object> requestModels(CurrentUser user, UUID schemeId) {
        return looks3d.requestModels(user, schemeId);
    }

    // ================================================================== Foto com meu manequim (RF4 · RF5)

    /** Só peça superior (inclui camadas externas) e de corpo inteiro: inferior, calçado e acessório não vestem sozinhos. */
    static final Set<String> MANNEQUIN_PHOTO_CATEGORIES = Set.of("upper_piece", "full_body_piece");

    @Transactional
    public Map<String, Object> pieceMannequinPhoto(CurrentUser user, UUID id, byte[] bytes) {
        return photos.pieceMannequinPhoto(user, id, bytes);
    }

    /** RF5 — o look inteiro (todas as peças do esquema) no manequim; opcionalmente vira a foto do post (capa). */
    @Transactional
    public Map<String, Object> schemeMannequinPhoto(CurrentUser user, UUID id, byte[] bytes, boolean asCover) {
        return photos.schemeMannequinPhoto(user, id, bytes, asCover);
    }

    @Transactional
    public void deleteMannequinPhoto(CurrentUser user, String kind, UUID id) {
        photos.deleteMannequinPhoto(user, kind, id);
    }

    /** Foto da era / arte da coleção (header da busca e vitrine da mini loja 3D): só o dono do agrupamento envia. */
    @Transactional
    public Map<String, Object> groupingCover(CurrentUser user, UUID id, byte[] bytes) {
        return photos.groupingCover(user, id, bytes);
    }

    // ================================================================== Passarela 3D (Explorar)

    /** Rankings da Passarela: o desfile mostra um lote por vez (nunca "todo mundo") e a tabela vai até o Top 100. */
    public static final List<String> RUNWAY_RANKINGS = List.of("TOP100_GLOBAL", "TOP100_REGIONAL", "TOP100_PAIS", "SEGUINDO", "EM_ALTA", "RECENTES");
    static final int RUNWAY_TOP = 100;

    public record RunwayFilter(String ranking, String region, String country, List<String> colors, List<String> occasions, List<String> styles,
                               String sex, Integer limit, Integer offset) {
        public static RunwayFilter of(Integer limit) {
            return new RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, limit, 0);
        }
    }

    /** Atributos de um Look do Dia usados nos filtros (país/região do dono, famílias de cor, ocasiões e estilos). */
    record RunwayEntry(DailyLook dl, String country, String region, Set<String> colors, Set<String> occasions, Set<String> styles, String sex) {
    }

    @Transactional
    public Map<String, Object> runway(CurrentUser viewer, Integer limit) {
        return runway(viewer, RunwayFilter.of(limit));
    }

    @Transactional
    public Map<String, Object> runway(CurrentUser viewer, RunwayFilter f) {
        return runwayFlow.runway(viewer, f);
    }

    // ================================================================== Eras (celebridade) e Coleções (marca) — RF22

    public enum Kind { ERAS, COLLECTIONS }

    public static Kind kind(String k) {
        String v = k == null ? "" : k.toUpperCase(Locale.ROOT);
        return switch (v) {
            case "ERAS" -> Kind.ERAS;
            case "COLLECTIONS", "COLECOES" -> Kind.COLLECTIONS;
            default -> throw ApiException.badRequest("ABA_INVALIDA", Msg.t("showcase.use_eras_ou_collections"));
        };
    }

    /** Lista de eras/coleções com contagem, capa (ou a capa do esquema mais hypado) e período. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String slug, Kind kind) {
        return groupingsBase.list(viewer, slug, kind);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> items(CurrentUser viewer, String slug, Kind kind, UUID groupingId, String q, String type,
                                     String sort, Integer year) {
        return groupingItems.items(viewer, slug, kind, groupingId, q, type, sort, year);
    }

    /** Ordenações da busca de Eras/Coleções (ordenação, nunca aba): HYPE (v2), GROWTH (em crescimento), CURTIDAS, RECENTES. */
    public static final List<String> SHOWCASE_SORTS = List.of("HYPE", "GROWTH", "CURTIDAS", "RECENTES");

    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer, String slug, Kind kind) {
        return groupingInsights.insights(viewer, slug, kind);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> stage(CurrentUser viewer, String slug, UUID schemeId) {
        return stageFlow.stage(viewer, slug, schemeId);
    }
}
