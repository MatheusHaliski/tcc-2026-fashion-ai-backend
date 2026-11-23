package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dJogadaDeCena;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.comMaquiagem;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Auditoria do Road to Glory (núcleo 5) por partidas simuladas, em 20 sementes e nas 3 rodadas: com um guarda-roupa só
 * de cartas Bronze (como o da conta de demonstração: sem marca, sem festa, sem couro) e com um guarda-roupa bom. Quem
 * joga bem acerta a maquiagem do brief, veste só as peças que cumprem as regras e, na sessão de fotos, joga a carta da
 * cor que a fotógrafa pede.
 */
class RoadToGloryPartidasTest {
    static final List<String> RODADAS = List.of("ENSAIO_VERAO", "ENTREVISTA", "PRIMEIRO_ENCONTRO");
    final Flair3dNucleo jogo = Flair3dNucleos.porCodigo("ROAD_TO_GLORY").orElseThrow();

    /** 13 cartas Bronze de OVR 52 a 57, nas seis famílias de cor: algodão e poliéster, casual e esporte; nada de festa nem de trabalho. */
    static final CbcRules.Card[] BRONZE = {
            bronze("SUP", 52, "color:red", "material:cotton", "occasion:casual"),
            bronze("SUP", 53, "color:white", "material:cotton", "occasion:casual"),
            bronze("SUP", 57, "color:blue", "material:polyester", "occasion:casual"),
            bronze("INF", 54, "color:green", "material:cotton", "occasion:casual"),
            bronze("INF", 55, "color:blue", "material:cotton"),
            bronze("INF", 52, "color:blue", "material:polyester", "occasion:sport"),
            bronze("CAL", 56, "color:black", "sub:boots"),
            bronze("CAL", 55, "color:white", "sub:sneakers", "occasion:sport"),
            bronze("CAL", 53, "color:blue", "sub:sneakers", "occasion:sport"),
            bronze("ACE", 52, "color:yellow"),
            bronze("ACE", 54, "color:blue"),
            bronze("VES", 56, "color:black", "material:polyester", "occasion:casual"),
            bronze("SUP", 55, "color:blue", "material:cotton", "occasion:casual")};

    /** Bronze sem etiqueta nenhuma de ocasião nem de material: o pior guarda-roupa, ainda com as seis cores. */
    static final CbcRules.Card[] BRONZE_SEM_ETIQUETA = {bronze("SUP", 52, "color:red"), bronze("SUP", 52, "color:white"),
            bronze("INF", 52, "color:green"), bronze("INF", 52, "color:blue"), bronze("CAL", 52, "color:black", "sub:sneakers"),
            bronze("ACE", 52, "color:yellow")};

    /** Guarda-roupa bom: Ouro, com peças para os três briefs. */
    static final CbcRules.Card[] BOM = {
            ouro("SUP", "color:white", "material:linen", "occasion:casual", "occasion:work", "occasion:party"),
            ouro("INF", "color:blue", "material:cotton", "occasion:beach", "occasion:formal", "occasion:night_out"),
            ouro("CAL", "color:black", "material:cotton", "sub:loafers", "occasion:casual", "occasion:work", "occasion:party"),
            ouro("ACE", "color:yellow", "material:silk", "occasion:casual", "occasion:work", "occasion:date"),
            ouro("SUP", "color:red"), ouro("INF", "color:green"), ouro("ACE", "color:black"), ouro("ACE", "color:blue"),
            ouro("SUP", "color:yellow"), ouro("INF", "color:white")};

    static CbcRules.Card bronze(String posicao, int ovr, String... etiquetas) {
        List<String> e = new ArrayList<>(List.of(etiquetas));
        e.add("tier:BRONZE");
        e.add("ovr:" + ovr);
        return card(posicao, e.toArray(String[]::new));
    }

    static CbcRules.Card ouro(String posicao, String... etiquetas) {
        List<String> e = new ArrayList<>(List.of(etiquetas));
        e.add("tier:OURO");
        e.add("ovr:84");
        return card(posicao, e.toArray(String[]::new));
    }

    /** A maquiagem que o brief pede (50 dos 100 pontos, sem depender de carta). */
    static Entrega maquiada(String rodada, Entrega e) {
        return switch (rodada) {
            case "ENTREVISTA" -> comMaquiagem(e, "LABIOS", "NUDE", "FOSCO");
            case "PRIMEIRO_ENCONTRO" -> comMaquiagem(comMaquiagem(e, "LABIOS", "VINHO", "CETIM"), "BOCHECHAS", "ROSA", "CETIM");
            default -> comMaquiagem(e, "LABIOS", "CORAL", "GLOSS");
        };
    }

    /** Todos os looks possíveis com as cartas (no máximo uma por vaga). */
    static List<Map<String, UUID>> looks(CbcRules.Card[] cartas) {
        List<Map<String, UUID>> out = new ArrayList<>(List.of(new LinkedHashMap<>()));
        for (String vaga : List.of("SUP", "INF", "CAL", "ACE", "VES")) {
            List<Map<String, UUID>> novos = new ArrayList<>();
            for (CbcRules.Card c : cartas) {
                if (c.position().equals(vaga)) {
                    out.forEach(base -> {
                        Map<String, UUID> m = new LinkedHashMap<>(base);
                        m.put(vaga, c.id());
                        novos.add(m);
                    });
                }
            }
            out.addAll(novos);
        }
        return out;
    }

    Contexto contexto(String rodada, long semente, CbcRules.Card[] cartas) {
        return Flair3dFixtures.naRodada(rodada, semente, cartas);
    }

    static String pedida(Resultado espera) {
        return (String) ((Map<?, ?>) espera.eventos().stream().filter(x -> x.codigo().equals("PEDIDO_DE_CENA")).findFirst().orElseThrow().valor()).get("familia");
    }

    /** A carta fora do look na cor que a fotógrafa pede, ou nula. */
    static UUID daCor(String pedida, Entrega look, CbcRules.Card[] cartas) {
        return List.of(cartas).stream().filter(c -> !look.cartas().containsValue(c.id()))
                .filter(c -> pedida.equals(Flair3dCores.familia(Flair3dCores.tabelaDe("ROAD_TO_GLORY"), c))).map(CbcRules.Card::id).findFirst().orElse(null);
    }

    /**
     * Jogando bem: o look de maior nota na prévia que ainda deixa fora dele uma carta da cor pedida (a fotógrafa diz a cor
     * quando o look é avaliado, e a cor sai só da semente) e, na sessão de fotos, essa carta.
     */
    Resultado jogandoBem(String rodada, long semente, CbcRules.Card[] cartas) {
        Contexto ctx = contexto(rodada, semente, cartas);
        String pedida = pedida(jogo.pontuar(maquiada(rodada, new Entrega(null, null, null, null)), ctx));
        Entrega melhor = null;
        int nota = -1;
        for (Map<String, UUID> look : looks(cartas)) {
            Entrega e = maquiada(rodada, new Entrega(look, null, null, null));
            int p = jogo.previa(e, ctx).pontos() + (daCor(pedida, e, cartas) == null ? 0 : Flair3dJogadaDeCena.BONUS);
            if (p > nota) {
                nota = p;
                melhor = e;
            }
        }
        Resultado espera = jogo.pontuar(melhor, ctx);
        assertThat(espera.status()).isEqualTo(Resultado.EM_ACAO);
        assertThat(pedida(espera)).isEqualTo(pedida);
        return jogo.pontuar(melhor, ctx.comAndamento(ctx.andamento().com(new Acionamento(daCor(pedida, melhor, cartas), null))));
    }

    /** Só seguindo: maquiagem certa, as primeiras peças da coleção e nenhuma carta na sessão de fotos. */
    Resultado soSeguindo(String rodada, long semente, CbcRules.Card[] cartas) {
        Contexto ctx = contexto(rodada, semente, cartas);
        Map<String, UUID> look = new LinkedHashMap<>();
        for (CbcRules.Card c : cartas) {
            look.putIfAbsent(c.position(), c.id());
        }
        look.remove("VES");
        return jogo.pontuar(maquiada(rodada, new Entrega(look, null, null, null)), ctx.comAndamento(ctx.andamento().com(Acionamento.NENHUM)));
    }

    @Test
    void todaRodadaEhVencivelComCartasBronzeJogandoBemEmVinteSementes() {
        for (String rodada : RODADAS) {
            for (long semente = 1; semente <= 20; semente++) {
                Resultado r = jogandoBem(rodada, semente, BRONZE);
                assertThat(r.resultado()).as(rodada + " semente " + semente).isEqualTo("APROVADO");
                assertThat(r.pontos()).as(rodada + " semente " + semente).isGreaterThanOrEqualTo(85);
                assertThat(r.estrelas()).isGreaterThanOrEqualTo(2);
                // quem veste a primeira peça de cada vaga e segue sem jogar carta fica sempre abaixo: a decisão é da pessoa
                assertThat(soSeguindo(rodada, semente, BRONZE).pontos()).as(rodada + " semente " + semente).isLessThan(r.pontos());
            }
        }
        // só seguindo, o Ensaio de Verão reprova (50); a Entrevista e o Primeiro Encontro passam com 75 (calçado fechado, acessório)
        assertThat(soSeguindo("ENSAIO_VERAO", 1, BRONZE).resultado()).isEqualTo("REPROVADO");
        assertThat(soSeguindo("ENTREVISTA", 1, BRONZE).pontos()).isEqualTo(75);
        assertThat(soSeguindo("PRIMEIRO_ENCONTRO", 1, BRONZE).pontos()).isEqualTo(75);
        // com o guarda-roupa da conta de demonstração, o Ensaio de Verão chega a 100 (peças casuais de algodão)
        assertThat(jogandoBem("ENSAIO_VERAO", 3, BRONZE).pontos()).isEqualTo(100);
    }

    @Test
    void oPiorGuardaRoupaBronzeAindaPassaPelaSessaoDeFotos() {
        for (String rodada : RODADAS) {
            for (long semente = 1; semente <= 20; semente++) {
                Resultado r = jogandoBem(rodada, semente, BRONZE_SEM_ETIQUETA);
                assertThat(r.resultado()).as(rodada + " semente " + semente).isEqualTo("APROVADO");
            }
        }
        // sem a carta na sessão de fotos o Ensaio fica nos 50 da maquiagem: reprovado
        assertThat(soSeguindo("ENSAIO_VERAO", 1, BRONZE_SEM_ETIQUETA).pontos()).isEqualTo(50);
        assertThat(soSeguindo("ENSAIO_VERAO", 1, BRONZE_SEM_ETIQUETA).resultado()).isEqualTo("REPROVADO");
    }

    @Test
    void oGuardaRoupaBomChegaACemEAContaDizQueAsRegrasPassaramDeCem() {
        for (String rodada : RODADAS) {
            for (long semente = 1; semente <= 20; semente++) {
                Resultado r = jogandoBem(rodada, semente, BOM);
                assertThat(r.pontos()).as(rodada).isEqualTo(100);
                assertThat(r.estrelas()).isEqualTo(3);
                // as 4 regras do brief (100) e a luz certa (10) somam 110: o evento TETO explica o 100
                assertThat(r.regras().stream().mapToDouble(Resultado.RegraResultado::pontos).sum()).isEqualTo(110.0);
                assertThat(r.eventos()).contains(new Evento("TETO", Map.of("soma", 110.0)));
            }
        }
        Resultado semTeto = jogandoBem("ENTREVISTA", 1, BRONZE);
        assertThat(semTeto.eventos()).noneMatch(e -> e.codigo().equals("TETO"));
        assertThat(semTeto.regras().stream().mapToDouble(Resultado.RegraResultado::pontos).sum()).isEqualTo((double) semTeto.pontos());
    }

    @Test
    void oSeloDaCartaEhODoBriefDaRodada() {
        CbcRules.Card casual = BRONZE[0];
        CbcRules.Card bota = BRONZE[6];
        CbcRules.Card acessorio = BRONZE[9];
        assertThat(jogo.efeitos(casual, contexto("ENSAIO_VERAO", 1, BRONZE))).containsExactly(new Efeito("OCASIAO", 25), new Efeito("MATERIAL_LEVE", 25));
        assertThat(jogo.efeitos(casual, contexto(null, 1, BRONZE))).containsExactly(new Efeito("OCASIAO", 25), new Efeito("MATERIAL_LEVE", 25));
        // antes: a carta casual levava o selo "+25 ocasião do brief" também na Entrevista e no Primeiro Encontro
        assertThat(jogo.efeitos(casual, contexto("ENTREVISTA", 1, BRONZE))).isEmpty();
        assertThat(jogo.efeitos(casual, contexto("PRIMEIRO_ENCONTRO", 1, BRONZE))).isEmpty();
        assertThat(jogo.efeitos(bota, contexto("ENTREVISTA", 1, BRONZE))).containsExactly(new Efeito("CALCADO_FECHADO", 25));
        assertThat(jogo.efeitos(bota, contexto("ENSAIO_VERAO", 1, BRONZE))).isEmpty();
        assertThat(jogo.efeitos(acessorio, contexto("PRIMEIRO_ENCONTRO", 1, BRONZE))).containsExactly(new Efeito("ACESSORIO", 25));
    }

    @Test
    void oResultadoDizQualPecaDerrubouARegraDeTodasAsPecas() {
        CbcRules.Card casual = BRONZE[0];
        CbcRules.Card semOcasiao = BRONZE[4];
        CbcRules.Card bota = BRONZE[6];
        Entrega e = maquiada("ENSAIO_VERAO", Flair3dFixtures.vestir(casual, semOcasiao, bota));
        Resultado r = jogo.previa(e, contexto("ENSAIO_VERAO", 1, BRONZE));
        assertThat(r.pontos()).isEqualTo(50);
        assertThat(r.eventos()).containsExactly(new Evento("PECA_FORA_DA_OCASIAO", Map.of("vaga", "INF")), new Evento("PECA_FORA_DA_OCASIAO", Map.of("vaga", "CAL")),
                new Evento("PECA_NAO_LEVE", Map.of("vaga", "CAL")));
        Resultado nua = jogo.previa(maquiada("ENTREVISTA", new Entrega(null, null, null, null)), contexto("ENTREVISTA", 1, BRONZE));
        assertThat(nua.eventos()).containsExactly(new Evento("SEM_PECAS", 0));
        // nas outras rodadas as cartas também dizem quanto renderam (antes vinha vazio)
        Resultado entrevista = jogo.previa(maquiada("ENTREVISTA", Flair3dFixtures.vestir(casual, bota)), contexto("ENTREVISTA", 1, BRONZE));
        assertThat(entrevista.cartas()).containsExactly(new Resultado.CartaPontos("SUP", casual.id(), 0), new Resultado.CartaPontos("CAL", bota.id(), 25));
    }

    @Test
    void aPreviaMostraANotaDoLookSemAbrirASessaoDeFotos() {
        Entrega e = maquiada("ENSAIO_VERAO", Flair3dFixtures.vestir(BRONZE[0]));
        Resultado previa = jogo.previa(e, contexto("ENSAIO_VERAO", 7, BRONZE));
        assertThat(previa.pontos()).isEqualTo(100);
        assertThat(previa.status()).isNull();
        assertThat(previa.eventos()).noneMatch(x -> x.codigo().equals("PEDIDO_DE_CENA"));
    }
}
