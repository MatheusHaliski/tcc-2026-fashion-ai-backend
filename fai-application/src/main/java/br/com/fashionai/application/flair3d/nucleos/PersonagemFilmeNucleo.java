package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Definicao.Rodada;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Núcleo 4 — vestir o personagem (12,5 por peça do figurino, 4 vagas) e acertar a resposta entre 4 (50). O objetivo mais
 * simples é o "detetive noir", cujo título certo é {@link #CERTO}. Na rodada "cena sorteada" o personagem sai da semente
 * entre 4, cada um com o seu título inventado; em "Adivinhe a Década" a pessoa veste a década sorteada e escolhe qual é
 * entre 4. As pistas são texto da tela ({@code cena}); nenhum filme real é citado.
 */
public class PersonagemFilmeNucleo implements Flair3dNucleo {
    public static final double TITULO = 50;
    public static final double POR_PECA = 12.5;
    public static final String CERTO = "FILME_SOMBRAS_NA_CHUVA";
    public static final List<String> OPCOES = List.of(CERTO, "FILME_VERAO_EM_NEON", "FILME_GALAXIA_DOURADA", "FILME_BAILE_DAS_FLORES");
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");
    public static final Set<String> CASACOS = Set.of("coat", "parka", "jacket", "blazer");
    public static final String CENA_SORTEADA = "CENA_SORTEADA";
    public static final String DECADA = "ADIVINHE_A_DECADA";

    /** Uma cena para adivinhar: o código das pistas, a resposta certa e o figurino. */
    record Cena(String codigo, String resposta, Predicate<CbcRules.Card> figurino) {
    }

    private static Predicate<CbcRules.Card> perfil(Set<String> estilos, Set<String> familias) {
        return c -> Flair3dPecas.temEstilo(c, estilos) || Flair3dPecas.daFamilia(c, familias);
    }

    static final List<Cena> CENAS = List.of(new Cena("CENA_1", CERTO, PersonagemFilmeNucleo::bate),
            new Cena("CENA_2", "FILME_VERAO_EM_NEON", perfil(Set.of("y2k", "streetwear", "sporty"), Set.of("Rosa", "Amarelo", "Laranja", "Verde"))),
            new Cena("CENA_3", "FILME_GALAXIA_DOURADA", perfil(Set.of("futuristic", "techwear", "avant_garde"), Set.of("Branco", "Cinza", "Amarelo"))),
            new Cena("CENA_4", "FILME_BAILE_DAS_FLORES", perfil(Set.of("romantic", "chic", "glam"), Set.of("Rosa", "Vermelho", "Roxo"))));

    public static final List<String> DECADAS = List.of("ANOS_70", "ANOS_80", "ANOS_90", "ANOS_2000");

    static final List<Cena> EPOCAS = List.of(new Cena("DECADA_1", "ANOS_70", perfil(Set.of("boho", "vintage"), Set.of("Laranja", "Marrom", "Amarelo"))),
            new Cena("DECADA_2", "ANOS_80", perfil(Set.of("glam", "statement", "sporty"), Set.of("Rosa", "Roxo", "Azul"))),
            new Cena("DECADA_3", "ANOS_90", perfil(Set.of("grunge", "minimalist", "streetwear"), Set.of("Preto", "Cinza"))),
            new Cena("DECADA_4", "ANOS_2000", perfil(Set.of("y2k", "glam"), Set.of("Rosa", "Branco"))));

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
                .comOpcoes(OPCOES).comAvatares(Avatares.solo(new Avatares.Online(2, 4, null)))
                .comRodadas(Rodada.de(CENA_SORTEADA, new Regra("TITULO", TITULO), new Regra("FIGURINO", POR_PECA)).comOpcoes(OPCOES),
                        Rodada.de(DECADA, new Regra("DECADA", TITULO), new Regra("FIGURINO", POR_PECA)).comOpcoes(DECADAS));
    }

    static boolean bate(CbcRules.Card c) {
        return Flair3dPecas.subcategoria(c, CASACOS) || Flair3dPecas.daFamilia(c, Set.of("Preto", "Cinza"))
                || Flair3dPecas.temCor(c, "beige");
    }

    /** A cena da partida: a da rodada sorteada, a década sorteada ou, na base, o detetive noir. */
    static Cena cena(Contexto contexto) {
        if (CENA_SORTEADA.equals(contexto.rodada())) {
            return contexto.sortear("cena", CENAS);
        }
        return DECADA.equals(contexto.rodada()) ? contexto.sortear("decada", EPOCAS) : CENAS.get(0);
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        return contexto.rodada() == null ? Map.of() : Map.of("cena", cena(contexto).codigo());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Cena cena = cena(contexto);
        boolean certa = cena.resposta().equals(entrega.resposta());
        List<RegraResultado> regras = new ArrayList<>();
        regras.add(RegraResultado.de(DECADA.equals(contexto.rodada()) ? "DECADA" : "TITULO", certa, TITULO));
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        regras.addAll(Flair3dPecas.porVaga(VAGAS, vestidas, "FIGURINO", POR_PECA, cena.figurino()));
        List<Evento> eventos = contexto.rodada() == null ? List.of() : List.of(new Evento("RESPOSTA_CERTA", cena.resposta()));
        return Resultado.somando(regras, eventos).comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, cena.figurino()).lista());
    }

    /** A prévia nunca diz a resposta certa: só o figurino conta nela. */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        if (contexto.rodada() == null) {
            return pontuar(entrega, contexto);
        }
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Cena cena = cena(contexto);
        return Resultado.of(Flair3dPecas.quantas(vestidas.values(), cena.figurino()) * POR_PECA, Resultado.EM_PREPARO,
                Flair3dPecas.porVaga(VAGAS, vestidas, "FIGURINO", POR_PECA, cena.figurino()), List.of())
                .comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, cena.figurino()).lista());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        boolean sorteada = CENA_SORTEADA.equals(contexto.rodada()) || DECADA.equals(contexto.rodada());
        if (sorteada && !contexto.emPartida()) {
            return List.of(Efeito.conformeAEtapa());
        }
        return cena(contexto).figurino().test(carta) ? List.of(new Efeito("FIGURINO", POR_PECA)) : List.of(Efeito.motivo("FORA_DO_FIGURINO"));
    }
}
