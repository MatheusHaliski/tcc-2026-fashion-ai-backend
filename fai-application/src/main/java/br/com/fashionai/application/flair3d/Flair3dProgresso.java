package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * O progresso da pessoa num jogo do FLAIR 3D, lido das partidas que ela já fechou (tabela da V101, sem tabela nova):
 * a campanha ({@link Flair3dCampanha}) e a trava da rodada que ainda não abriu. É do servidor, por pessoa e por jogo:
 * vale em qualquer aparelho e não depende do navegador.
 */
@Service
public class Flair3dProgresso {
    private final Flair3dMatchRepository matches;

    public Flair3dProgresso(Flair3dMatchRepository matches) {
        this.matches = matches;
    }

    /** A campanha da pessoa neste jogo: rodadas vencidas, estrelas, o que abre a seguir e o ponto da história. */
    @Transactional(readOnly = true)
    public Flair3dCampanha.Progresso doJogo(CurrentUser user, String codigo) {
        Definicao d = Flair3dNucleoService.nucleo(codigo).definicao();
        boolean porResposta = Flair3dCampanha.POR_RESPOSTA.contains(d.codigo());
        List<Flair3dCampanha.Jogada> fechadas = matches.findByUserIdAndNucleo(user.id(), d.codigo()).stream()
                .filter(m -> Flair3dMatch.ENTREGUE.equals(m.getStatus()))
                .map(m -> jogada(d, m, porResposta)).toList();
        return Flair3dCampanha.de(d, fechadas);
    }

    /**
     * Antes de abrir a partida: a rodada pedida precisa estar aberta para a pessoa (422 RODADA_BLOQUEADA, com a rodada que
     * a abre). Sem rodada pedida vale o objetivo mais simples do jogo; rodada que o jogo não tem é recusada na abertura.
     */
    @Transactional(readOnly = true)
    public void conferirAberta(CurrentUser user, String codigo, String rodada) {
        Definicao d = Flair3dNucleoService.nucleo(codigo).definicao();
        if (!Flair3dCampanha.EM_SEQUENCIA.contains(d.codigo())) {
            return;
        }
        String pedida = rodada == null || rodada.isBlank() ? d.objetivo().codigo() : rodada.trim();
        Flair3dCampanha.Progresso p = doJogo(user, codigo);
        if (!p.aberta(pedida)) {
            String abreCom = p.rodadas().stream().filter(e -> e.codigo().equals(pedida)).map(Flair3dCampanha.Etapa::abreCom).findFirst().orElse("");
            throw Flair3dErros.invalido("RODADA_BLOQUEADA", "rodada_bloqueada", Map.of("rodada", pedida, "abreCom", abreCom));
        }
    }

    private static Flair3dCampanha.Jogada jogada(Definicao d, Flair3dMatch m, boolean porResposta) {
        String etapa = porResposta ? opcao(d, m) : rodada(d, m);
        Resultado r = m.getResultadoJson() == null ? null : Json.read(m.getResultadoJson(), Resultado.class);
        Instant quando = m.getUpdatedAt() != null ? m.getUpdatedAt() : m.getCreatedAt() != null ? m.getCreatedAt() : Instant.EPOCH;
        return new Flair3dCampanha.Jogada(etapa, m.getPontos() == null ? 0 : m.getPontos(), m.getEstrelas() == null ? 0 : m.getEstrelas(),
                r == null ? null : r.resultado(), quando);
    }

    /** A rodada da partida; partida antiga, sem rodada gravada, jogou o objetivo mais simples. */
    private static String rodada(Definicao d, Flair3dMatch m) {
        String gravada = Andamento.ler(m.getEstadoJson()).rodada();
        return gravada == null ? d.objetivo().codigo() : gravada;
    }

    /** A opção respondida na entrega (a modalidade); sem resposta válida, a primeira opção, como o jogo faz. */
    private static String opcao(Definicao d, Flair3dMatch m) {
        Entrega e = m.getEntregaJson() == null ? null : Json.read(m.getEntregaJson(), Entrega.class);
        String resposta = e == null ? null : e.resposta();
        return resposta != null && d.opcoes().contains(resposta) ? resposta : d.opcoes().get(0);
    }
}
