package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBrief;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBriefs;

import java.util.List;

/**
 * O look do Road to Glory: roupa e maquiagem avaliadas pelo brief da rodada (os três briefs do MAKE UP, com o Ensaio de
 * Verão de rodada padrão). A nota, a explicação das regras de roupa e o selo de cada carta vêm do brief da rodada: uma
 * carta casual não leva selo de ocasião na Entrevista. A sessão de fotos que vem depois é do {@link RoadToGloryNucleo}.
 */
final class RoadToGloryLook implements Flair3dNucleo {
    static final String PADRAO = "ENSAIO_VERAO";

    /** O brief da rodada; rodada nula ou desconhecida é o Ensaio de Verão. */
    static FlairMakeUpBrief brief(String rodada) {
        return FlairMakeUpBriefs.porCodigo(rodada).orElseGet(() -> FlairMakeUpBriefs.porCodigo(PADRAO).orElseThrow());
    }

    @Override
    public String codigo() {
        return "ROAD_TO_GLORY";
    }

    @Override
    public int numero() {
        return 5;
    }

    @Override
    public Definicao definicao() {
        FlairMakeUpBrief padrao = brief(PADRAO);
        Definicao.Rodada[] outras = FlairMakeUpBriefs.TODOS.stream().filter(b -> !PADRAO.equals(b.codigo()))
                .map(b -> new Definicao.Rodada(b.codigo(), new Definicao.Objetivo(b.codigo(), b.regras()), List.of(), List.of()))
                .toArray(Definicao.Rodada[]::new);
        return Definicao.cartas(codigo(), numero(), new Definicao.Objetivo(PADRAO, padrao.regras()),
                List.of(Definicao.CARTAS, Definicao.MAQUIAGEM), Definicao.VAGAS, Deck.SEM_DECK, false)
                .comAreas(Definicao.AREAS)
                .comRodadas(outras)
                .comAvatares(new Avatares(List.of(new Avatares.Solo(Avatares.PROPRIO, Avatares.PROTAGONISTA, 1),
                        new Avatares.Solo(Avatares.MODELO_CASA, Avatares.PROTAGONISTA, 1)), null));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        return brief(contexto.rodada()).pontuar(entrega, contexto);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return brief(contexto.rodada()).efeitos(carta);
    }
}
