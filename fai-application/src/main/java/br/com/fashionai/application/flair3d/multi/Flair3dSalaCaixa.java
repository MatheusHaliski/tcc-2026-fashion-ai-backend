package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A caixa do multiplayer (hub do FLAIR 3D): convites recebidos e enviados em aberto, salas em jogo e as últimas
 * fechadas; e o histórico de partidas contra uma pessoa, com o placar de vitórias, derrotas e empates. Ler a caixa
 * vence os convites que passaram do prazo.
 */
@Service
public class Flair3dSalaCaixa {
    static final int RECENTES = 10;

    private final Flair3dSalaRepository salas;
    private final Flair3dSalaAcesso acesso;
    private final Flair3dSalaVista vista;

    public Flair3dSalaCaixa(Flair3dSalaRepository salas, Flair3dSalaAcesso acesso, Flair3dSalaVista vista) {
        this.salas = salas;
        this.acesso = acesso;
        this.vista = vista;
    }

    @Transactional
    public Map<String, Object> caixa(CurrentUser user) {
        List<Flair3dSala> todas = new ArrayList<>(salas.findTop40ByDeUserIdOrderByCreatedAtDesc(user.id()));
        todas.addAll(salas.findTop40ByParaUserIdOrderByCreatedAtDesc(user.id()));
        todas = todas.stream().map(acesso::expirar).sorted(Comparator.comparing(Flair3dSala::getCreatedAt).reversed()).toList();
        Map<UUID, User> pessoas = vista.pessoas(todas);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("recebidos", lista(todas, user.id(), pessoas, s -> Flair3dSala.CONVIDADO.equals(s.getEstado()) && s.getParaUserId().equals(user.id())));
        out.put("enviados", lista(todas, user.id(), pessoas, s -> Flair3dSala.CONVIDADO.equals(s.getEstado()) && s.getDeUserId().equals(user.id())));
        out.put("ativas", lista(todas, user.id(), pessoas, s -> Flair3dSala.JOGANDO.equals(s.getEstado())));
        out.put("recentes", lista(todas, user.id(), pessoas, s -> Flair3dSala.FECHADO.equals(s.getEstado())).stream().limit(RECENTES).toList());
        return out;
    }

    private List<Map<String, Object>> lista(List<Flair3dSala> todas, UUID quem, Map<UUID, User> pessoas, java.util.function.Predicate<Flair3dSala> filtro) {
        return todas.stream().filter(filtro).map(s -> vista.resumo(s, quem, pessoas)).toList();
    }

    /** As salas fechadas entre quem lê e a outra pessoa, da mais nova para a mais antiga, e o placar do confronto. */
    @Transactional(readOnly = true)
    public Map<String, Object> historico(CurrentUser user, UUID outro) {
        List<Flair3dSala> entre = new ArrayList<>(salas.findByDeUserIdAndParaUserIdOrderByCreatedAtDesc(user.id(), outro));
        entre.addAll(salas.findByDeUserIdAndParaUserIdOrderByCreatedAtDesc(outro, user.id()));
        List<Flair3dSala> fechadas = entre.stream().filter(s -> Flair3dSala.FECHADO.equals(s.getEstado()))
                .sorted(Comparator.comparing(Flair3dSala::getCreatedAt).reversed()).toList();
        long vitorias = fechadas.stream().filter(s -> user.id().equals(s.getVencedorUserId())).count();
        long empates = fechadas.stream().filter(s -> s.getVencedorUserId() == null).count();
        Map<UUID, User> pessoas = vista.pessoas(fechadas);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("placar", Map.of("vitorias", vitorias, "derrotas", fechadas.size() - vitorias - empates, "empates", empates));
        out.put("salas", fechadas.stream().map(s -> vista.resumo(s, user.id(), pessoas)).toList());
        return out;
    }
}
