package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FollowRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Quem pode aparecer na busca de adversários e receber convite (mesmas regras da busca de pessoas e dos desafios):
 * conta pessoal ativa, nunca a própria, sem bloqueio em nenhum sentido, conta de teste só para conta de teste e idade
 * mínima de 13 anos. Conta privada aparece, mas só recebe convite de quem a segue com aceite
 * (ChallengeService.launch). O motivo volta para a tela explicar por que o botão está desligado.
 */
@Component
public class Flair3dConvidavel {
    static final int IDADE_MINIMA = 13;
    public static final String CONTA_PRIVADA = "CONTA_PRIVADA";

    private final FollowRepository follows;

    public Flair3dConvidavel(FollowRepository follows) {
        this.follows = follows;
    }

    /** Os bloqueios de quem busca, nos dois sentidos. */
    public Set<UUID> bloqueados(UUID viewer) {
        Set<UUID> out = new HashSet<>();
        follows.findByFollowingIdAndStatus(viewer, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollower().getId()));
        follows.findByFollowerIdAndStatus(viewer, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollowing().getId()));
        return out;
    }

    /** Quem a pessoa segue com aceite. */
    public Set<UUID> sigo(UUID viewer) {
        Set<UUID> out = new HashSet<>();
        follows.findByFollowerIdAndStatus(viewer, FollowStatus.ACEITO).stream().map(Follow::getFollowing).forEach(u -> out.add(u.getId()));
        return out;
    }

    /** Quem segue a pessoa com aceite. */
    public Set<UUID> meSegue(UUID viewer) {
        Set<UUID> out = new HashSet<>();
        follows.findByFollowingIdAndStatus(viewer, FollowStatus.ACEITO).stream().map(Follow::getFollower).forEach(u -> out.add(u.getId()));
        return out;
    }

    /** A pessoa pode aparecer na busca de quem lê? (sem expor por que não) */
    public boolean visivel(CurrentUser viewer, User u, Set<UUID> bloqueados) {
        return u != null && !u.getId().equals(viewer.id()) && u.getStatus() == AccountStatus.ACTIVE && u.getProfileType() == ProfileType.PESSOAL
                && !bloqueados.contains(u.getId()) && (!u.isTestAccount() || User.isTestUsername(viewer.username())) && idadeOk(u.getBirthDate());
    }

    /** Nulo quando pode receber convite; senão o motivo (hoje só a conta privada que a pessoa não segue). */
    public String motivo(User u, Set<UUID> sigo) {
        return u.isPrivateAccount() && !sigo.contains(u.getId()) ? CONTA_PRIVADA : null;
    }

    /** Sem data (contas antigas, o cadastro já exige 13+) vale; com data, 13 anos completos. */
    static boolean idadeOk(String nascimento) {
        if (nascimento == null || nascimento.isBlank()) {
            return true;
        }
        try {
            return Period.between(LocalDate.parse(nascimento.trim()), LocalDate.now()).getYears() >= IDADE_MINIMA;
        } catch (DateTimeParseException e) {
            return true;
        }
    }
}
