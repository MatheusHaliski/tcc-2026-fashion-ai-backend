package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dBeleza;
import br.com.fashionai.application.flair3d.Flair3dJogadaDeCena;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Núcleo 5 — Road to Glory. O look (roupa e maquiagem, 25 por regra do brief da rodada: {@link RoadToGloryLook}) e, depois
 * dele, a sessão de fotos: a fotógrafa pede uma luz (a cor sai da semente) e a pessoa joga uma carta do guarda-roupa
 * que não está no look; a cor da carta é a luz que acende (tabela ROAD_TO_GLORY de Flair3dCores), e a cor pedida soma 10
 * ({@link Flair3dJogadaDeCena}, o mesmo Decorator da Passarela). Quando as regras somam mais de 100, o evento TETO diz
 * que a nota fica em 100. Sem deck (guarda-roupa liberado). As 4 regras do Ensaio de Verão ({@link #regras}) valem também
 * no brief ENSAIO_VERAO do MAKE UP.
 */
public class RoadToGloryNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final Set<String> OCASIOES = Set.of("casual", "beach");
    public static final String TETO = "TETO";

    private final Flair3dNucleo look = new RoadToGloryLook();
    private final Flair3dNucleo sessao = new Flair3dJogadaDeCena(look);

    @Override
    public String codigo() {
        return look.codigo();
    }

    @Override
    public int numero() {
        return look.numero();
    }

    @Override
    public Definicao definicao() {
        return look.definicao();
    }

    /** As 4 regras do Ensaio de Verão sobre as peças vestidas e a maquiagem. */
    public static List<RegraResultado> regras(Collection<CbcRules.Card> pecas, Entrega entrega) {
        List<RegraResultado> out = new ArrayList<>();
        out.add(RegraResultado.de("OCASIAO", Flair3dPecas.todas(pecas, c -> Flair3dPecas.temOcasiao(c, OCASIOES)), POR_REGRA));
        out.add(RegraResultado.de("MATERIAL_LEVE", Flair3dPecas.todas(pecas, Flair3dPecas::leve), POR_REGRA));
        out.add(RegraResultado.de("BATOM_CORAL", Flair3dBeleza.familia(entrega, Flair3dBeleza.LABIOS, "CORAL"), POR_REGRA));
        out.add(RegraResultado.de("ACABAMENTO_BATOM", Flair3dBeleza.acabamento(entrega, Flair3dBeleza.LABIOS, "GLOSS", "CETIM"), POR_REGRA));
        return out;
    }

    /** O look e a sessão de fotos; a prévia ({@link #previa}) mostra só a nota do look, sem abrir a sessão. */
    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        return comTeto(sessao.pontuar(entrega, contexto));
    }

    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        return look.pontuar(entrega, contexto);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return look.efeitos(carta, contexto);
    }

    /** A conta da nota quando o look perfeito ainda acerta a luz: as regras somam 110 e a nota fica em 100. */
    static Resultado comTeto(Resultado r) {
        double soma = r.regras().stream().mapToDouble(RegraResultado::pontos).sum();
        if (!r.fecha() || soma <= 100) {
            return r;
        }
        List<Evento> eventos = new ArrayList<>(r.eventos());
        eventos.add(new Evento(TETO, Map.of("soma", soma)));
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), eventos, r.cartas(), r.status());
    }
}
