package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FASHION_SPORTS jogado por cartas: a partida anda uma jogada por acionamento, a cor da carta decide a ação, o poder
 * dela decide o duelo, sem carta o time não faz nada de útil, o relógio e o placar seguem os lances, o cansaço pesa no
 * segundo tempo e a mesma semente com as mesmas cartas dá sempre a mesma partida.
 */
class EsportePartidaTest {
    final CbcRules.Card sup = card("SUP", "ovr:70", "material:cotton");
    final CbcRules.Card inf = card("INF", "ovr:70");
    final CbcRules.Card cal = card("CAL", "ovr:70", "sub:running_shoes");
    final CbcRules.Card passe = card("ACE", "color:red", "ovr:90", "tier:OURO");
    final CbcRules.Card corrida = card("CAL", "color:blue", "ovr:90", "tier:OURO", "sub:running_shoes");
    final CbcRules.Card drible = card("ACE", "color:yellow", "ovr:90", "tier:OURO");
    final CbcRules.Card chute = card("SUP", "color:green", "ovr:95", "tier:ESPECIAL", "material:leather");
    final CbcRules.Card desarme = card("INF", "color:black", "ovr:95", "tier:ESPECIAL", "material:leather");
    final CbcRules.Card goleiro = card("ACE", "color:white", "ovr:90", "tier:OURO");
    final CbcRules.Card semCor = card("ACE", "ovr:60");
    final CbcRules.Card[] deck = {sup, inf, cal, passe, corrida, drible, chute, desarme, goleiro, semCor};
    final FashionSportsNucleo nucleo = new FashionSportsNucleo();

    Contexto contexto(long semente, List<Acionamento> acionamentos) {
        return Flair3dFixtures.contexto(semente, deck).comAndamento(new Andamento(1, acionamentos));
    }

    Resultado jogar(long semente, String modalidade, List<Acionamento> acionamentos) {
        return nucleo.pontuar(new br.com.fashionai.application.flair3d.Entrega(vestir(sup, inf, cal).cartas(), null, null, modalidade), contexto(semente, acionamentos));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> situacao(Resultado r) {
        return (Map<String, Object>) r.eventos().get(r.eventos().size() - 1).valor();
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> jogadas(Resultado r) {
        return r.eventos().stream().filter(e -> e.codigo().equals("JOGADA")).map(e -> (Map<String, Object>) e.valor()).toList();
    }

    /** A carta da mão que serve à situação: com a bola, ataca (finaliza perto do gol); sem a bola, desarma. */
    UUID escolher(Map<String, Object> s, boolean jogarCartas) {
        if (!jogarCartas) {
            return null;
        }
        @SuppressWarnings("unchecked")
        List<UUID> mao = (List<UUID>) s.get("mao");
        boolean nossa = "NOS".equals(s.get("posse"));
        int zona = (int) s.get("zona");
        List<CbcRules.Card> ordem = nossa ? (zona >= 2 ? List.of(chute, drible, passe, corrida, semCor) : List.of(passe, corrida, drible, semCor))
                : List.of(desarme, goleiro, corrida, semCor);
        return ordem.stream().map(CbcRules.Card::id).filter(mao::contains).findFirst().orElse(mao.isEmpty() ? null : mao.get(0));
    }

    Resultado ateOFim(long semente, String modalidade, boolean jogarCartas) {
        List<Acionamento> feitos = new ArrayList<>();
        Resultado r = jogar(semente, modalidade, feitos);
        while (!r.fecha()) {
            assertThat(r.status()).isEqualTo("EM_ACAO");
            feitos.add(new Acionamento(escolher(situacao(r), jogarCartas), null));
            r = jogar(semente, modalidade, feitos);
        }
        return r;
    }

    @Test
    void entregaComecaAPartidaComASaidaAMaoDeCincoEASituacao() {
        Resultado r = jogar(3L, null, List.of());
        assertThat(r.status()).isEqualTo("EM_ACAO");
        assertThat(r.eventos().get(0)).isEqualTo(new Resultado.Evento("MODALIDADE", "FUTEBOL"));
        assertThat(jogadas(r)).hasSize(1);
        assertThat(jogadas(r).get(0)).containsEntry("tipo", "SAIDA").containsEntry("time", "NOS").containsEntry("placar", "0-0").containsEntry("relogio", 0);
        Map<String, Object> s = situacao(r);
        assertThat(s).containsEntry("jogada", 1).containsEntry("total", 16).containsEntry("tempo", 1).containsEntry("posse", "NOS").containsEntry("zona", 1);
        @SuppressWarnings("unchecked")
        List<UUID> mao = (List<UUID>) s.get("mao");
        assertThat(mao).hasSize(EsporteMao.TAMANHO).doesNotContain(sup.id(), inf.id(), cal.id());
        assertThat(s).containsEntry("baralho", 2);
        assertThat(nucleo.definicao().deck().tamanhoMax()).isEqualTo(15);
    }

    @Test
    void mesmaSementeECartasDaoAMesmaPartidaESementesDiferentesMudamOsLances() {
        Resultado a = ateOFim(11L, null, true);
        assertThat(ateOFim(11L, null, true)).isEqualTo(a);
        Set<String> placares = new HashSet<>();
        for (long semente = 1; semente <= 12; semente++) {
            placares.add((String) ateOFim(semente, null, true).eventos().stream().filter(e -> e.codigo().equals("PLACAR")).findFirst().orElseThrow().valor());
        }
        assertThat(placares.size()).isGreaterThan(1);
    }

    @Test
    void relogioAndaPorJogadaTemIntervaloEOPlacarFinalSegueOsGolsDosLances() {
        Resultado r = ateOFim(5L, null, true);
        List<Map<String, Object>> jogadas = jogadas(r);
        int anterior = 0;
        for (Map<String, Object> j : jogadas) {
            int relogio = (int) j.get("relogio");
            assertThat(relogio).isBetween(anterior, 2400);
            assertThat(j.get("tempo")).isEqualTo(relogio < 1200 ? 1 : 2);
            anterior = relogio;
        }
        long gols = jogadas.stream().filter(j -> "CHUTE_GOL".equals(j.get("tipo"))).count();
        long sofridos = jogadas.stream().filter(j -> "RIVAL_GOL".equals(j.get("tipo"))).count();
        assertThat(r.eventos()).extracting(Resultado.Evento::codigo).containsOnlyOnce("INTERVALO").containsOnlyOnce("PLACAR").containsOnlyOnce("RESUMO").doesNotContain("SITUACAO");
        assertThat(r.eventos().get(r.eventos().size() - 1)).isEqualTo(new Resultado.Evento("PLACAR", gols + "-" + sofridos));
        assertThat(jogadas.get(jogadas.size() - 1).get("placar")).isEqualTo(gols + "-" + sofridos);
        assertThat(r.resultado()).isEqualTo(gols > sofridos ? "VITORIA" : gols == sofridos ? "EMPATE" : "DERROTA");
        assertThat(r.pontos()).isEqualTo(gols > sofridos ? 100 : gols == sofridos ? 60 : 0);
        // a segunda saída é do adversário
        assertThat(jogadas.stream().filter(j -> "SAIDA".equals(j.get("tipo")) && (int) j.get("relogio") % 1200 == 0).map(j -> j.get("time")).toList()).startsWith("NOS").contains("ELES");
    }

    @Test
    void semCartaOTimePerdeABolaEOAdversarioFazOQueQuer() {
        Resultado r = jogar(3L, null, List.of(Acionamento.NENHUM));
        assertThat(jogadas(r).get(1)).containsEntry("tipo", "SEM_CARTA").containsEntry("ok", false);
        assertThat(situacao(r)).containsEntry("posse", "ELES").containsEntry("zona", 2).containsEntry("jogada", 2);
        Resultado semJogar = ateOFim(3L, null, false);
        Resultado jogando = ateOFim(3L, null, true);
        assertThat(resumo(semJogar).get("cartas")).isEqualTo(0);
        @SuppressWarnings("unchecked")
        List<Integer> posse = (List<Integer>) resumo(semJogar).get("posse");
        assertThat(posse.get(0)).isLessThan(50);
        assertThat(posse.get(0) + posse.get(1)).isEqualTo(100);
        int[] vitorias = new int[2];
        for (long semente = 1; semente <= 20; semente++) {
            vitorias[0] += "VITORIA".equals(ateOFim(semente, null, true).resultado()) ? 1 : 0;
            vitorias[1] += "VITORIA".equals(ateOFim(semente, null, false).resultado()) ? 1 : 0;
        }
        assertThat(vitorias[1]).isZero();
        assertThat(vitorias[0]).isGreaterThan(10);
        assertThat(jogando.eventos().size()).isGreaterThan(semJogar.eventos().size() - 20);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> resumo(Resultado r) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("RESUMO")).findFirst().orElseThrow().valor();
    }

    @Test
    void aCorDaCartaDecideAAcaoEOPoderVemDoNivelDoOvrEDaPeca() {
        assertThat(EsporteForcas.acao(passe)).isEqualTo("PASSE");
        assertThat(EsporteForcas.acao(corrida)).isEqualTo("CORRIDA");
        assertThat(EsporteForcas.acao(drible)).isEqualTo("DRIBLE");
        assertThat(EsporteForcas.acao(chute)).isEqualTo("CHUTE");
        assertThat(EsporteForcas.acao(desarme)).isEqualTo("DEFESA");
        assertThat(EsporteForcas.acao(goleiro)).isEqualTo("GOLEIRO");
        assertThat(EsporteForcas.acao(semCor)).isEqualTo("TOQUE");
        // corrida: 9 do OVR + 6 do Ouro + 20 do tênis
        assertThat(EsporteForcas.poder(corrida)).isEqualTo(35);
        // desarme: 9 do OVR + 10 do Especial + (defesa 9+20 e físico 9+7) / 2 − 9
        assertThat(EsporteForcas.poder(desarme)).isEqualTo(9 + 10 + (29 + 16) / 2 - 9);
        assertThat(EsporteForcas.poder(semCor)).isEqualTo(6);
        assertThat(EsporteForcas.fisico(desarme)).isEqualTo(16);
        assertThat(EsporteForcas.fisico(semCor)).isEqualTo(6);
        assertThat(nucleo.efeitos(corrida, contexto(1L, List.of()))).contains(new br.com.fashionai.application.flair3d.Efeito("PODER", 35));
        assertThat(nucleo.efeitos(semCor, contexto(1L, List.of()))).contains(new br.com.fashionai.application.flair3d.Efeito("ACAO_TOQUE", 0));
    }

    @Test
    void cartaJogadaApareceNoLanceSaiDaMaoECartaForaDaMaoERecusada() {
        Resultado inicio = jogar(3L, null, List.of());
        @SuppressWarnings("unchecked")
        List<UUID> mao = (List<UUID>) situacao(inicio).get("mao");
        UUID jogada = mao.get(0);
        Resultado r = jogar(3L, null, List.of(new Acionamento(jogada, null)));
        Map<String, Object> lance = jogadas(r).get(1);
        assertThat(lance).containsEntry("carta", jogada).containsEntry("time", "NOS");
        assertThat(lance.get("acao")).isEqualTo(EsporteForcas.acao(Flair3dFixtures.contexto(3L, deck).cartas().get(jogada)));
        @SuppressWarnings("unchecked")
        List<UUID> depois = (List<UUID>) situacao(r).get("mao");
        assertThat(depois).hasSize(5).doesNotContain(jogada);
        ApiException fora = catchThrowableOfType(ApiException.class, () -> jogar(3L, null, List.of(new Acionamento(sup.id(), null))));
        assertThat(fora.status()).isEqualTo(422);
        assertThat(fora.code()).isEqualTo("CARTA_FORA_DA_MAO");
        ApiException repetida = catchThrowableOfType(ApiException.class, () -> jogar(3L, null, List.of(new Acionamento(jogada, null), new Acionamento(jogada, null))));
        assertThat(repetida.code()).isEqualTo("CARTA_FORA_DA_MAO");
    }

    @Test
    void resistenciaSeguraOFolegoNoSegundoTempoEOFisicoVemDoMaterial() {
        EsporteForcas.Time leve = EsporteForcas.time(List.of(card("SUP", "ovr:90", "material:linen"), card("INF", "ovr:90", "material:cotton"), card("CAL", "ovr:90", "material:mesh")));
        EsporteForcas.Time pesado = EsporteForcas.time(List.of(card("SUP", "ovr:30", "material:leather"), card("INF", "ovr:30", "material:denim"), card("CAL", "ovr:30")));
        assertThat(leve.resistencia()).isGreaterThan(pesado.resistencia());
        assertThat(leve.folego(0)).isEqualTo(1.0);
        assertThat(leve.folego(15)).isGreaterThan(pesado.folego(15));
        assertThat(pesado.folego(15)).isLessThan(pesado.folego(7));
        assertThat(pesado.fisico()).isEqualTo(3 + 7 + 3 + 7 + 3);
        assertThat(pesado.cansaco()).isLessThanOrEqualTo(0.022);
        assertThat(leve.cansaco()).isGreaterThanOrEqualTo(0.004);
    }

    @Test
    void previaSoMostraOsAtributosENaoRodaAPartida() {
        Resultado p = nucleo.previa(vestir(sup, inf, cal), contexto(3L, List.of()));
        assertThat(p.resultado()).isEqualTo("PREVIA");
        assertThat(p.eventos()).extracting(Resultado.Evento::codigo).containsExactly("VELOCIDADE", "TECNICA", "RESISTENCIA", "DEFESA", "FISICO", "COESAO");
    }

    @Test
    void cadaModalidadeTemOSeuRelogioEASuaUnidadeDePlacar() {
        assertThat(EsporteRegras.de(null)).isEqualTo(EsporteRegras.FUTEBOL);
        assertThat(EsporteRegras.de("XADREZ")).isEqualTo(EsporteRegras.FUTEBOL);
        assertThat(EsporteRegras.CODIGOS).containsExactly("FUTEBOL", "BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE");
        assertThat(EsporteRegras.FUTEBOL.placar(new int[]{1, 1}, new int[]{0, 1})).isEqualTo("2-1");
        assertThat(EsporteRegras.de("SKATE").placar(new int[]{1, 2}, new int[]{0, 0})).isEqualTo("80-50");
        assertThat(EsporteRegras.de("VOLEI").placar(new int[]{3, 1}, new int[]{2, 1})).isEqualTo("1-0");
        assertThat(EsporteRegras.de("TENIS").saldo(new int[]{1, 0}, new int[]{0, 1})).isZero();
        assertThat(EsporteRegras.de("TENIS").saldo(new int[]{3, 0}, new int[]{0, 2})).isPositive();
        for (String codigo : EsporteRegras.CODIGOS) {
            EsporteRegras regras = EsporteRegras.de(codigo);
            Resultado r = ateOFim(9L, codigo, true);
            assertThat(r.fecha()).as(codigo).isTrue();
            assertThat(r.eventos().get(0)).isEqualTo(new Resultado.Evento("MODALIDADE", codigo));
            List<Map<String, Object>> jogadas = jogadas(r);
            assertThat((int) jogadas.get(jogadas.size() - 1).get("relogio")).isLessThanOrEqualTo(regras.jogadas() * regras.segundosPorJogada());
            assertThat(jogadas).allMatch(j -> (int) j.get("jogador") >= 1 && (int) j.get("jogador") <= regras.jogadores());
            assertThat((String) r.eventos().get(r.eventos().size() - 1).valor()).matches("\\d+-\\d+");
        }
        Resultado basquete = ateOFim(9L, "BASQUETE", true);
        long cestas = jogadas(basquete).stream().filter(j -> "CHUTE_GOL".equals(j.get("tipo"))).count();
        int pontos = Integer.parseInt(((String) basquete.eventos().get(basquete.eventos().size() - 1).valor()).split("-")[0]);
        assertThat(pontos).isBetween((int) cestas * 2, (int) cestas * 3);
    }
}
