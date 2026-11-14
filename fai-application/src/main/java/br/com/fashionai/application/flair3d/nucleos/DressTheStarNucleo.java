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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Núcleo 3 — vestir a estrela: 25 por peça que bate o perfil dela (4 vagas). O objetivo mais simples é a "Estrela Pop dos
 * anos 2000" (estilos y2k ou glam; cores rosa ou prata). No Modo Stylist a estrela é sorteada entre 4 perfis inventados
 * (época e estilo, sem nome nem imagem de ninguém) e a plateia da casa adivinha pelo figurino: cada peça fora do perfil
 * abre uma pista. No Look Relâmpago a pessoa vê por 10 segundos um look montado com cartas do próprio deck e o recria: 25
 * por vaga igual em tipo de peça e família de cor.
 */
public class DressTheStarNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 25;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");
    public static final Set<String> ESTILOS = Set.of("y2k", "glam");
    public static final String STYLIST = "MODO_STYLIST";
    public static final String RELAMPAGO = "LOOK_RELAMPAGO";
    public static final int SEGUNDOS_DO_ALVO = 10;
    public static final int PISTAS = 3;

    /** O perfil de estilo de uma estrela: estilos e famílias de cor. */
    record Estrela(String codigo, Set<String> estilos, Set<String> familias) {
        boolean bate(CbcRules.Card c) {
            return Flair3dPecas.temEstilo(c, estilos) || Flair3dPecas.daFamilia(c, familias);
        }
    }

    static final List<Estrela> ESTRELAS = List.of(new Estrela("ESTRELA_POP_2000", ESTILOS, Set.of("Rosa")),
            new Estrela("ESTRELA_ROCK_80", Set.of("edgy", "grunge", "vintage"), Set.of("Preto", "Vermelho")),
            new Estrela("ESTRELA_DISCO_70", Set.of("glam", "boho", "statement"), Set.of("Amarelo", "Roxo", "Laranja")),
            new Estrela("ESTRELA_MINIMAL_90", Set.of("minimalist", "basic", "classic"), Set.of("Branco", "Cinza")));

    @Override
    public String codigo() {
        return "DRESS_THE_STAR";
    }

    @Override
    public int numero() {
        return 3;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("ESTRELA_POP_2000", new Regra("FIGURINO", POR_PECA)),
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF")), true)
                .comAvatares(Avatares.solo(new Avatares.Online(3, 8, null)))
                .comRodadas(Rodada.de(STYLIST, new Regra("FIGURINO", POR_PECA)), Rodada.de(RELAMPAGO, new Regra("IGUAL", POR_PECA)));
    }

    static boolean bate(CbcRules.Card c) {
        return Flair3dPecas.temEstilo(c, ESTILOS) || Flair3dPecas.daFamilia(c, "Rosa") || Flair3dPecas.temCor(c, "silver", "metallic_silver");
    }

    /** A estrela do Modo Stylist, tirada da semente. */
    static Estrela estrela(Contexto contexto) {
        return contexto.sortear("estrela", ESTRELAS);
    }

    /** O look-alvo do Look Relâmpago: uma carta do deck por vaga, tirada da semente (vaga sem carta no deck fica de fora). */
    static Map<String, CbcRules.Card> alvo(Contexto contexto) {
        Map<String, CbcRules.Card> out = new LinkedHashMap<>();
        for (String vaga : VAGAS) {
            List<CbcRules.Card> daVaga = new ArrayList<>(contexto.deck().values().stream().filter(c -> vaga.equals(c.position())).toList());
            daVaga.sort(Comparator.comparing(c -> c.id().toString()));
            if (!daVaga.isEmpty()) {
                out.put(vaga, contexto.sortear("alvo" + vaga, daVaga));
            }
        }
        return out;
    }

    /** A peça vestida repete a do alvo: a mesma carta, ou o mesmo tipo de peça com uma família de cor em comum. */
    static boolean igual(CbcRules.Card vestida, CbcRules.Card alvo) {
        if (vestida == null || alvo == null) {
            return false;
        }
        boolean tipo = Objects.equals(vestida.subcategory(), alvo.subcategory());
        boolean cor = Flair3dPecas.familias(alvo).isEmpty() || Flair3dPecas.familias(vestida).stream().anyMatch(Flair3dPecas.familias(alvo)::contains);
        return vestida.id().equals(alvo.id()) || (tipo && cor);
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        if (STYLIST.equals(contexto.rodada())) {
            return Map.of("estrela", estrela(contexto).codigo(), "pistas", PISTAS);
        }
        if (!RELAMPAGO.equals(contexto.rodada())) {
            return Map.of();
        }
        Map<String, Object> cartas = new LinkedHashMap<>();
        alvo(contexto).forEach((vaga, c) -> cartas.put(vaga, c.id()));
        return Map.of("alvo", cartas, "segundos", SEGUNDOS_DO_ALVO);
    }

    private static Resultado relampago(Map<String, CbcRules.Card> vestidas, Contexto contexto) {
        Map<String, CbcRules.Card> alvo = alvo(contexto);
        double valor = alvo.isEmpty() ? 0 : 100.0 / alvo.size();
        List<RegraResultado> regras = new ArrayList<>();
        alvo.forEach((vaga, c) -> regras.add(RegraResultado.de("IGUAL_" + vaga, igual(vestidas.get(vaga), c), valor)));
        return Resultado.somando(regras, List.of(new Evento("VAGAS_IGUAIS", regras.stream().filter(RegraResultado::ok).count())))
                .comCartas(new Flair3dRateio(vestidas).cada(valor, c -> igual(c, alvo.get(c.position()))).lista());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        if (RELAMPAGO.equals(contexto.rodada())) {
            return relampago(vestidas, contexto);
        }
        boolean stylist = STYLIST.equals(contexto.rodada());
        Predicate<CbcRules.Card> bate = stylist ? estrela(contexto)::bate : DressTheStarNucleo::bate;
        List<RegraResultado> regras = Flair3dPecas.porVaga(VAGAS, vestidas, "FIGURINO", POR_PECA, bate);
        List<Evento> eventos = new ArrayList<>();
        if (stylist) {
            long certas = regras.stream().filter(RegraResultado::ok).count();
            eventos.add(new Evento("ESTRELA", estrela(contexto).codigo()));
            eventos.add(new Evento(certas == 0 ? "PLATEIA_NAO_ADIVINHOU" : "PISTAS_ABERTAS", Math.min(PISTAS, VAGAS.size() - certas)));
        }
        return Resultado.somando(regras, eventos).comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, bate).lista());
    }

    /** A prévia do Modo Stylist não diz quantas pistas a plateia abriu: isso só sai no desfile. */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Resultado r = pontuar(entrega, contexto);
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), List.of(), r.cartas(), r.status());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        if (RELAMPAGO.equals(contexto.rodada()) || (STYLIST.equals(contexto.rodada()) && !contexto.emPartida())) {
            return List.of(Efeito.conformeAEtapa());
        }
        boolean certa = STYLIST.equals(contexto.rodada()) ? estrela(contexto).bate(carta) : bate(carta);
        return certa ? List.of(new Efeito("FIGURINO", POR_PECA)) : List.of(Efeito.motivo("FORA_DO_FIGURINO"));
    }
}
