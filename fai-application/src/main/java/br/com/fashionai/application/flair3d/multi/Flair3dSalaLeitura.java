package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dSala;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * A leitura da sala (GET, polling de 2 s na tela): o resumo e o andamento do modo. Ler confere o prazo do convite e,
 * no modo ASSINCRONO, fecha a sala quando as duas partidas terminaram (Strategy por modo: {@link Flair3dSalaAssincrona}
 * ou {@link Flair3dSalaPlacar}).
 */
@Service
public class Flair3dSalaLeitura {
    private final Flair3dSalaAcesso acesso;
    private final Flair3dSalaVista vista;
    private final Flair3dSalaAssincrona assincrona;
    private final Flair3dSalaPlacar placar;

    public Flair3dSalaLeitura(Flair3dSalaAcesso acesso, Flair3dSalaVista vista, Flair3dSalaAssincrona assincrona, Flair3dSalaPlacar placar) {
        this.acesso = acesso;
        this.vista = vista;
        this.assincrona = assincrona;
        this.placar = placar;
    }

    @Transactional
    public Map<String, Object> ver(CurrentUser user, UUID salaId) {
        Flair3dSala s = acesso.expirar(acesso.lida(user.id(), salaId));
        Map<String, Object> andamento = Flair3dSala.TURNOS.equals(s.getModo()) ? placar.andamento(s, user.id()) : assincrona.andamento(s, user.id());
        return vista.completa(s, user.id(), andamento);
    }
}
