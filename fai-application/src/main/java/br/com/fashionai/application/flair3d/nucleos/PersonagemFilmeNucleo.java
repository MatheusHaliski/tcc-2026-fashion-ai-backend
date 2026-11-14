package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Núcleo 4 — vestir o "detetive noir" (casaco; cores preto, bege ou cinza: 12,5 por peça) e acertar o filme entre 4
 * títulos inventados (50). O título certo é o noir, {@link #CERTO}.
 */
public class PersonagemFilmeNucleo implements Flair3dNucleo {
    public static final double TITULO = 50;
    public static final double POR_PECA = 12.5;
    public static final String CERTO = "FILME_SOMBRAS_NA_CHUVA";
    public static final List<String> OPCOES = List.of(CERTO, "FILME_VERAO_EM_NEON", "FILME_GALAXIA_DOURADA", "FILME_BAILE_DAS_FLORES");
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");
    public static final Set<String> CASACOS = Set.of("coat", "parka", "jacket", "blazer");

    @Override
    public String codigo() {
        return "PERSONAGEM_FILME";
    }

    @Override
    public int numero() {
        return 4;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("DETETIVE_NOIR", new Regra("TITULO", TITULO), new Regra("FIGURINO", POR_PECA)),
                List.of(Definicao.CARTAS, Definicao.RESPOSTA), VAGAS, Deck.ate(8, Obrigatoria.uma("SUP")), false)
                .comOpcoes(OPCOES).comAvatares(Avatares.solo(new Avatares.Online(2, 4, null)));
    }

    static boolean bate(CbcRules.Card c) {
        return Flair3dPecas.subcategoria(c, CASACOS) || Flair3dPecas.daFamilia(c, Set.of("Preto", "Cinza"))
                || Flair3dPecas.temCor(c, "beige");
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        List<RegraResultado> regras = new ArrayList<>();
        regras.add(RegraResultado.de("TITULO", CERTO.equals(entrega.resposta()), TITULO));
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        regras.addAll(Flair3dPecas.porVaga(VAGAS, vestidas, "FIGURINO", POR_PECA, PersonagemFilmeNucleo::bate));
        return Resultado.somando(regras, List.of())
                .comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, PersonagemFilmeNucleo::bate).lista());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return bate(carta) ? List.of(new Efeito("FIGURINO", POR_PECA)) : List.of(Efeito.motivo("FORA_DO_FIGURINO"));
    }
}
