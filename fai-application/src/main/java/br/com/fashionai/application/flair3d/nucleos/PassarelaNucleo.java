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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Núcleo 1 — vestir o tema com as cartas do deck: +10 por peça no tema, +20 se todas as vagas preenchidas estão no tema;
 * 70 vira 100. O objetivo mais simples é o tema "Brasil" (marcas brasileiras). Na rodada "tema surpresa" o tema sai da
 * semente (noite, monocromático ou clássico) e só aparece depois que a pessoa entra na partida; as outras rodadas são treinos de tema fixo. Em toda rodada
 * a pessoa desfila contra 3 desfiles da casa, com notas tiradas da semente, e o resultado traz a colocação.
 */
public class PassarelaNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 10;
    public static final double TODAS = 20;
    public static final double MAXIMO = 70;
    public static final String SURPRESA = "TEMA_SURPRESA";
    public static final List<String> TEMAS = List.of("TEMA_BRASIL", "TEMA_NOITE", "TEMA_MONOCROMATICO", "TEMA_CLASSICO");
    /**
     * Os temas que a surpresa sorteia: sem o Brasil, que pede marca brasileira e não tem como ser cumprido com peças sem
     * marca (auditoria 3); ele continua como treino e como objetivo da base.
     */
    public static final List<String> SURPRESAS = TEMAS.subList(1, TEMAS.size());
    public static final int DESFILES_DA_CASA = 3;
    /** Notas brutas (de 0 a 70) que um desfile da casa pode tirar. */
    static final List<Integer> NOTAS_DA_CASA = List.of(20, 30, 40, 50, 60);

    @Override
    public String codigo() {
        return "PASSARELA";
    }

    @Override
    public int numero() {
        return 1;
    }

    @Override
    public Definicao definicao() {
        Regra[] doTema = {new Regra("NO_TEMA", POR_PECA), new Regra("TUDO_NO_TEMA", TODAS)};
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("TEMA_BRASIL", new Regra("MARCA_BR", POR_PECA), new Regra("TODAS_BR", TODAS)),
                List.of(Definicao.CARTAS), Definicao.VAGAS,
                Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), true)
                .comAvatares(Avatares.solo(new Avatares.Online(4, 8, null), Avatares.figurante("PLATEIA", 12), Avatares.figurante("FOTOGRAFO", 2)))
                .comRodadas(Rodada.de("TEMA_NOITE", doTema), Rodada.de("TEMA_MONOCROMATICO", doTema), Rodada.de("TEMA_CLASSICO", doTema))
                .comRodadaNaFrente(Rodada.de(SURPRESA, doTema));
    }

    /** O tema da partida: o da rodada ou, na surpresa, o sorteado; sem rodada, o da base. */
    static String tema(Contexto contexto) {
        String rodada = contexto.rodada();
        if (SURPRESA.equals(rodada)) {
            return contexto.sortear("tema", SURPRESAS);
        }
        return rodada == null ? TEMAS.get(0) : rodada;
    }

    /** A peça está no tema? No monocromático, o tema é a família de cor mais vestida no look. */
    static Predicate<CbcRules.Card> noTema(String tema, Map<String, CbcRules.Card> look, Contexto contexto) {
        return switch (tema) {
            case "TEMA_NOITE" -> c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.FESTA);
            case "TEMA_CLASSICO" -> c -> Flair3dPecas.temEstilo(c, Set.of("classic"));
            case "TEMA_MONOCROMATICO" -> {
                String familia = Flair3dPecas.maiorGrupo(look.values(), Flair3dPecas::familias).getKey();
                yield c -> Flair3dPecas.daFamilia(c, familia);
            }
            default -> contexto::brasileira;
        };
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        return contexto.rodada() == null ? Map.of() : Map.of("tema", tema(contexto));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Predicate<CbcRules.Card> noTema = noTema(tema(contexto), vestidas, contexto);
        long certas = vestidas.values().stream().filter(noTema).count();
        boolean todas = !vestidas.isEmpty() && certas == vestidas.size();
        boolean base = contexto.rodada() == null || TEMAS.get(0).equals(contexto.rodada());
        List<RegraResultado> regras = List.of(RegraResultado.de(base ? "MARCA_BR" : "NO_TEMA", certas > 0, POR_PECA * certas),
                RegraResultado.de(base ? "TODAS_BR" : "TUDO_NO_TEMA", todas, TODAS));
        double bruto = POR_PECA * certas + (todas ? TODAS : 0);
        double pontos = Math.min(100, bruto * 100 / MAXIMO);
        double fator = 100 / MAXIMO;
        Flair3dRateio rateio = new Flair3dRateio(vestidas).cada(POR_PECA * fator, noTema).dividirEntre(todas ? TODAS * fator : 0, noTema);
        List<Evento> eventos = contexto.rodada() == null ? List.of() : sala(contexto, (int) Math.round(pontos));
        return Resultado.of(pontos, pontos >= 60 ? "APROVADO" : "REPROVADO", regras, eventos).comCartas(rateio.lista());
    }

    /** A prévia não mostra os desfiles da casa: a colocação só sai na entrega. */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Resultado r = pontuar(entrega, contexto);
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), List.of(), r.cartas(), r.status());
    }

    /** O tema, a nota de cada desfile da casa e a colocação da pessoa (no empate de nota, ela fica na frente). */
    static List<Evento> sala(Contexto contexto, int pontos) {
        List<Evento> out = new ArrayList<>(List.of(new Evento("TEMA", tema(contexto))));
        int lugar = 1;
        for (int i = 1; i <= DESFILES_DA_CASA; i++) {
            int nota = (int) Math.round(contexto.sortear("desfile" + i, NOTAS_DA_CASA) * 100 / MAXIMO);
            lugar += nota > pontos ? 1 : 0;
            Map<String, Object> desfile = new LinkedHashMap<>();
            desfile.put("numero", i);
            desfile.put("pontos", nota);
            out.add(new Evento("DESFILE_DA_CASA", desfile));
        }
        Map<String, Object> colocacao = new LinkedHashMap<>();
        colocacao.put("lugar", lugar);
        colocacao.put("total", DESFILES_DA_CASA + 1);
        out.add(new Evento("COLOCACAO", colocacao));
        return out;
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        String rodada = contexto.rodada();
        if (rodada == null || TEMAS.get(0).equals(rodada)) {
            return contexto.brasileira(carta) ? List.of(new Efeito("MARCA_BR", POR_PECA)) : List.of(Efeito.motivo("MARCA_NAO_BR"));
        }
        if (SURPRESA.equals(rodada) && !contexto.emPartida()) {
            return List.of(new Efeito("TEMA_SURPRESA", 1));
        }
        String tema = tema(contexto);
        if ("TEMA_MONOCROMATICO".equals(tema)) {
            List<Efeito> familias = Flair3dPecas.familias(carta).stream().map(f -> new Efeito(LabirintoNucleo.codigoFamilia(f), 1)).toList();
            return familias.isEmpty() ? List.of(Efeito.motivo("SEM_FAMILIA_DE_COR")) : familias;
        }
        return noTema(tema, Map.of(), contexto).test(carta) ? List.of(new Efeito("NO_TEMA", POR_PECA)) : List.of(Efeito.motivo("FORA_DO_TEMA"));
    }
}
