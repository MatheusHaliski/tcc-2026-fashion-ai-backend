package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoNoMotor;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.detetive.DetetiveCaso;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Núcleo 6 — desde 15/11/2026 o caso "A Coleção Maré" (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): a entrega
 * veste o look da gala e a partida fica EM_ACAO; cada acionamento é um passo da investigação pelas nove salas
 * ({@link DetetivePartida}), até a acusação na passarela. A definição de 14/11 continua como a rodada
 * {@link #SALOES_DA_GALA}: o caso em 6 salões ({@link FashionDetectiveCaso}): a cada entrega a pessoa veste o look de um salão, e o
 * detetive entra, enfrenta o desafio e procura a pista sozinho ({@link FashionDetectiveSalao}). A partida segue ABERTA
 * até o sexto salão; depois do terceiro ela para no mercado (EM_ACAO), onde a pessoa pode deixar uma carta no balcão
 * ({@link FashionDetectiveMercado}). A nota é a média dos salões; com 5 pistas ou mais o caso é resolvido (FAVORAVEL), com
 * 3 ou 4 é resolvido em parte (PARCIAL).
 */
public class FashionDetectiveNucleo implements Flair3dNucleo {
    public static final int SALOES = FashionDetectiveCaso.SALOES.size();
    public static final int PISTAS_DO_CASO = 5;
    public static final int PISTAS_DE_PARTE = 3;
    /** A rodada da definição de 14/11 (6 salões automáticos e o mercado). */
    public static final String SALOES_DA_GALA = "SALOES_DA_GALA";

    @Override
    public String codigo() {
        return "FASHION_DETECTIVE";
    }

    @Override
    public int numero() {
        return 6;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                DetetiveCaso.OBJETIVO, List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(12, Obrigatoria.uma("SUP|VES")), false)
                .comAvatares(Avatares.solo(null, Avatares.figurante("SEGURANCA", 1)))
                .comRodadas(new Definicao.Rodada(SALOES_DA_GALA, Definicao.objetivo("CASO_DA_GALA", new Regra("ACESSO", FashionDetectiveSalao.ACESSO),
                        new Regra("DESAFIO_DEFESA", FashionDetectiveSalao.DESAFIO), new Regra("PISTA", FashionDetectiveSalao.PISTA)), null, null));
    }

    private static Map<String, CbcRules.Card> look(Map<String, UUID> cartas, Contexto contexto) {
        return contexto.vestidas(new Entrega(cartas, null, null, null));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        if (!SALOES_DA_GALA.equals(contexto.rodada())) {
            return DetetiveCaso.pontuar(look(entrega.cartas(), contexto), contexto);
        }
        FashionDetectiveMercado bolsa = new FashionDetectiveMercado();
        List<Andamento.Etapa> etapas = new ArrayList<>(contexto.andamento().anteriores());
        etapas.add(new Andamento.Etapa(entrega.cartas(), contexto.andamento().acionamentos()));
        int numero = Math.min(etapas.size(), SALOES);
        int soma = 0;
        int acessos = 0;
        int desafios = 0;
        int pistas = 0;
        FashionDetectiveSalao atual = null;
        List<Evento> eventos = new ArrayList<>();
        for (int i = 1; i <= numero; i++) {
            Andamento.Etapa etapa = etapas.get(etapas.size() - numero + i - 1);
            List<Andamento.UsoDeRecurso> usos = contexto.andamento().usos();
            atual = new FashionDetectiveSalao(i, look(etapa.cartas(), contexto), bolsa,
                    Flair3dRecursoNoMotor.naEtapa(usos, "VIDA", i - 1), Flair3dRecursoNoMotor.naEtapa(usos, "FOCO", i - 1));
            bolsa.ganhar(atual.estalecas());
            soma += atual.pontos();
            acessos += atual.acesso ? 1 : 0;
            desafios += atual.desafio ? 1 : 0;
            pistas += atual.pista ? 1 : 0;
            boolean ultimo = i == numero;
            if (ultimo) {
                eventos.addAll(atual.medidores());
                eventos.add(new Evento("PISTA", atual.pista));
            }
            if (i == FashionDetectiveCaso.SALAO_DO_MERCADO) {
                if (etapa.acionamentos().isEmpty()) {
                    eventos.add(new Evento("MERCADO", bolsa.estalecas()));
                    return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
                }
                List<Evento> compras = ultimo ? eventos : new ArrayList<>();
                bolsa.vender(etapa.acionamentos().get(0), atual.look, contexto, compras);
                bolsa.comprar(faltaACor(i + 1, contexto), atual.desafio, atual.movelAbriu, compras);
            }
        }
        eventos.add(new Evento("PISTAS", pistas));
        eventos.add(new Evento("ESTALECAS", bolsa.estalecas()));
        if (numero < SALOES) {
            eventos.add(new Evento("PONTOS_DO_SALAO", atual.pontos()));
            eventos.add(new Evento("PROXIMO_SALAO", Map.of("salao", numero + 1, "codigo", FashionDetectiveCaso.salao(numero + 1).codigo())));
            return Resultado.parcial(Resultado.ABERTA, atual.resultado(), atual.regras(), eventos);
        }
        double pontos = soma / (double) SALOES;
        String resultado = pistas >= PISTAS_DO_CASO ? "FAVORAVEL" : pistas >= PISTAS_DE_PARTE ? "PARCIAL" : "DESFAVORAVEL";
        List<RegraResultado> regras = List.of(media("ACESSO", acessos, FashionDetectiveSalao.ACESSO),
                media("DESAFIO_DEFESA", desafios, FashionDetectiveSalao.DESAFIO), media("PISTA", pistas, FashionDetectiveSalao.PISTA));
        FashionDetectiveCaso.Salao ultimo = atual.salao;
        Flair3dRateio rateio = new Flair3dRateio(atual.look).dividirEntre(pontos / 2, c -> Flair3dPecas.temOcasiao(c, ultimo.ocasioes()))
                .dividir(pontos / 2, c -> Flair3dAtributos.daCarta(c).defesa());
        return Resultado.of(pontos, resultado, regras, eventos).comCartas(rateio.lista());
    }

    /** A regra do caso inteiro: quantos salões a cumpriram, valendo a média. */
    private static RegraResultado media(String codigo, int salas, int valor) {
        return new RegraResultado(codigo, salas >= PISTAS_DO_CASO, valor * salas / (double) SALOES);
    }

    /** Nenhuma carta do deck em mãos tem a cor da pista do salão dado, numa vaga que serve. */
    private static boolean faltaACor(int salao, Contexto contexto) {
        FashionDetectiveCaso.Salao s = FashionDetectiveCaso.salao(salao);
        return contexto.cartas().values().stream().noneMatch(c -> s.vagas().contains(c.position()) && Flair3dPecas.daFamilia(c, s.cor()));
    }

    /** Só os medidores do salão da vez (o caso não anda na prévia). */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        int numero = Math.min(contexto.andamento().anteriores().size() + 1, SALOES);
        List<Andamento.UsoDeRecurso> usos = contexto.andamento().usos();
        FashionDetectiveSalao s = new FashionDetectiveSalao(numero, contexto.vestidas(entrega), new FashionDetectiveMercado(),
                Flair3dRecursoNoMotor.naEtapa(usos, "VIDA", numero - 1), Flair3dRecursoNoMotor.naEtapa(usos, "FOCO", numero - 1));
        return Resultado.parcial(null, "PREVIA", List.of(), s.medidores().subList(1, s.medidores().size()));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        List<Efeito> out = new ArrayList<>(List.of(new Efeito("DEFESA", Flair3dAtributos.daCarta(carta).defesa())));
        String acao = Flair3dCores.acao(Flair3dCores.DETETIVE, carta);
        if (acao != null) {
            out.add(new Efeito("COR_" + acao, 1));
        }
        return out;
    }
}
