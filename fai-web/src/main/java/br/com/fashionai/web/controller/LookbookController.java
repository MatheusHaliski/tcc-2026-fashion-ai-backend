package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DailyLookService;
import br.com.fashionai.application.service.HypeScoreService;
import br.com.fashionai.application.service.LookbookService;
import br.com.fashionai.application.service.ProfileService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF6 — Lookbook, Look do Dia e HypeScore (painel em v2; agrupamentos por similaridade)")
public class LookbookController {
    private final LookbookService lookbook;
    private final DailyLookService dailyLooks;
    private final HypeScoreService hype;

    private final br.com.fashionai.application.hype.HypeScoreConfig hypeV2;
    private final ProfileService profiles;

    public LookbookController(LookbookService lookbook, DailyLookService dailyLooks, HypeScoreService hype,
                              br.com.fashionai.application.hype.HypeScoreConfig hypeV2, ProfileService profiles) {
        this.hypeV2 = hypeV2;
        this.profiles = profiles;
        this.lookbook = lookbook;
        this.dailyLooks = dailyLooks;
        this.hype = hype;
    }

    @GetMapping("/api/users/{ownerId}/lookbook")
    @Operation(summary = "RF6 — Visão geral do lookbook (closet digital, looks, agrupamentos)")
    public Map<String, Object> overview(CurrentUser viewer, @PathVariable UUID ownerId) {
        return lookbook.overview(viewer, ownerId);
    }

    @GetMapping("/api/users/{ownerId}/publications")
    @Operation(summary = "RF6/RF53 — Publicações do Lookbook: looks publicados e peças visíveis, em ordem cronológica")
    public Views.Page<Map<String, Object>> publications(CurrentUser viewer, @PathVariable UUID ownerId,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "24") int size) {
        return lookbook.publications(viewer, ownerId, page, size);
    }

    @GetMapping("/api/users/{ownerId}/favorites")
    @Operation(summary = "RF6/RF53 — Favoritos do Lookbook: peças e looks marcados como favoritos, visíveis para quem vê")
    public Map<String, Object> favorites(CurrentUser viewer, @PathVariable UUID ownerId) {
        return lookbook.favorites(viewer, ownerId);
    }

    @GetMapping("/api/me/saved-pieces")
    @Operation(summary = "RF6 — Peças salvas (aba própria, separada dos looks salvos)")
    public Views.Page<Map<String, Object>> savedPieces(CurrentUser user, @RequestParam(required = false) String category,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "24") int size) {
        return lookbook.savedPieces(user, category, page, size);
    }

    @GetMapping("/api/me/saved-looks")
    @Operation(summary = "RF6.CA03 — Looks salvos (filtro por ocasião; sort = recent | hype_desc | hype_asc | growth pelo HypeScore v2)")
    public Views.Page<Map<String, Object>> savedLooks(CurrentUser user, @RequestParam(required = false) String occasion,
                                                     @RequestParam(required = false) String sort,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return lookbook.savedLooks(user, occasion, sort, page, size);
    }

    /**
     * Lookbook › Looks com ordenação (P3-02): a MESMA resposta de {@code GET /api/profiles/{idOrUsername}}
     * (ProfileController), só que com {@code sort} (recent | hype_desc | hype_asc | growth pelo HypeScore v2; terceiros
     * só ordenam pelo Hype público elegível). O Spring escolhe este método quando a requisição traz {@code sort} — a
     * condição de parâmetro é mais específica —, então a rota sem {@code sort} continua no ProfileController. Fica aqui
     * porque o ProfileController está fora do Lote 4; ao mexer nele, mover para lá como parâmetro opcional.
     */
    @GetMapping(value = "/api/profiles/{idOrUsername}", params = "sort")
    @Operation(summary = "RF6/RF17 — Perfil com a grade de looks ordenada (sort pelo HypeScore v2)")
    public Map<String, Object> profileLooks(CurrentUser viewer, @PathVariable String idOrUsername, @RequestParam String sort) {
        return profiles.profile(viewer, idOrUsername, sort);
    }

    public record FavoriteRequest(boolean favorite) {
    }

    @PutMapping("/api/me/saved-looks/{schemeId}/favorite")
    @Operation(summary = "RF6 — Favoritar look salvo")
    public Map<String, Object> favorite(CurrentUser user, @PathVariable UUID schemeId, @RequestBody FavoriteRequest body) {
        return lookbook.favorite(user, schemeId, body.favorite());
    }

    @DeleteMapping("/api/me/saved-looks/{schemeId}")
    @Operation(summary = "RF6 — Remover dos salvos")
    public Map<String, Object> removeSaved(CurrentUser user, @PathVariable UUID schemeId) {
        return lookbook.removeSaved(user, schemeId);
    }

    @GetMapping("/api/me/daily-look-tab")
    @Operation(summary = "RF6 — Aba Look do Dia com painel de Hype Score")
    public Map<String, Object> dailyLookTab(CurrentUser user, @RequestParam(defaultValue = "false") boolean withAi) {
        return lookbook.dailyLookTab(user, withAi);
    }

    @GetMapping("/api/hype/panel-versions")
    @Operation(summary = "RF6 — Versões de painel do Hype Score")
    public List<Map<String, Object>> panelVersions() {
        return LookbookService.panelVersions();
    }

    public record PanelVersionRequest(@NotNull HypeScorePanelVersion version) {
    }

    @PutMapping("/api/me/hype-panel-version")
    @Operation(summary = "RF6 — Escolher versão do painel")
    public Map<String, Object> setPanelVersion(CurrentUser user, @RequestBody PanelVersionRequest body) {
        return lookbook.setPanelVersion(user, body.version());
    }

    public record DailyLookRequest(@NotNull UUID schemeId) {
    }

    @PostMapping("/api/me/daily-look")
    @Operation(summary = "RF6.CA05 — Marcar esquema como Look do Dia")
    public Map<String, Object> markDailyLook(CurrentUser user, @RequestBody DailyLookRequest body) {
        return lookbook.markDailyLook(user, body.schemeId());
    }

    @GetMapping("/api/me/daily-looks")
    @Operation(summary = "RF6 — Histórico de Looks do Dia")
    public List<Map<String, Object>> history(CurrentUser user) {
        return dailyLooks.history(user);
    }

    @GetMapping("/api/me/daily-looks/pending-feedback")
    @Operation(summary = "RF10 — Look do dia anterior aguardando feedback")
    public Map<String, Object> pendingFeedback(CurrentUser user) {
        return dailyLooks.pendingFeedback(user);
    }

    public record FeedbackRequest(@NotNull DailyLookFeedback feedback) {
    }

    @PutMapping("/api/me/daily-looks/{date}/feedback")
    @Operation(summary = "RF10 — Feedback do look (ADOREI / OK / NAO_CURTI) alimenta as preferências")
    public Map<String, Object> feedback(CurrentUser user, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                        @RequestBody FeedbackRequest body) {
        return dailyLooks.feedback(user, date, body.feedback());
    }

    @GetMapping("/api/me/capsule")
    @Operation(summary = "RF6 — Cápsula por categoria (peças mais usadas e combinações)")
    public Map<String, Object> capsule(CurrentUser user, @RequestParam(required = false) String category) {
        return lookbook.capsule(user, category);
    }

    // Agrupamentos sugeridos do acervo (P3-04): são clusters por SIMILARIDADE (estilo, ocasião, cor, marca e tipo), não
    // Hype. As rotas novas têm o nome honesto; /api/me/hype-groups* ficam como apelidos deprecados (mesma resposta).
    @PostMapping({"/api/me/similarity-groups/suggestions", "/api/me/hype-groups/suggestions"})
    @Operation(summary = "RF6 — Sugerir agrupamentos por similaridade (≥ 0,70); /api/me/hype-groups/suggestions é o nome legado (deprecado)")
    public Map<String, Object> suggestGroups(CurrentUser user, @RequestParam HypeEntityType type) {
        return lookbook.suggestGroups(user, type);
    }

    @GetMapping({"/api/me/similarity-groups", "/api/me/hype-groups"})
    @Operation(summary = "RF6 — Agrupamentos sugeridos por similaridade, com o Hype médio v2 dos membros à parte; /api/me/hype-groups é o nome legado (deprecado)")
    public List<Map<String, Object>> groups(CurrentUser user, @RequestParam HypeEntityType type) {
        return lookbook.groups(user, type);
    }

    @DeleteMapping({"/api/me/similarity-groups/{groupId}", "/api/me/hype-groups/{groupId}"})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF6 — Descartar agrupamento sugerido; /api/me/hype-groups/{groupId} é o nome legado (deprecado)")
    public void discardGroup(CurrentUser user, @PathVariable UUID groupId) {
        lookbook.discardGroup(user, groupId);
    }

    @PostMapping("/api/groupings")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF6 — Criar agrupamento (coleção, temporada, editorial)")
    public Map<String, Object> createGrouping(CurrentUser user, @RequestBody LookbookService.GroupingForm form) {
        return lookbook.createGrouping(user, form);
    }

    @PutMapping("/api/groupings/{id}")
    @Operation(summary = "RF6 — Editar agrupamento")
    public Map<String, Object> updateGrouping(CurrentUser user, @PathVariable UUID id, @RequestBody LookbookService.GroupingForm form) {
        return lookbook.updateGrouping(user, id, form);
    }

    @DeleteMapping("/api/groupings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF6 — Excluir agrupamento")
    public void deleteGrouping(CurrentUser user, @PathVariable UUID id) {
        lookbook.deleteGrouping(user, id);
    }

    public record AssignRequest(List<UUID> schemeIds, List<UUID> pieceIds) {
    }

    @PostMapping("/api/groupings/{id}/items")
    @Operation(summary = "RF6 — Adicionar esquemas/peças ao agrupamento")
    public Map<String, Object> assign(CurrentUser user, @PathVariable UUID id, @RequestBody AssignRequest body) {
        return lookbook.assignToGrouping(user, id, body.schemeIds(), body.pieceIds());
    }

    @GetMapping("/api/users/{ownerId}/groupings")
    @Operation(summary = "RF6/RF14 — Agrupamentos de um usuário")
    public List<Map<String, Object>> groupingsOf(CurrentUser viewer, @PathVariable UUID ownerId) {
        return lookbook.groupingsOf(viewer, ownerId);
    }

    @GetMapping("/api/groupings/{id}/schemes")
    @Operation(summary = "RF6 — Esquemas de um agrupamento")
    public List<Views.SchemeView> groupingSchemes(CurrentUser viewer, @PathVariable UUID id) {
        return lookbook.groupingSchemes(viewer, id);
    }

    @GetMapping("/api/hype/method")
    @Operation(summary = "RF6 — Como o Hype Score é calculado (v1 do Look do Dia + configuração ativa do HypeScore v2)")
    public Map<String, Object> hypeMethod() {
        Map<String, Object> out = new java.util.LinkedHashMap<>(hype.describe());
        out.put("v2", hypeV2.describe());
        return out;
    }

    /**
     * @deprecated legado v1: agrupamentos globais por SIMILARIDADE com a média v1 ({@code hypeScoreGlobal}); nenhuma tela
     * usa. Atenção (Lote A1): {@code GET /api/hype/groups?type=CREATOR|BRAND} no HypeController colide com esta rota
     * (mesmo caminho e método) — remover ou mover este mapeamento antes de criar aquele.
     */
    @Deprecated
    @GetMapping("/api/hype/groups")
    @Operation(summary = "RF6 — Agrupamentos globais por similaridade (legado v1 \"HypeGroups\"; deprecado)", deprecated = true)
    public List<Map<String, Object>> hypeGroups(@RequestParam HypeEntityType type) {
        return hype.hypeGroups(type);
    }
}
