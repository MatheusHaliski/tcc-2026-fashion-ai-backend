package br.com.fashionai.application.flair;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FlairService;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.*;

import static br.com.fashionai.application.flair.FlairModeValues.today;

/**
 * Looks e cartas dos modos: look do FLAIR a partir de um look salvo ou de cartas soltas, looks próprios e públicos,
 * a "Casa" (comunidade sorteada por semente), oponente por @usuário e escolha dos looks que cobrem as situações.
 */
public final class FlairModeLooks {
    private final FlairService flair;
    private final SchemeService schemeService;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final Guard guard;

    FlairModeLooks(FlairService flair, SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                   WardrobeItemRepository pieces, UserRepository users, Guard guard) {
        this.flair = flair;
        this.schemeService = schemeService;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.guard = guard;
    }

    List<Card> cardsOf(Scheme s) {
        return flair.cardsOf(schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList());
    }

    /** Look do FLAIR: HYPE = HypeScore v2 público do look (nulo → neutro em FlairLooks), nunca o v1 de schemes.hype_score. */
    public Look look(Scheme s) {
        return FlairLooks.look(new FlairLooks.LookInput(s.getId().toString(), s.getTitle(), s.getUser().getUsername(),
                s.getCoverImageUrl() == null || "null".equals(s.getCoverImageUrl()) ? null : s.getCoverImageUrl(),
                flair.publicLookHype(s.getId()), s.getLikeCount(), s.getSaveCount(), s.getCommentCount(),
                s.getShareCount(), s.getRemixCount(), Json.csv(s.getStyle()), Json.csv(s.getOccasion()), s.getSeason() == null ? null : s.getSeason().name(), cardsOf(s)));
    }

    Look lookOfCards(List<Card> cards, String title, String owner) {
        return FlairLooks.look(new FlairLooks.LookInput(null, title, owner, cards.isEmpty() ? null : cards.get(0).imageUrl(), null, 0, 0, 0, 0, 0,
                List.of(), List.of(), null, cards));
    }

    List<Scheme> ownSchemes(UUID userId) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED).stream()
                .filter(s -> !schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).isEmpty()).toList();
    }

    Scheme ownScheme(CurrentUser user, UUID id) {
        Scheme s = schemeService.owned(user, id);
        if (s.getStatus() == SchemeStatus.ARCHIVED) {
            throw ApiException.badRequest("LOOK_ARQUIVADO", Msg.t("flairModes.esse_look_esta_arquivado"));
        }
        return s;
    }

    List<Look> publicLooksOf(CurrentUser viewer, User owner) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && schemeService.canView(viewer, s)).map(this::look)
                .filter(l -> !l.cards().isEmpty()).toList();
    }

    /**
     * Looks públicos da comunidade (a "Casa"), sem os do próprio jogador, sorteados por semente. Só looks que um visitante
     * veria (visibilidade do look × perfil do autor) e de ninguém com bloqueio com o jogador.
     */
    List<Look> houseLooks(UUID exclude, int n, long seed) {
        List<Scheme> pub = new ArrayList<>(schemes.findAllPublic(PageRequest.of(0, 120)).stream().filter(s -> !s.getUser().getId().equals(exclude))
                .filter(s -> schemeService.canView(null, s) && !guard.blocked(exclude, s.getUser().getId())).toList());
        java.util.Collections.shuffle(pub, new Random(seed));
        List<Look> out = new ArrayList<>();
        for (Scheme s : pub) {
            Look l = look(s);
            if (!l.cards().isEmpty()) {
                out.add(l);
            }
            if (out.size() >= n) {
                break;
            }
        }
        if (out.size() < n) {
            out.addAll(houseOutfits(exclude, n - out.size(), seed));
        }
        return out;
    }

    /**
     * Sem looks públicos bastantes na comunidade (banco novo, comunidade pequena), a Casa veste looks montados com as
     * peças públicas, uma de cada lugar do corpo, como o deck da Casa do Duelo ({@link FlairService#houseDeck}).
     */
    List<Look> houseOutfits(UUID player, int n, long seed) {
        Map<String, List<WardrobeItem>> porLugar = new LinkedHashMap<>();
        for (WardrobeItem w : publicPieces(player, seed, true)) {
            porLugar.computeIfAbsent(w.getCategory(), k -> new ArrayList<>()).add(w);
        }
        int variedade = porLugar.values().stream().mapToInt(List::size).max().orElse(0);
        List<Look> out = new ArrayList<>();
        for (int i = 0; i < Math.min(n, variedade); i++) {
            List<WardrobeItem> look = new ArrayList<>();
            for (String lugar : List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece")) {
                List<WardrobeItem> doLugar = porLugar.getOrDefault(lugar, List.of());
                if (!doLugar.isEmpty()) {
                    look.add(doLugar.get(i % doLugar.size()));
                }
            }
            if (!look.isEmpty()) {
                out.add(lookOfCards(flair.cardsOf(look), Msg.t("flairModes.look_da_casa_n", i + 1), Msg.t("flairModes.pecas_publicas")));
            }
        }
        return out;
    }

    List<Card> houseCards(UUID exclude, int n, long seed) {
        return flair.cardsOf(publicPieces(exclude, seed, false).stream().limit(n).toList());
    }

    /** Cartas da Casa; quando a comunidade tem menos de {@code min} peças públicas, entram também as de quem joga. */
    List<Card> houseCardsAtLeast(UUID player, int n, int min, long seed) {
        List<WardrobeItem> outras = publicPieces(player, seed, false);
        return flair.cardsOf((outras.size() >= min ? outras : publicPieces(player, seed, true)).stream().limit(n).toList());
    }

    /** Peças públicas sorteadas pela semente, as de outras pessoas antes; sem arquivadas e sem quem tem bloqueio. */
    private List<WardrobeItem> publicPieces(UUID player, long seed, boolean comAsProprias) {
        // findAllPublic já respeita privacidade do perfil, moderação e arquivamento; o bloqueio depende de quem joga
        List<WardrobeItem> pub = new ArrayList<>(pieces.findAllPublic(PageRequest.of(0, 400)).stream()
                .filter(w -> comAsProprias || !w.getUser().getId().equals(player))
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> w.getUser().getId().equals(player) || !guard.blocked(player, w.getUser().getId())).toList());
        java.util.Collections.shuffle(pub, new Random(seed));
        pub.sort(Comparator.comparing((WardrobeItem w) -> w.getUser().getId().equals(player)));
        return pub;
    }

    User opponentUser(CurrentUser user, String opponent) {
        User u = users.findByUsernameIgnoreCase(opponent.trim().replaceFirst("^@", "")).orElseThrow(() -> ApiException.notFound("Oponente"));
        if (u.getId().equals(user.id())) {
            throw ApiException.badRequest("OPONENTE_INVALIDO", Msg.t("common.escolha_outra_pessoa_ou_a"));
        }
        if (guard.blocked(user.id(), u.getId())) {
            // bloqueio em qualquer direção: a pessoa some da partida como se não existisse (não revela o bloqueio)
            throw ApiException.notFound("Oponente");
        }
        return u;
    }

    static boolean house(String opponent) {
        return opponent == null || opponent.isBlank() || "CASA".equalsIgnoreCase(opponent.trim());
    }

    long seed(Object... parts) {
        return Objects.hash(parts) * 31L + today().toEpochDay();
    }

    List<Look> looksById(List<UUID> ids) {
        return ids.stream().map(id -> schemes.findById(id).orElse(null)).filter(Objects::nonNull).filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).map(this::look).toList();
    }

    List<Card> cardsById(List<UUID> ids) {
        return flair.cardsOf(ids.stream().map(id -> pieces.findById(id).orElse(null)).filter(Objects::nonNull).toList());
    }

    List<Look> pickSquad(List<Look> looks, int n) {
        List<Theme> sits = FlairLooks.SQUAD_SITUATIONS.stream().map(FlairLooks::theme).toList();
        if (looks.size() <= n) {
            return looks;
        }
        // os 5 que cobrem melhor as 5 situações (cada situação pega o melhor ainda livre)
        List<Look> left = new ArrayList<>(looks), out = new ArrayList<>();
        for (Theme t : sits) {
            Look best = left.stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total())).get();
            out.add(best);
            left.remove(best);
            if (out.size() == n) {
                break;
            }
        }
        return out;
    }

    public Map<String, Object> myLooks(CurrentUser user) {
        List<Look> looks = ownSchemes(user.id()).stream().map(this::look).sorted(Comparator.comparingInt(Look::rating).reversed()).toList();
        return Map.of("looks", looks.stream().map(FlairModeViews::lookView).toList(), "stats", FlairLooks.LABELS);
    }
}
