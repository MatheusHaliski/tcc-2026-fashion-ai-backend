package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressTheStarNucleo;
import br.com.fashionai.application.flair3d.nucleos.PassarelaNucleo;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.naRodada;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — as rodadas de um look só dos jogos de cartas: os temas da Passarela com os desfiles da casa, as arenas do
 * Dress Fighter, o Modo Stylist e o Look Relâmpago do Dress the Star, as cenas e as décadas do Personagem de Filme e os
 * treinos da Batalha de Looks. Tudo sai da semente: a mesma partida dá sempre o mesmo resultado, e a prévia não revela o
 * que só a entrega mostra.
 */
class Flair3dRodadasCartasTest {
    @SuppressWarnings("unchecked")
    static Map<String, Object> valor(Resultado r, String codigo) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals(codigo)).findFirst().orElseThrow().valor();
    }

    static Object simples(Resultado r, String codigo) {
        return r.eventos().stream().filter(e -> e.codigo().equals(codigo)).findFirst().orElseThrow().valor();
    }

    @Test
    void todoJogoTemPeloMenosTresRodadasEAPrimeiraDaListaEstaNaDefinicao() {
        for (Flair3dNucleo n : Flair3dNucleos.TODOS) {
            Definicao d = n.definicao();
            assertThat(d.rodadas()).extracting(Definicao.Rodada::codigo).doesNotHaveDuplicates().contains(d.objetivo().codigo());
            if (!Set.of("FASHION_DETECTIVE", "FASHION_SPORTS").contains(d.codigo())) {
                assertThat(d.rodadas()).as(d.codigo()).hasSizeGreaterThanOrEqualTo(3);
            }
            d.rodadas().forEach(r -> assertThat(r.objetivo().regras()).as(d.codigo() + " " + r.codigo()).isNotEmpty());
        }
    }

    @Test
    void passarelaPontuaPeloTemaDaRodadaEColocaNaSalaContraOsDesfilesDaCasa() {
        CbcRules.Card sup = card("SUP", "occasion:party", "color:navy");
        CbcRules.Card inf = card("INF", "occasion:night_out", "color:blue");
        CbcRules.Card cal = card("CAL", "occasion:casual", "color:red");
        PassarelaNucleo n = new PassarelaNucleo();
        Contexto noite = naRodada("TEMA_NOITE", 9L, sup, inf, cal);
        Resultado r = n.pontuar(vestir(sup, inf, cal), noite);
        assertThat(r.pontos()).isEqualTo(29);
        assertThat(r.regras()).containsExactly(new Resultado.RegraResultado("NO_TEMA", true, 20), new Resultado.RegraResultado("TUDO_NO_TEMA", false, 0));
        assertThat(simples(r, "TEMA")).isEqualTo("TEMA_NOITE");
        assertThat(r.eventos()).filteredOn(e -> e.codigo().equals("DESFILE_DA_CASA")).hasSize(3);
        int lugar = (int) valor(r, "COLOCACAO").get("lugar");
        long acima = r.eventos().stream().filter(e -> e.codigo().equals("DESFILE_DA_CASA"))
                .filter(e -> (int) ((Map<?, ?>) e.valor()).get("pontos") > r.pontos()).count();
        assertThat(lugar).isEqualTo(acima + 1);
        assertThat(n.pontuar(vestir(sup, inf, cal), noite)).isEqualTo(r);
        assertThat(n.previa(vestir(sup, inf, cal), noite).eventos()).isEmpty();

        Resultado mono = n.pontuar(vestir(sup, inf, cal), naRodada("TEMA_MONOCROMATICO", 9L, sup, inf, cal));
        assertThat(mono.regras().get(0).pontos()).isEqualTo(20);
        Resultado inteiro = n.pontuar(vestir(sup, inf), naRodada("TEMA_MONOCROMATICO", 9L, sup, inf));
        assertThat(inteiro.regras().get(1).ok()).isTrue();
        assertThat(inteiro.pontos()).isEqualTo(57);
    }

    @Test
    void temaSurpresaSaiDaSementeSoApareceNaPartidaEMudaDeUmaPartidaParaOutra() {
        PassarelaNucleo n = new PassarelaNucleo();
        CbcRules.Card sup = card("SUP", "style:classic");
        Set<Object> temas = new HashSet<>();
        for (long semente = 1; semente <= 40; semente++) {
            Contexto c = naRodada(PassarelaNucleo.SURPRESA, semente, sup);
            Object tema = n.abertura(c).get("tema");
            assertThat(PassarelaNucleo.SURPRESAS).contains((String) tema);
            assertThat(n.abertura(c).get("tema")).isEqualTo(tema);
            assertThat(simples(n.pontuar(vestir(sup), c), "TEMA")).isEqualTo(tema);
            temas.add(tema);
        }
        assertThat(temas).hasSize(PassarelaNucleo.SURPRESAS.size()).doesNotContain("TEMA_BRASIL");
        Contexto foraDaPartida = new Contexto(Map.of(), null, null).naRodada(PassarelaNucleo.SURPRESA);
        assertThat(n.efeitos(sup, foraDaPartida)).containsExactly(new Efeito("TEMA_SURPRESA", 1));
        assertThat(n.efeitos(sup, new Contexto(Map.of(), null, null).naRodada("TEMA_CLASSICO"))).containsExactly(new Efeito("NO_TEMA", 10));
        assertThat(n.efeitos(card("SUP"), new Contexto(Map.of(), null, null).naRodada("TEMA_CLASSICO"))).containsExactly(Efeito.motivo("FORA_DO_TEMA"));
    }

    @Test
    void arenasDoDressFighterTemOponenteProprioEImpulsoDaSemente() {
        DressFighterNucleo n = new DressFighterNucleo();
        CbcRules.Card[] look = {card("SUP", "material:leather"), card("INF", "material:denim"), card("CAL", "sub:casual_sneakers"), card("ACE", "material:metal")};
        assertThat(n.abertura(naRodada(null, 3L, look)).get("oponente")).isEqualTo(Map.of("velocidade", 40, "ataque", 40, "defesa", 40));
        assertThat(n.abertura(naRodada(DressFighterNucleo.ARENA_BLINDADA, 3L, look)).get("oponente"))
                .isEqualTo(Map.of("velocidade", 40, "ataque", 50, "defesa", 65));
        Andamento fim = new Andamento(1, List.of(Acionamento.NENHUM, Acionamento.NENHUM), List.of(), DressFighterNucleo.ARENA_BLINDADA);
        Contexto ctx = Flair3dFixtures.contexto(3L, look).comAndamento(fim);
        Resultado r = n.pontuar(vestir(look), ctx);
        assertThat(r.fecha()).isTrue();
        List<Resultado.Evento> rounds = r.eventos().stream().filter(e -> e.codigo().equals("ROUND")).toList();
        assertThat(rounds).hasSize(3);
        assertThat(rounds).extracting(e -> (Object) ((Map<?, ?>) e.valor()).get("oponente")).containsExactly(40, 50, 65);
        r.eventos().stream().filter(e -> e.codigo().equals("IMPULSO"))
                .forEach(e -> assertThat((int) ((Map<?, ?>) e.valor()).get("impulso")).isBetween(-DressFighterNucleo.IMPULSO, DressFighterNucleo.IMPULSO));
        assertThat(n.pontuar(vestir(look), ctx)).isEqualTo(r);
        Resultado base = n.pontuar(vestir(look), Flair3dFixtures.contexto(3L, look).comAndamento(new Andamento(1, List.of(Acionamento.NENHUM, Acionamento.NENHUM))));
        assertThat(base.eventos()).extracting(Resultado.Evento::codigo).containsOnly("ROUND");
    }

    @Test
    void modoStylistVesteAEstrelaSorteadaEAPlateiaAbreUmaPistaPorPecaForaDoPerfil() {
        DressTheStarNucleo n = new DressTheStarNucleo();
        CbcRules.Card rock = card("SUP", "style:grunge");
        CbcRules.Card preta = card("INF", "color:black");
        CbcRules.Card neutra = card("CAL");
        long semente = 1;
        while (!"ESTRELA_ROCK_80".equals(n.abertura(naRodada(DressTheStarNucleo.STYLIST, semente, rock)).get("estrela"))) {
            semente++;
        }
        Contexto c = naRodada(DressTheStarNucleo.STYLIST, semente, rock, preta, neutra);
        Resultado r = n.pontuar(vestir(rock, preta, neutra), c);
        assertThat(r.pontos()).isEqualTo(50);
        assertThat(simples(r, "ESTRELA")).isEqualTo("ESTRELA_ROCK_80");
        assertThat(simples(r, "PISTAS_ABERTAS")).isEqualTo(2L);
        assertThat(n.previa(vestir(rock, preta, neutra), c).eventos()).isEmpty();
        assertThat(n.efeitos(rock, c)).containsExactly(new Efeito("FIGURINO", 25));
        assertThat(n.efeitos(neutra, c)).containsExactly(Efeito.motivo("FORA_DO_FIGURINO"));
        assertThat(r.eventos()).isEqualTo(n.pontuar(vestir(rock, preta, neutra), c).eventos());
        Resultado nada = n.pontuar(vestir(neutra), c);
        assertThat(nada.eventos()).extracting(Resultado.Evento::codigo).contains("PLATEIA_NAO_ADIVINHOU");
    }

    @Test
    void lookRelampagoTiraOAlvoDoDeckEContaVagaIgualEmTipoECor() {
        DressTheStarNucleo n = new DressTheStarNucleo();
        CbcRules.Card supA = card("SUP", "sub:shirt", "color:navy");
        CbcRules.Card supB = card("SUP", "sub:shirt", "color:blue");
        CbcRules.Card inf = card("INF", "sub:jeans", "color:black");
        CbcRules.Card cal = card("CAL", "sub:boots", "color:brown");
        Contexto c = naRodada(DressTheStarNucleo.RELAMPAGO, 5L, supA, supB, inf, cal);
        @SuppressWarnings("unchecked")
        Map<String, UUID> alvo = (Map<String, UUID>) n.abertura(c).get("alvo");
        assertThat(alvo.keySet()).containsExactly("SUP", "INF", "CAL");
        assertThat(n.abertura(c).get("segundos")).isEqualTo(10);
        assertThat(n.abertura(c).get("alvo")).isEqualTo(alvo);
        CbcRules.Card outraSup = alvo.get("SUP").equals(supA.id()) ? supB : supA;
        Resultado igual = n.pontuar(vestir(outraSup, inf, cal), c);
        assertThat(igual.pontos()).isEqualTo(100);
        assertThat(simples(igual, "VAGAS_IGUAIS")).isEqualTo(3L);
        CbcRules.Card vermelha = card("SUP", "sub:shirt", "color:red");
        Contexto comVermelha = naRodada(DressTheStarNucleo.RELAMPAGO, 5L, vermelha, inf, cal).comDeck(c.deck());
        assertThat(n.pontuar(vestir(vermelha, inf, cal), comVermelha).pontos()).isEqualTo(67);
    }

    @Test
    void cenaSorteadaEDecadaPedemARespostaDaCenaEAPreviaNaoEntregaOTitulo() {
        PersonagemFilmeNucleo n = new PersonagemFilmeNucleo();
        CbcRules.Card rosa = card("SUP", "color:pink");
        Set<Object> cenas = new HashSet<>();
        for (long semente = 1; semente <= 40; semente++) {
            cenas.add(n.abertura(naRodada(PersonagemFilmeNucleo.CENA_SORTEADA, semente, rosa)).get("cena"));
        }
        assertThat(cenas).containsExactlyInAnyOrder("CENA_1", "CENA_2", "CENA_3", "CENA_4");
        long semente = 1;
        while (!"CENA_4".equals(n.abertura(naRodada(PersonagemFilmeNucleo.CENA_SORTEADA, semente, rosa)).get("cena"))) {
            semente++;
        }
        Contexto c = naRodada(PersonagemFilmeNucleo.CENA_SORTEADA, semente, rosa);
        Entrega certa = new Entrega(vestir(rosa).cartas(), null, null, "FILME_BAILE_DAS_FLORES");
        Resultado r = n.pontuar(certa, c);
        assertThat(r.pontos()).isEqualTo(63);
        assertThat(simples(r, "RESPOSTA_CERTA")).isEqualTo("FILME_BAILE_DAS_FLORES");
        Entrega errada = new Entrega(vestir(rosa).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        assertThat(n.pontuar(errada, c).regras().get(0)).isEqualTo(new Resultado.RegraResultado("TITULO", false, 0));
        Resultado previa = n.previa(certa, c);
        assertThat(previa.pontos()).isEqualTo(13);
        assertThat(previa.eventos()).isEmpty();
        assertThat(previa.regras()).extracting(Resultado.RegraResultado::codigo).doesNotContain("TITULO");

        Definicao.Rodada decada = n.definicao().rodada(PersonagemFilmeNucleo.DECADA).orElseThrow();
        assertThat(decada.opcoes()).isEqualTo(PersonagemFilmeNucleo.DECADAS);
        Contexto d = naRodada(PersonagemFilmeNucleo.DECADA, 4L, rosa);
        String resposta = (String) simples(n.pontuar(vestir(rosa), d), "RESPOSTA_CERTA");
        assertThat(PersonagemFilmeNucleo.DECADAS).contains(resposta);
        Resultado acertou = n.pontuar(new Entrega(Map.of(), null, null, resposta), d);
        assertThat(acertou.regras().get(0)).isEqualTo(new Resultado.RegraResultado("DECADA", true, 50));
    }

    @Test
    void treinosDaBatalhaSorteiamODesafioEONotaDoAdversario() {
        BatalhaLooksNucleo n = new BatalhaLooksNucleo();
        CbcRules.Card formal = card("SUP", "occasion:formal");
        CbcRules.Card festa = card("INF", "occasion:party");
        CbcRules.Card tenis = card("CAL", "occasion:formal", "sub:casual_sneakers");
        long semente = 1;
        while (!"CONVITE_BLACK_TIE".equals(n.abertura(naRodada("DRESS_CODE_DO_CONVITE", semente, formal)).get("desafio"))) {
            semente++;
        }
        Contexto c = naRodada("DRESS_CODE_DO_CONVITE", semente, formal, festa, tenis);
        Resultado r = n.pontuar(vestir(formal, festa, tenis), c);
        assertThat(r.pontos()).isEqualTo(50);
        assertThat(r.regras()).contains(new Resultado.RegraResultado("SEM_PECA_PROIBIDA", false, -25));
        assertThat(simples(r, "DESAFIO")).isEqualTo("CONVITE_BLACK_TIE");
        int adversario = (int) simples(r, "ADVERSARIO");
        assertThat(List.of(25, 50, 75)).contains(adversario);
        assertThat(r.resultado()).isEqualTo(r.pontos() > adversario ? "VITORIA" : "DERROTA");
        assertThat(n.previa(vestir(formal, festa, tenis), c).eventos()).isEmpty();
        assertThat(n.efeitos(formal, c)).containsExactly(new Efeito("NA_REGRA", 25));
        assertThat(n.efeitos(card("SUP"), c)).containsExactly(Efeito.motivo("FORA_DA_REGRA"));
        Contexto clima = naRodada("VISTA_O_CLIMA", 2L, formal);
        assertThat((String) n.abertura(clima).get("desafio")).startsWith("CLIMA_");
    }
}
