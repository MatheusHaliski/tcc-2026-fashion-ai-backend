package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Comment;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Reaction;
import br.com.fashionai.domain.model.SavedItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.events.DomainEvents;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF19 — curtir/descurtir (sem duplicata), reações qualitativas trend/elegante/criativo com contador próprio,
 * comentar/excluir (só autor do conteúdo ou do comentário), salvar em Looks Salvos, compartilhar no feed interno
 * ou exportar para rede externa, remixar e retornar. Vale igualmente para esquemas, peças (RF19.CA10) e DNA.
 * Cada interação enfileira notificação ao autor; tipo desativado conta mas não entrega (CA11/CA12).
 */
@Service
public class SocialService {
    public static final int COMMENT_MAX = 500;

    private final ReactionRepository reactions;
    private final CommentRepository comments;
    private final SavedItemRepository saved;
    private final ShareRepository shares;
    private final SchemeRepository schemes;
    private final WardrobeItemRepository pieces;
    private final DnaSchemeRepository dnas;
    private final br.com.fashionai.domain.repository.SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final SchemeService schemeService;
    private final WardrobeService wardrobe;
    private final NotificationService notifications;
    private final CounterStorePort counters;
    private final MediaService media;
    private final Guard guard;
    private final ApplicationEventPublisher events;

    public SocialService(ReactionRepository reactions, CommentRepository comments, SavedItemRepository saved,
                         ShareRepository shares, SchemeRepository schemes, WardrobeItemRepository pieces,
                         DnaSchemeRepository dnas, br.com.fashionai.domain.repository.SchemeItemRepository schemeItems,
                         UserRepository users, SchemeService schemeService, WardrobeService wardrobe,
                         NotificationService notifications, CounterStorePort counters, MediaService media, Guard guard,
                         ApplicationEventPublisher events) {
        this.reactions = reactions;
        this.comments = comments;
        this.saved = saved;
        this.shares = shares;
        this.schemes = schemes;
        this.pieces = pieces;
        this.dnas = dnas;
        this.schemeItems = schemeItems;
        this.users = users;
        this.schemeService = schemeService;
        this.wardrobe = wardrobe;
        this.notifications = notifications;
        this.counters = counters;
        this.media = media;
        this.guard = guard;
        this.events = events;
    }

    /** Alvo de interação resolvido: dono, título e acesso aos contadores persistidos. */
    record Target(TargetType type, UUID id, User owner, String title, boolean available, Object entity) {
    }

    /**
     * Resolve o alvo com as mesmas regras de quem abre o conteúdo: visibilidade efetiva (conteúdo × perfil do autor),
     * bloqueio em qualquer direção (Guard) e, na peça, moderação aprovada. Quem não vê não comenta, não reage, não
     * compartilha, não remixa e não lê contadores — e o autor não recebe notificação de quem ele bloqueou.
     */
    Target target(CurrentUser viewer, TargetType type, UUID id) {
        return switch (type) {
            case SCHEME -> {
                Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound("Esquema"));
                schemeService.requireView(viewer, s);
                yield new Target(type, id, s.getUser(), s.getTitle(), s.isDisponivel(), s);
            }
            case PIECE -> {
                WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
                boolean privileged = viewer != null && (viewer.id().equals(w.getUser().getId()) || viewer.admin());
                if (!privileged && w.getModerationStatus() != ModerationStatus.APPROVED) {
                    throw ApiException.notFound(Msg.t("common.peca"));
                }
                guard.requireView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w), "piece:" + id);
                yield new Target(type, id, w.getUser(), w.getName(), w.isDisponivel(), w);
            }
            case DNA -> {
                DnaScheme d = dnas.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
                guard.requireView(viewer, d.getUser().getId(), SchemeService.moreRestrictive(d.getVisibility(),
                        d.getUser().getProfileVisibility()), "dna:" + id);
                yield new Target(type, id, d.getUser(), d.getTitle(), d.isDisponivel(), d);
            }
        };
    }

    private void bump(Target t, String field, long delta) {
        counters.increment(t.type().name().toLowerCase(), t.id(), field, delta);
        switch (t.entity()) {
            case Scheme s -> {
                switch (field) {
                    case "likes" -> s.setLikeCount(Math.max(0, s.getLikeCount() + delta));
                    case "comments" -> s.setCommentCount(Math.max(0, s.getCommentCount() + delta));
                    case "shares" -> s.setShareCount(Math.max(0, s.getShareCount() + delta));
                    case "saves" -> s.setSaveCount(Math.max(0, s.getSaveCount() + delta));
                    case "remixes" -> s.setRemixCount(Math.max(0, s.getRemixCount() + delta));
                    default -> {
                    }
                }
            }
            case WardrobeItem w -> {
                switch (field) {
                    case "likes" -> w.setLikesCount(Math.max(0, w.getLikesCount() + delta));
                    case "comments" -> w.setCommentCount(Math.max(0, w.getCommentCount() + delta));
                    case "shares" -> w.setSharesCount(Math.max(0, w.getSharesCount() + delta));
                    case "remixes" -> w.setRemixesCount(Math.max(0, w.getRemixesCount() + delta));
                    default -> {
                    }
                }
            }
            case DnaScheme d -> {
                switch (field) {
                    case "likes" -> d.setLikeCount(Math.max(0, d.getLikeCount() + delta));
                    case "comments" -> d.setCommentCount(Math.max(0, d.getCommentCount() + delta));
                    case "shares" -> d.setShareCount(Math.max(0, d.getShareCount() + delta));
                    case "remixes" -> d.setRemixCount(Math.max(0, d.getRemixCount() + delta));
                    default -> {
                    }
                }
            }
            default -> {
            }
        }
    }

    /** HypeScore v2 — sinal de comportamento sobre peça/look (DNA de estilo não tem Hype). Filtrado no HypeSignalRecorder. */
    private void hypeSignal(Target t, UUID actorId, HypeSignalType signal) {
        HypeEntityType type = t.type() == TargetType.PIECE ? HypeEntityType.PIECE : t.type() == TargetType.SCHEME ? HypeEntityType.SCHEME : null;
        if (type != null) {
            events.publishEvent(new DomainEvents.HypeSignal(signal, type, t.id(), actorId, t.owner().getId()));
        }
    }

    // ------------------------------------------------------------------ CA01–CA03 curtir e reações
    @Transactional
    public Map<String, Object> react(CurrentUser user, TargetType type, UUID id, ReactionType reaction) {
        guard.requireCanCreate(user);
        Target t = target(user, type, id);
        Optional<Reaction> existing = reactions.findByActorIdAndTargetTypeAndTargetIdAndReactionType(user.id(), type, id, reaction);
        boolean active;
        if (existing.isPresent()) {
            // CA02 — segundo clique remove; nunca há curtida dupla.
            reactions.delete(existing.get());
            if (reaction == ReactionType.LIKE) {
                bump(t, "likes", -1);
            }
            active = false;
        } else {
            Reaction r = new Reaction();
            r.setActor(users.findById(user.id()).orElseThrow());
            r.setTargetType(type);
            r.setTargetId(id);
            r.setReactionType(reaction);
            reactions.save(r);
            if (reaction == ReactionType.LIKE) {
                bump(t, "likes", 1);
            }
            active = true;
            notifications.notify(t.owner().getId(), user.id(), reaction == ReactionType.LIKE ? NotificationType.NEW_LIKE
                            : NotificationType.NEW_REACTION, type.name(), id,
                    "@" + user.username() + (reaction == ReactionType.LIKE ? " curtiu " : " reagiu (" + label(reaction) + ") a ")
                            + "\"" + t.title() + "\"", null, Map.of("reaction", reaction.name()));
            if (reaction == ReactionType.LIKE) {
                // RF35 §5.2 — curtida recebida (+1, 50/dia no total; interação consigo mesmo não pontua)
                events.publishEvent(new DomainEvents.InteractionReceived(t.owner().getId(), user.id(), "LIKE", id));
                hypeSignal(t, user.id(), HypeSignalType.LIKE_CREATED);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active", active);
        out.put("reaction", reaction);
        out.put("count", reactions.countByTargetTypeAndTargetIdAndReactionType(type, id, reaction));
        return out;
    }

    static String label(ReactionType r) {
        return switch (r) {
            case LIKE -> "curtida";
            case TREND -> "trend";
            case ELEGANTE -> "elegante";
            case CRIATIVO -> "criativo";
        };
    }

    // ------------------------------------------------------------------ CA04–CA06 comentários
    @Transactional(readOnly = true)
    public List<Map<String, Object>> comments(CurrentUser viewer, TargetType type, UUID id) {
        Target t = target(viewer, type, id);
        return comments.findByTargetTypeAndTargetIdAndActiveTrueOrderByCreatedAtAsc(type, id).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("author", Views.user(c.getAuthor()));
            m.put("content", c.getContent());
            m.put("parentCommentId", c.getParentCommentId());
            m.put("createdAt", c.getCreatedAt());
            m.put("canDelete", viewer != null && (viewer.id().equals(c.getAuthor().getId()) || viewer.id().equals(t.owner().getId())));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> comment(CurrentUser user, TargetType type, UUID id, String content, UUID parentId) {
        guard.requireCanCreate(user);
        Target t = target(user, type, id);
        String text = InputSanitizer.clean(content, Integer.MAX_VALUE);
        if (text == null || text.isBlank()) {
            throw ApiException.badRequest("COMENTARIO_VAZIO", Msg.t("social.escreva_algo_antes_de_enviar"));
        }
        if (text.length() > COMMENT_MAX) {
            throw ApiException.badRequest("COMENTARIO_LONGO", Msg.t("social.o_comentario_tem_caracteres_o", text.length(), COMMENT_MAX));
        }
        if (InputSanitizer.offensive(text)) {
            throw ApiException.badRequest("CONTEUDO_BLOQUEADO", Msg.t("social.o_comentario_viola_a_politica"));
        }
        Comment c = new Comment();
        c.setAuthor(users.findById(user.id()).orElseThrow());
        c.setTargetType(type);
        c.setTargetId(id);
        c.setParentCommentId(parentId);
        c.setContent(text);
        comments.save(c);
        bump(t, "comments", 1);
        notifications.notify(t.owner().getId(), user.id(), NotificationType.NEW_COMMENT, type.name(), id,
                Msg.k("social.comentou_em", user.username(), t.title()), text.length() > 120 ? text.substring(0, 117) + "…" : text, null);
        events.publishEvent(new DomainEvents.InteractionReceived(t.owner().getId(), user.id(), "COMMENT", c.getId()));
        hypeSignal(t, user.id(), HypeSignalType.COMMENT_CREATED);
        return Map.of("id", c.getId(), "author", Views.user(c.getAuthor()), "content", c.getContent(), "createdAt", String.valueOf(c.getCreatedAt()));
    }

    @Transactional
    public void deleteComment(CurrentUser user, UUID commentId) {
        Comment c = comments.findById(commentId).orElseThrow(() -> ApiException.notFound(Msg.t("social.comentario")));
        Target t = target(user, c.getTargetType(), c.getTargetId());
        boolean allowed = user.id().equals(c.getAuthor().getId()) || user.id().equals(t.owner().getId());
        if (!allowed) {
            // CA05 — nenhum outro usuário exclui (RNF1), tentativa auditada.
            throw guard.deny(user, "comment:" + commentId, Msg.t("social.so_o_autor_do_comentario"));
        }
        c.setActive(false);
        bump(t, "comments", -1);
    }

    // ------------------------------------------------------------------ CA07 salvar (Looks Salvos)
    @Transactional
    public Map<String, Object> toggleSave(CurrentUser user, TargetType type, UUID id) {
        guard.requireCanCreate(user);
        Target t = target(user, type, id);
        Optional<SavedItem> existing = saved.findByUserIdAndTargetTypeAndTargetId(user.id(), type, id);
        if (existing.isPresent()) {
            saved.delete(existing.get());
            bump(t, "saves", -1);
            return Map.of("saved", false);
        }
        SavedItem s = new SavedItem();
        s.setUser(users.findById(user.id()).orElseThrow());
        s.setTargetType(type);
        s.setTargetId(id);
        saved.save(s);
        bump(t, "saves", 1);
        hypeSignal(t, user.id(), HypeSignalType.SAVE_CREATED);
        return Map.of("saved", true);
    }

    /** RF6.CA12 — favoritar um look salvo de terceiro. */
    @Transactional
    public Map<String, Object> favoriteSaved(CurrentUser user, TargetType type, UUID id, boolean favorite) {
        SavedItem s = saved.findByUserIdAndTargetTypeAndTargetId(user.id(), type, id)
                .orElseThrow(() -> ApiException.notFound(Msg.t("common.look_salvo")));
        s.setFavorite(favorite);
        if (favorite) {
            hypeSignal(target(user, type, id), user.id(), HypeSignalType.FAVORITE_CREATED);
        }
        return Map.of("favorite", favorite);
    }

    // ------------------------------------------------------------------ CA08/CA09 compartilhar
    @Transactional
    public Map<String, Object> share(CurrentUser user, TargetType type, UUID id, ShareChannel channel, String caption) {
        guard.requireCanCreate(user);
        Target t = target(user, type, id);
        if (!t.available()) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("social.este_conteudo_esta_marcado_como"));
        }
        Share s = new Share();
        s.setUser(users.findById(user.id()).orElseThrow());
        s.setTargetType(type);
        s.setTargetId(id);
        s.setChannel(channel);
        s.setCaption(InputSanitizer.moderated("caption", caption, 500));
        Map<String, Object> out = new LinkedHashMap<>();
        if (channel == ShareChannel.EXTERNAL) {
            byte[] png = type == TargetType.SCHEME ? schemeService.renderCard(user, id, true) : null;
            if (png != null) {
                MediaStoragePort.StoredObject stored = media.put("shares/" + user.id() + "/" + type.name().toLowerCase() + "-" + id
                        + "-" + System.currentTimeMillis() + ".png", png, "image/png");
                s.setExportUrl(stored.url());
                out.put("imageUrl", stored.url());
            } else if (t.entity() instanceof WardrobeItem w) {
                s.setExportUrl(w.getImageUrl());
                out.put("imageUrl", w.getImageUrl());
            }
            out.put("link", (type == TargetType.SCHEME ? "/schemes/" : type == TargetType.PIECE ? "/pieces/" : "/dna-schemes/") + id);  // rotas reais do app
        }
        shares.save(s);
        bump(t, "shares", 1);
        hypeSignal(t, user.id(), HypeSignalType.SHARE_CREATED);
        notifications.notify(t.owner().getId(), user.id(), NotificationType.NEW_REACTION, type.name(), id,
                "@" + user.username() + " compartilhou \"" + t.title() + "\"", null, Map.of("channel", channel.name()));
        out.put("shareId", s.getId());
        out.put("channel", channel);
        out.put("shares", shares.countByTargetTypeAndTargetId(type, id));
        return out;
    }

    // ------------------------------------------------------------------ CA13/CA14 remixar e retornar
    @Transactional
    public Map<String, Object> remix(CurrentUser user, TargetType type, UUID id) {
        guard.requireCanCreate(user);
        Target t = target(user, type, id);
        // indisponível vale para os outros: a dona remixa a própria peça mesmo marcada como indisponível (vira semente)
        boolean ownPiece = type == TargetType.PIECE && t.owner().getId().equals(user.id());
        if (!t.available() && !ownPiece) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("social.o_autor_marcou_este_conteudo"));
        }
        if (type == TargetType.SCHEME) {
            return schemeService.remix(user, id);
        }
        if (type == TargetType.PIECE) {
            WardrobeItem w = (WardrobeItem) t.entity();
            // o criador de looks só aceita peças do acervo de quem compõe (wardrobe.eligible): a peça de outra
            // pessoa é importada (ou reaproveitada, se já foi importada antes) ANTES de contar o remix
            UUID seedId = ownPiece ? id : importedCopy(user, w);
            bump(t, "remixes", 1);
            hypeSignal(t, user.id(), HypeSignalType.PIECE_REMIXED);
            notifications.notify(t.owner().getId(), user.id(), NotificationType.NEW_REMIX, "PIECE", id,
                    Msg.k("social.remixou_a_peca", user.username(), w.getName()), null, null);
            // a peça entra como semente no criador de looks (scheme-builder lê ?pieces=)
            return Map.of("next", "/schemes/new?pieces=" + seedId, "sourcePiece", Views.piece(w, null, null),
                    "seedPieceId", seedId,
                    "hint", ownPiece ? Msg.t("social.a_peca_entra_como_semente") : Msg.t("social.peca_importada_para_o_remix"));
        }
        bump(t, "remixes", 1);
        return Map.of("next", "/dna/new?remix=" + id);
    }

    /** Cópia da peça alheia no acervo de quem remixa: reaproveita uma cópia elegível já existente, senão importa. */
    private UUID importedCopy(CurrentUser user, WardrobeItem source) {
        return wardrobe.eligible(user.id()).stream()
                .filter(c -> source.getId().equals(c.getRemixedFromPieceId()))
                .map(WardrobeItem::getId)
                .findFirst()
                .orElseGet(() -> wardrobe.addToWardrobe(user, source.getId()).id());
    }

    /** CA14 — a partir de uma peça da lista, abre o esquema de ORIGEM que usou aquela peça (o mais antigo visível). */
    @Transactional(readOnly = true)
    public Map<String, Object> returnToOrigin(CurrentUser user, UUID pieceId, UUID fromSchemeId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        if (!w.isDisponivel() && !w.getUser().getId().equals(user.id())) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("social.esta_peca_esta_indisponivel_para"));
        }
        List<Scheme> candidates = schemeItems.findByWardrobeItemId(pieceId).stream().map(si -> si.getScheme())
                .filter(s -> !s.getId().equals(fromSchemeId))
                .filter(s -> schemeService.canView(user, s))
                .sorted(java.util.Comparator.comparing(Scheme::getCreatedAt))
                .toList();
        if (candidates.isEmpty()) {
            throw ApiException.notFound(Msg.t("social.esquema_de_origem_visivel_para"));
        }
        Scheme origin = candidates.get(0);
        return Map.of("pieceId", pieceId, "originSchemeId", origin.getId(), "title", origin.getTitle(),
                "otherSchemes", candidates.stream().skip(1).map(s -> Map.of("id", s.getId(), "title", s.getTitle())).toList());
    }

    /** Contadores públicos do conteúdo — só para quem pode ver o conteúdo (mesmas regras do {@link #target}). */
    @Transactional(readOnly = true)
    public Map<String, Object> counters(CurrentUser viewer, TargetType type, UUID id) {
        target(viewer, type, id);
        Map<String, Object> m = new LinkedHashMap<>();
        for (ReactionType r : ReactionType.values()) {
            m.put(r.name(), reactions.countByTargetTypeAndTargetIdAndReactionType(type, id, r));
        }
        m.put("comments", comments.countByTargetTypeAndTargetIdAndActiveTrue(type, id));
        m.put("shares", shares.countByTargetTypeAndTargetId(type, id));
        m.put("saves", saved.countByTargetTypeAndTargetId(type, id));
        m.put("live", counters.read(type.name().toLowerCase(), id));
        m.put("at", Instant.now());
        return m;
    }
}
