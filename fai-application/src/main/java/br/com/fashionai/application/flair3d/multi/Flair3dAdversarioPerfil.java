package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.RankingOptInRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * O que a busca de adversários mostra e filtra de cada pessoa, em poucas consultas por página: nível FLAIR (rank pelos
 * pontos), estilo (arquétipo do DNA, só de perfil público), cidade (só com consentimento do ranking), ativa nos últimos
 * {@link #ATIVO} (login ou partida do FLAIR 3D) e se tem cartas para cumprir o deck do jogo.
 */
@Component
public class Flair3dAdversarioPerfil {
    static final Duration ATIVO = Duration.ofDays(7);
    /** Ordem dos ranks do FLAIR (FlairEngine.rank), para o filtro "nível mínimo". */
    public static final List<String> RANKS = List.of("ROOKIE", "TRENDSETTER", "STYLE_MAVEN", "FASHION_ARCHITECT", "ICONIC", "LEGEND");

    public record Perfil(String nivel, String nivelLabel, int pontos, String estilo, String cidade, boolean ativo, Boolean temDeck) {
    }

    private final FlairProfileRepository flair;
    private final StyleDnaRepository dna;
    private final RankingOptInRepository ranking;
    private final Flair3dMatchRepository matches;
    private final FlairCardInstanceRepository cards;

    public Flair3dAdversarioPerfil(FlairProfileRepository flair, StyleDnaRepository dna, RankingOptInRepository ranking,
                                   Flair3dMatchRepository matches, FlairCardInstanceRepository cards) {
        this.flair = flair;
        this.dna = dna;
        this.ranking = ranking;
        this.matches = matches;
        this.cards = cards;
    }

    public Map<UUID, Perfil> de(Collection<User> pessoas, String jogo) {
        Set<UUID> ids = pessoas.stream().map(User::getId).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Integer> pontos = new HashMap<>();
        flair.findByUserIdIn(ids).forEach(p -> pontos.put(p.getUser().getId(), p.getRankPoints()));
        Map<UUID, String> estilos = new HashMap<>();
        dna.findByUserIdIn(ids).forEach(d -> estilos.put(d.getUser().getId(), d.getArchetype() == null ? null : d.getArchetype().name()));
        Map<UUID, String> cidades = new HashMap<>();
        ranking.findAllById(ids).stream().filter(r -> r.isOptedIn() && r.isShareCity() && r.getCity() != null)
                .forEach(r -> cidades.put(r.getUserId(), r.getCity()));
        Instant desde = Instant.now().minus(ATIVO);
        Set<UUID> jogaram = new HashSet<>();
        matches.findByUserIdInAndUpdatedAtAfter(ids, desde).forEach(m -> jogaram.add(m.getUserId()));
        Map<UUID, List<String>> posicoes = jogo == null ? Map.of() : cards.findByOwnerIdIn(ids).stream()
                .collect(Collectors.groupingBy(FlairCardInstance::getOwnerId, Collectors.mapping(FlairCardInstance::getPosition, Collectors.toList())));
        Definicao.Deck deck = deckDoJogo(jogo);
        Map<UUID, Perfil> out = new HashMap<>();
        for (User u : pessoas) {
            Map<String, Object> rank = FlairEngine.rank(pontos.getOrDefault(u.getId(), 0));
            boolean publico = u.getProfileVisibility() == Visibility.PUBLIC;
            boolean ativo = jogaram.contains(u.getId()) || (u.getLastLoginAt() != null && u.getLastLoginAt().isAfter(desde));
            Boolean temDeck = deck == null ? null : cumpre(deck, posicoes.getOrDefault(u.getId(), List.of()));
            out.put(u.getId(), new Perfil((String) rank.get("code"), (String) rank.get("label"), (int) rank.get("points"),
                    publico ? estilos.get(u.getId()) : null, cidades.get(u.getId()), ativo, temDeck));
        }
        return out;
    }

    /** O deck que o jogo pede (nulo sem jogo, no MAKE UP e nos jogos sem deck). */
    static Definicao.Deck deckDoJogo(String jogo) {
        if (jogo == null) {
            return null;
        }
        return Flair3dNucleos.porCodigo(jogo).map(n -> n.definicao().deck()).filter(d -> !d.semDeck()).orElse(null);
    }

    /** As cartas da pessoa cumprem cada obrigatória do deck (pela posição, como Flair3dDeck.faltam)? */
    static boolean cumpre(Definicao.Deck deck, List<String> posicoes) {
        for (Definicao.Obrigatoria o : deck.obrigatorias()) {
            Set<String> aceitas = Set.of(o.posicao().split("\\|"));
            long tem = posicoes.stream().filter(p -> aceitas.contains(CbcRules.ANY) || aceitas.contains(p)).count();
            if (tem < o.quantidade()) {
                return false;
            }
        }
        return !posicoes.isEmpty();
    }
}
