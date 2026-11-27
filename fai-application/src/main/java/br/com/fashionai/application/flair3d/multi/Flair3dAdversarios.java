package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Busca de adversários na rede FAI (PLANO A1; pedido da dona: "convidar através de busca, nunca digitar a tag"). Parte
 * da busca de pessoas (GET /api/search?tab=PESSOAS: bloqueio, conta de teste e conta ativa já tratados) e das conexões
 * (sigo, me segue, mútuos) e filtra por nível FLAIR, estilo, país, cidade, atividade recente e deck válido para o jogo.
 * Cada resultado diz a relação, o status com quem busca (disponível, convite pendente, em sala) e se pode ser convidado.
 */
@Service
public class Flair3dAdversarios {
    static final int LIMITE = 30;
    static final int BUSCA = 60;

    /** Os filtros da tela; nulos ou vazios não filtram. {@code relacao}: TODOS, SIGO, ME_SEGUE ou MUTUOS. */
    public record Filtros(String q, String relacao, String nivel, String estilo, String pais, String cidade, Boolean ativo, String jogo,
                          Boolean comDeck) {
    }

    private final SearchService search;
    private final UserRepository users;
    private final Flair3dSalaRepository salas;
    private final Flair3dConvidavel convidavel;
    private final Flair3dAdversarioPerfil perfis;

    public Flair3dAdversarios(SearchService search, UserRepository users, Flair3dSalaRepository salas, Flair3dConvidavel convidavel,
                              Flair3dAdversarioPerfil perfis) {
        this.search = search;
        this.users = users;
        this.salas = salas;
        this.convidavel = convidavel;
        this.perfis = perfis;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> buscar(CurrentUser viewer, Filtros f) {
        String relacao = vazio(f.relacao()) ? "TODOS" : f.relacao().toUpperCase(Locale.ROOT);
        String termo = vazio(f.q()) ? "" : f.q().trim().replaceFirst("^@", "").toLowerCase(Locale.ROOT);
        Set<UUID> sigo = convidavel.sigo(viewer.id());
        Set<UUID> meSegue = convidavel.meSegue(viewer.id());
        Set<UUID> bloqueados = convidavel.bloqueados(viewer.id());
        Set<UUID> candidatos = new LinkedHashSet<>();
        switch (relacao) {
            case "SIGO" -> candidatos.addAll(sigo);
            case "ME_SEGUE" -> candidatos.addAll(meSegue);
            case "MUTUOS" -> sigo.stream().filter(meSegue::contains).forEach(candidatos::add);
            default -> ((List<?>) search.search(viewer, termo, "PESSOAS", null, BUSCA).get("results")).stream()
                    .map(r -> ((SearchService.PersonProfile) r).id()).forEach(candidatos::add);
        }
        String jogo = vazio(f.jogo()) ? null : f.jogo().toUpperCase(Locale.ROOT);
        List<User> pessoas = users.findAllById(candidatos).stream().filter(u -> convidavel.visivel(viewer, u, bloqueados))
                .filter(u -> termo.isEmpty() || u.getUsername().toLowerCase(Locale.ROOT).contains(termo)
                        || (u.getDisplayName() != null && u.getDisplayName().toLowerCase(Locale.ROOT).contains(termo)))
                .filter(u -> vazio(f.pais()) || f.pais().equalsIgnoreCase(u.getCountry())).toList();
        Map<UUID, Flair3dAdversarioPerfil.Perfil> extra = perfis.de(pessoas, jogo);
        Map<UUID, String> status = status(viewer.id(), pessoas.stream().map(User::getId).toList());
        List<Map<String, Object>> out = new ArrayList<>();
        pessoas.stream().filter(u -> passa(f, extra.get(u.getId())))
                .sorted(Comparator.comparing((User u) -> !(sigo.contains(u.getId()) && meSegue.contains(u.getId())))
                        .thenComparing(u -> !extra.get(u.getId()).ativo()).thenComparing(u -> u.getUsername().toLowerCase(Locale.ROOT)))
                .limit(LIMITE)
                .forEach(u -> out.add(item(u, extra.get(u.getId()), relacao(u.getId(), sigo, meSegue), status.get(u.getId()), convidavel.motivo(u, sigo))));
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("resultados", out);
        resposta.put("niveis", Flair3dAdversarioPerfil.RANKS);
        return resposta;
    }

    private static boolean vazio(String s) {
        return s == null || s.isBlank();
    }

    /** Os filtros que dependem do perfil enriquecido. */
    static boolean passa(Filtros f, Flair3dAdversarioPerfil.Perfil p) {
        int minimo = vazio(f.nivel()) ? 0 : Flair3dAdversarioPerfil.RANKS.indexOf(f.nivel().toUpperCase(Locale.ROOT));
        return Flair3dAdversarioPerfil.RANKS.indexOf(p.nivel()) >= minimo
                && (vazio(f.estilo()) || f.estilo().equalsIgnoreCase(p.estilo()))
                && (vazio(f.cidade()) || (p.cidade() != null && p.cidade().toLowerCase(Locale.ROOT).contains(f.cidade().trim().toLowerCase(Locale.ROOT))))
                && (!Boolean.TRUE.equals(f.ativo()) || p.ativo())
                && (!Boolean.TRUE.equals(f.comDeck()) || Boolean.TRUE.equals(p.temDeck()));
    }

    static String relacao(UUID id, Set<UUID> sigo, Set<UUID> meSegue) {
        boolean eu = sigo.contains(id);
        boolean ela = meSegue.contains(id);
        return eu && ela ? "MUTUOS" : eu ? "SIGO" : ela ? "ME_SEGUE" : "NENHUMA";
    }

    /** EM_SALA (sala em jogo com quem busca), CONVITE_PENDENTE ou DISPONIVEL. */
    private Map<UUID, String> status(UUID viewer, List<UUID> ids) {
        Map<UUID, String> out = new HashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        List<String> abertas = List.of(Flair3dSala.CONVIDADO, Flair3dSala.JOGANDO);
        List<Flair3dSala> todas = new ArrayList<>(salas.findByDeUserIdAndParaUserIdInAndEstadoIn(viewer, ids, abertas));
        todas.addAll(salas.findByParaUserIdAndDeUserIdInAndEstadoIn(viewer, ids, abertas));
        for (Flair3dSala s : todas) {
            String st = Flair3dSala.JOGANDO.equals(s.getEstado()) ? "EM_SALA" : "CONVITE_PENDENTE";
            out.merge(s.outro(viewer), st, (a, b) -> "EM_SALA".equals(a) ? a : b);
        }
        return out;
    }

    private static Map<String, Object> item(User u, Flair3dAdversarioPerfil.Perfil p, String relacao, String status, String motivo) {
        Map<String, Object> m = new LinkedHashMap<>(Flair3dSalaVista.pessoa(u));
        m.put("pais", u.getCountry());
        m.put("cidade", p.cidade());
        m.put("nivel", p.nivel());
        m.put("nivelLabel", p.nivelLabel());
        m.put("pontos", p.pontos());
        m.put("estilo", p.estilo());
        m.put("ativo", p.ativo());
        m.put("temDeck", p.temDeck());
        m.put("relacao", relacao);
        m.put("status", status == null ? "DISPONIVEL" : status);
        m.put("convidavel", motivo == null);
        m.put("motivo", motivo);
        return m;
    }
}
