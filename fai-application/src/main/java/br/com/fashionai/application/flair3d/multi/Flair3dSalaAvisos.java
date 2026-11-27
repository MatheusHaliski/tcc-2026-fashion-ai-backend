package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Os avisos da sala (Observer sobre os eventos da sala → NotificationService, docs/refactoring/gof/): o convite para
 * quem foi convidada, a vez de quem precisa jogar (aceite, lance da outra pessoa, partida dela terminada) e o
 * resultado para os dois lados. O link para a sala vai em payload.href. Recusa e expiração não avisam ninguém
 * (ETI-02: nada de aviso de culpa ou de perda).
 */
@Component
public class Flair3dSalaAvisos {
    static final String RECURSO = "FLAIR3D_SALA";

    private final NotificationService notifications;
    private final UserRepository users;

    public Flair3dSalaAvisos(NotificationService notifications, UserRepository users) {
        this.notifications = notifications;
        this.users = users;
    }

    static String href(Flair3dSala s) {
        return "/flair/3d/sala/" + s.getId();
    }

    private Map<String, Object> payload(Flair3dSala s) {
        return Map.of("href", href(s), "salaId", s.getId().toString(), "jogo", s.getJogo(), "modo", s.getModo());
    }

    /** Convite novo para quem foi convidada. */
    public void convite(Flair3dSala s, String deUsername) {
        notifications.notify(s.getParaUserId(), s.getDeUserId(), NotificationType.FLAIR3D_CONVITE, RECURSO, s.getId(),
                Msg.k("flair3d.multi.aviso.convite", deUsername, Msg.k("flair3d.multi.jogo." + s.getJogo())),
                Msg.k("flair3d.multi.aviso.convite_corpo", Msg.k("flair3d.multi.modo." + s.getModo())), payload(s));
    }

    /** É a vez de {@code quem}: o convite foi aceito, a outra pessoa lançou ou terminou a partida dela. */
    public void vez(Flair3dSala s, UUID quem) {
        String outroUsername = users.findById(s.outro(quem)).map(u -> u.getUsername()).orElse("");
        notifications.notify(quem, s.outro(quem), NotificationType.FLAIR3D_VEZ, RECURSO, s.getId(),
                Msg.k("flair3d.multi.aviso.vez", outroUsername, Msg.k("flair3d.multi.jogo." + s.getJogo())), null, payload(s));
    }

    /** O resultado para os dois lados (sem palavra de derrota: "a sala fechou, veja o placar"). */
    public void resultado(Flair3dSala s) {
        for (UUID quem : new UUID[]{s.getDeUserId(), s.getParaUserId()}) {
            notifications.notify(quem, s.outro(quem), NotificationType.FLAIR3D_RESULTADO, RECURSO, s.getId(),
                    Msg.k("flair3d.multi.aviso.resultado", Msg.k("flair3d.multi.jogo." + s.getJogo())), null, payload(s));
        }
    }
}
