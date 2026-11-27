package br.com.fashionai.application.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairModeCatalog;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.UserRepository;

/**
 * Convites das Partidas FLAIR pela rede FAI: a pessoa escolhe quem convidar numa busca (nunca digitando o @) e cada
 * convidado recebe um aviso CHALLENGE_INVITE com o link do modo, o rival já escolhido e, quando houver, o placar a
 * superar ({@code alvo}). Regras: até {@link #MAX} convidados por envio, nunca a si mesma, nunca quem tem bloqueio em
 * qualquer direção e no máximo um convite da mesma pessoa para a mesma pessoa a cada {@link #COOLDOWN} (antispam).
 */
@Service
public class FlairInviteService {
    public static final int MAX = 5;
    public static final Duration COOLDOWN = Duration.ofMinutes(10);
    public static final String RESOURCE = "FLAIR_INVITE";
    /** Os 15 modos do catálogo e os três clássicos (Duelo, Ocasião e Equipes). */
    public static final Set<String> MODES = Stream.concat(Stream.of("DUEL", "ARENA", "TEAM"),
            FlairModeCatalog.MODES.stream().map(FlairModesService.Mode::code)).collect(Collectors.toUnmodifiableSet());

    private final UserRepository users;
    private final NotificationRepository notificationRepo;
    private final NotificationService notifications;
    private final Guard guard;

    public FlairInviteService(UserRepository users, NotificationRepository notificationRepo, NotificationService notifications, Guard guard) {
        this.users = users;
        this.notificationRepo = notificationRepo;
        this.notifications = notifications;
        this.guard = guard;
    }

    /** Envia os convites; devolve quem foi convidado e quem ficou de fora (com o motivo). */
    @Transactional
    public Map<String, Object> invite(CurrentUser user, String mode, List<String> usernames, Integer target) {
        String code = mode == null ? "" : mode.trim().toUpperCase(Locale.ROOT);
        if (!MODES.contains(code)) {
            throw ApiException.badRequest("MODO_INVALIDO", Msg.t("flairInvite.modo_invalido"));
        }
        Set<String> names = new LinkedHashSet<>();
        for (String n : usernames == null ? List.<String>of() : usernames) {
            if (n != null && !n.isBlank()) {
                names.add(n.trim().replaceFirst("^@", "").toLowerCase(Locale.ROOT));
            }
        }
        if (names.isEmpty() || names.size() > MAX) {
            throw ApiException.badRequest("CONVITES_INVALIDOS", Msg.t("flairInvite.entre_1_e", MAX));
        }
        Instant since = Instant.now().minus(COOLDOWN);
        List<String> invited = new ArrayList<>();
        List<Map<String, String>> skipped = new ArrayList<>();
        for (String name : names) {
            User u = users.findByUsernameIgnoreCase(name).orElse(null);
            String reason = u == null ? "NAO_ENCONTRADO" : u.getId().equals(user.id()) ? "VOCE_MESMA"
                    : guard.blocked(user.id(), u.getId()) ? "INDISPONIVEL"
                    : notificationRepo.existsByRecipientIdAndActorIdAndResourceTypeAndCreatedAtAfter(u.getId(), user.id(), RESOURCE, since) ? "AGUARDE" : null;
            if (reason != null) {
                // bloqueio nunca é revelado: aparece como "indisponível", igual a quem não existe para a pessoa
                skipped.add(Map.of("username", name, "reason", reason));
                continue;
            }
            notifications.notify(u.getId(), user.id(), NotificationType.CHALLENGE_INVITE, RESOURCE, null,
                    Msg.k("flairInvite.titulo", user.username()), Msg.k(target == null ? "flairInvite.corpo" : "flairInvite.corpo_alvo", target),
                    Map.of("href", href(code, user.username(), target), "mode", code));
            invited.add(u.getUsername());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mode", code);
        out.put("invited", invited);
        out.put("skipped", skipped);
        return out;
    }

    /** Link do convite: abre o modo com o rival escolhido (e o placar a superar, se houver). */
    public static String href(String mode, String rival, Integer target) {
        return "/flair/partidas?mode=" + mode + "&rival=" + rival + (target == null ? "" : "&alvo=" + target);
    }
}
