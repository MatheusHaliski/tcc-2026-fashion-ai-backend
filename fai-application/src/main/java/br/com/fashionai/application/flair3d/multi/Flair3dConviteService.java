package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Convites do multiplayer do FLAIR 3D (PLANO A1): convidar quem a busca devolveu (nunca por tag digitada), aceitar,
 * recusar, cancelar e revanche. O convite vale {@link #PRAZO}; vencido, vira EXPIRADO. Não há dois convites em aberto
 * para a mesma pessoa no mesmo jogo, e cada pessoa tem no máximo {@value #MAX_ATIVAS} salas em aberto.
 */
@Service
public class Flair3dConviteService {
    static final Duration PRAZO = Duration.ofHours(48);
    static final int MAX_ATIVAS = 10;
    static final long SEMENTE_MAX = 1L << 53;
    static final List<String> ABERTAS = List.of(Flair3dSala.CONVIDADO, Flair3dSala.JOGANDO);

    /** {@code para}: o id de pessoa que a busca de adversários devolveu; sem modo, o primeiro que o jogo aceita. */
    public record Convite(UUID para, String jogo, String modo, String rodada) {
    }

    private final Flair3dSalaRepository salas;
    private final UserRepository users;
    private final Flair3dConvidavel convidavel;
    private final Flair3dSalaAcesso acesso;
    private final Flair3dSalaAvisos avisos;
    private final Flair3dSalaVista vista;

    public Flair3dConviteService(Flair3dSalaRepository salas, UserRepository users, Flair3dConvidavel convidavel, Flair3dSalaAcesso acesso,
                                 Flair3dSalaAvisos avisos, Flair3dSalaVista vista) {
        this.salas = salas;
        this.users = users;
        this.convidavel = convidavel;
        this.acesso = acesso;
        this.avisos = avisos;
        this.vista = vista;
    }

    @Transactional
    public Map<String, Object> convidar(CurrentUser user, Convite pedido) {
        if (pedido == null || pedido.para() == null) {
            throw Flair3dErros.invalido("SEM_CONVIDADO", "sem_convidado");
        }
        Flair3dSalaJogos.Escolha escolha = Flair3dSalaJogos.conferir(pedido.jogo(), pedido.modo(), pedido.rodada());
        Flair3dSala s = criar(user, pedido.para(), escolha, ThreadLocalRandom.current().nextLong(SEMENTE_MAX), null);
        return vista.resumo(s, user.id(), vista.pessoas(List.of(s)));
    }

    /** Revanche: a mesma disputa com a semente seguinte, convidando o outro lado da sala fechada. */
    @Transactional
    public Map<String, Object> revanche(CurrentUser user, UUID salaId) {
        Flair3dSala antiga = acesso.lida(user.id(), salaId);
        Flair3dSalaAcesso.exigirEstado(antiga, Flair3dSala.FECHADO);
        Flair3dSalaJogos.Escolha escolha = new Flair3dSalaJogos.Escolha(antiga.getJogo(), antiga.getModo(), antiga.getRodada());
        Flair3dSala s = criar(user, antiga.outro(user.id()), escolha, (antiga.getSemente() + 1) % SEMENTE_MAX, antiga.getId());
        return vista.resumo(s, user.id(), vista.pessoas(List.of(s)));
    }

    private Flair3dSala criar(CurrentUser user, UUID paraId, Flair3dSalaJogos.Escolha escolha, long semente, UUID revancheDe) {
        if (paraId.equals(user.id())) {
            throw Flair3dErros.invalido("CONVITE_CONSIGO", "convite_consigo");
        }
        Set<UUID> bloqueados = convidavel.bloqueados(user.id());
        User para = users.findById(paraId).filter(u -> convidavel.visivel(user, u, bloqueados))
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PESSOA_NAO_ENCONTRADA", "pessoa_nao_encontrada"));
        if (convidavel.motivo(para, convidavel.sigo(user.id())) != null) {
            throw new ApiException(403, Flair3dConvidavel.CONTA_PRIVADA, Msg.t("flair3d.erro.conta_privada"));
        }
        boolean repetido = salas.findByDeUserIdAndParaUserIdInAndEstadoIn(user.id(), List.of(paraId), List.of(Flair3dSala.CONVIDADO)).stream()
                .map(acesso::expirar).anyMatch(s -> Flair3dSala.CONVIDADO.equals(s.getEstado()) && s.getJogo().equals(escolha.jogo()));
        if (repetido) {
            throw ApiException.conflict("CONVITE_PENDENTE", Msg.t("flair3d.erro.convite_pendente"));
        }
        if (abertas(user.id()) >= MAX_ATIVAS) {
            throw ApiException.conflict("SALAS_DEMAIS", Msg.t("flair3d.erro.salas_demais", MAX_ATIVAS));
        }
        Flair3dSala s = new Flair3dSala();
        s.setJogo(escolha.jogo());
        s.setModo(escolha.modo());
        s.setRodada(escolha.rodada());
        s.setSemente(semente);
        s.setDeUserId(user.id());
        s.setParaUserId(paraId);
        s.setEstado(Flair3dSala.CONVIDADO);
        s.setPrazo(Instant.now().plus(PRAZO));
        s.setRevancheDe(revancheDe);
        s = salas.save(s);
        avisos.convite(s, user.username());
        return s;
    }

    private long abertas(UUID userId) {
        return salas.findByDeUserIdAndEstadoInOrderByCreatedAtDesc(userId, ABERTAS).size()
                + salas.findByParaUserIdAndEstadoInOrderByCreatedAtDesc(userId, List.of(Flair3dSala.JOGANDO)).size();
    }

    /** Só quem foi convidada aceita, dentro do prazo (409 CONVITE_EXPIRADO); a sala abre e quem convidou é avisada. */
    @Transactional
    public Map<String, Object> aceitar(CurrentUser user, UUID salaId) {
        Flair3dSala s = acesso.travada(user.id(), salaId);
        Flair3dSalaAcesso.exigirLado(s, user.id(), true);
        Flair3dSalaAcesso.exigirEstado(s, Flair3dSala.CONVIDADO);
        s.setEstado(Flair3dSala.JOGANDO);
        s = salas.save(s);
        avisos.vez(s, s.getDeUserId());
        return vista.resumo(s, user.id(), vista.pessoas(List.of(s)));
    }

    @Transactional
    public Map<String, Object> recusar(CurrentUser user, UUID salaId) {
        return encerrar(user, salaId, true, Flair3dSala.RECUSADO);
    }

    @Transactional
    public Map<String, Object> cancelar(CurrentUser user, UUID salaId) {
        return encerrar(user, salaId, false, Flair3dSala.CANCELADO);
    }

    private Map<String, Object> encerrar(CurrentUser user, UUID salaId, boolean convidada, String estado) {
        Flair3dSala s = acesso.travada(user.id(), salaId);
        Flair3dSalaAcesso.exigirLado(s, user.id(), convidada);
        Flair3dSalaAcesso.exigirEstado(s, Flair3dSala.CONVIDADO);
        s.setEstado(estado);
        s = salas.save(s);
        return vista.resumo(s, user.id(), vista.pessoas(List.of(s)));
    }
}
