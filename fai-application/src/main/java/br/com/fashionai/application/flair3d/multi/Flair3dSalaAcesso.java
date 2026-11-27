package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Quem pode mexer em qual sala: só as duas pessoas dela (para quem está fora, a sala não existe: 404), no estado que
 * a operação pede (409). A sala é lida travada para escrever (PESSIMISTIC_WRITE), então aceite, lance e fechamento de
 * uma mesma sala nunca correm ao mesmo tempo. O convite vencido vira EXPIRADO na primeira leitura depois do prazo.
 */
@Component
public class Flair3dSalaAcesso {
    private final Flair3dSalaRepository salas;

    public Flair3dSalaAcesso(Flair3dSalaRepository salas) {
        this.salas = salas;
    }

    /** A sala para escrever, de quem está nela (404), já com o prazo do convite conferido. */
    public Flair3dSala travada(UUID userId, UUID salaId) {
        Flair3dSala s = salas.findForUpdateById(salaId).filter(x -> x.temParticipante(userId))
                .orElseThrow(() -> Flair3dErros.naoEncontrado("SALA_NAO_ENCONTRADA", "sala_nao_encontrada"));
        return expirar(s);
    }

    /** A sala para ler, de quem está nela (404). */
    public Flair3dSala lida(UUID userId, UUID salaId) {
        return salas.findById(salaId).filter(x -> x.temParticipante(userId))
                .orElseThrow(() -> Flair3dErros.naoEncontrado("SALA_NAO_ENCONTRADA", "sala_nao_encontrada"));
    }

    /** O convite que passou do prazo sem aceite vira EXPIRADO (e é gravado). */
    public Flair3dSala expirar(Flair3dSala s) {
        if (Flair3dSala.CONVIDADO.equals(s.getEstado()) && s.getPrazo().isBefore(Instant.now())) {
            s.setEstado(Flair3dSala.EXPIRADO);
            return salas.save(s);
        }
        return s;
    }

    /** 409 quando a sala não está no estado pedido (convite expirado tem código próprio). */
    public static void exigirEstado(Flair3dSala s, String estado) {
        if (estado.equals(s.getEstado())) {
            return;
        }
        if (Flair3dSala.EXPIRADO.equals(s.getEstado())) {
            throw ApiException.conflict("CONVITE_EXPIRADO", Msg.t("flair3d.erro.convite_expirado"));
        }
        throw ApiException.conflict("SALA_ESTADO_INVALIDO", Msg.t("flair3d.erro.sala_estado_invalido"));
    }

    /** 403 quando a operação é do outro lado da sala (aceitar é de quem foi convidada; cancelar, de quem convidou). */
    public static void exigirLado(Flair3dSala s, UUID userId, boolean convidada) {
        UUID dono = convidada ? s.getParaUserId() : s.getDeUserId();
        if (!dono.equals(userId)) {
            throw new ApiException(403, "SALA_OUTRO_LADO", Msg.t("flair3d.erro.sala_outro_lado"));
        }
    }

    /** 422 quando a sala não é do modo pedido. */
    public static void exigirModo(Flair3dSala s, String modo) {
        if (!modo.equals(s.getModo())) {
            throw Flair3dErros.invalido("SALA_MODO_ERRADO", "sala_modo_errado");
        }
    }
}
