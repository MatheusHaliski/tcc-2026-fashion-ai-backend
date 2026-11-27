package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair3d.multi.Flair3dConvidavel;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * O oponente do duelo 1×1 do FLAIR 2D escolhido pela busca de adversários (PLANO A1, item 3): a tela manda o id da
 * pessoa ({@code opponentId}) em vez da tag digitada. O id passa pelas mesmas regras do convite do FLAIR 3D (ativa,
 * pessoal, sem bloqueio, conta de teste só para teste, 13+) e vira o username que o FlairService (congelado) já
 * entende. Sem id, vale o campo antigo {@code opponent} (@usuário ou CASA): a API antiga continua compatível.
 */
@Component
public class FlairDueloOponente {
    private final UserRepository users;
    private final Flair3dConvidavel convidavel;

    public FlairDueloOponente(UserRepository users, Flair3dConvidavel convidavel) {
        this.users = users;
        this.convidavel = convidavel;
    }

    public String oponente(CurrentUser user, UUID opponentId, String opponent) {
        if (opponentId == null) {
            return opponent;
        }
        if (opponentId.equals(user.id())) {
            throw ApiException.badRequest("DUELO_CONSIGO", Msg.t("common.escolha_outra_pessoa_ou_a"));
        }
        return users.findById(opponentId).filter(u -> convidavel.visivel(user, u, convidavel.bloqueados(user.id())))
                .map(User::getUsername).orElseThrow(() -> ApiException.notFound("Oponente"));
    }
}
