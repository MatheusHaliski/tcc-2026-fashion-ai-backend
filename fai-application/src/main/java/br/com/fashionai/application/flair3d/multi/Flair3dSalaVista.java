package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * O que a tela recebe de uma sala (contrato em lib/flair/multi/types.ts): jogo, rodada, modo, estado, prazo, os dois
 * lados (só campos públicos do cabeçalho do perfil), qual lado é quem lê, o resultado quando a sala fechou e, por
 * modo, as partidas (ASSINCRONO) ou os turnos (TURNOS). A semente só aparece depois do fechamento.
 */
@Component
public class Flair3dSalaVista {
    private final UserRepository users;

    public Flair3dSalaVista(UserRepository users) {
        this.users = users;
    }

    /** As pessoas das salas, numa consulta só. */
    public Map<UUID, User> pessoas(List<Flair3dSala> salas) {
        Map<UUID, User> out = new HashMap<>();
        List<UUID> ids = salas.stream().flatMap(s -> List.of(s.getDeUserId(), s.getParaUserId()).stream()).distinct().toList();
        users.findAllById(ids).forEach(u -> out.put(u.getId(), u));
        return out;
    }

    public static Map<String, Object> pessoa(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (u == null) {
            return m;
        }
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("nome", u.getDisplayName());
        m.put("avatarUrl", u.getAvatarUrl());
        return m;
    }

    /** O resumo da sala (caixa de convites, histórico). */
    public Map<String, Object> resumo(Flair3dSala s, UUID quemLe, Map<UUID, User> pessoas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("jogo", s.getJogo());
        m.put("rodada", s.getRodada());
        m.put("modo", s.getModo());
        m.put("estado", s.getEstado());
        m.put("prazo", s.getPrazo());
        m.put("criadaEm", s.getCreatedAt());
        m.put("voce", s.getDeUserId().equals(quemLe) ? "DE" : "PARA");
        m.put("de", pessoa(pessoas.get(s.getDeUserId())));
        m.put("para", pessoa(pessoas.get(s.getParaUserId())));
        m.put("revancheDe", s.getRevancheDe());
        boolean fechada = Flair3dSala.FECHADO.equals(s.getEstado());
        m.put("resultado", fechada ? Json.read(s.getResultadoJson(), Map.class) : null);
        m.put("vencedor", !fechada ? null : s.getVencedorUserId() == null ? "EMPATE" : s.getVencedorUserId().equals(s.getDeUserId()) ? "DE" : "PARA");
        m.put("semente", fechada ? s.getSemente() : null);
        m.put("modos", Flair3dSalaJogos.MAKE_UP.equals(s.getJogo()) ? List.of(Flair3dSala.ASSINCRONO) : Flair3dSalaJogos.modos(s.getJogo()));
        return m;
    }

    /** A sala inteira para quem está nela: o resumo mais o andamento do modo (partidas ou turnos). */
    public Map<String, Object> completa(Flair3dSala s, UUID quemLe, Map<String, Object> andamento) {
        Map<String, Object> m = resumo(s, quemLe, pessoas(List.of(s)));
        m.putAll(andamento);
        return m;
    }
}
