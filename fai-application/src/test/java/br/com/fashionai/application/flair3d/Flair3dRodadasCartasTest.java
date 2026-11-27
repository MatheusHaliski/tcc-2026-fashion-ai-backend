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
    void arenasDoDressFighterTemOponenteProprioEEstiloDeGolpesProprio() {
        DressFighterNucleo n = new DressFighterNucleo();
        CbcRules.Card[] look = {card("SUP", "material:leather"), card("INF", "material:denim"), card("CAL", "sub:casual_sneakers"), card("ACE", "material:metal")};
        assertThat(n.abertura(naRodada(null, 3L, look)).get("oponente")).isEqualTo(Map.of("velocidade", 40, "ataque", 40, "defesa", 40));
        assertThat(n.abertura(naRodada(DressFighterNucleo.ARENA_BLINDADA, 3L, look)).get("oponente"))
                .isEqualTo(Map.of("velocidade", 40, "ataque", 50, "defesa", 65));
        List<Acionamento> nove = java.util.Collections.nCopies(9, Acionamento.NENHUM);
        Contexto ctx = Flair3dFixtures.contexto(3L, look).comAndamento(new Andamento(1, nove, List.of(), DressFighterNucleo.ARENA_BLINDADA));
        Resultado r = n.pontuar(vestir(look), ctx);
        assertThat(r.fecha()).isTrue();
        assertThat(n.pontuar(vestir(look), ctx)).isEqualTo(r);
        // a blindada guarda mais que a veloz: nos 100 números do sorteio, mais guardas
        long guardasBlindada = java.util.stream.IntStream.range(0, 100).filter(i -> br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GUARDA.equals(br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.daOponente(DressFighterNucleo.ARENA_BLINDADA, i))).count();
        long guardasVeloz = java.util.stream.IntStream.range(0, 100).filter(i -> br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GUARDA.equals(br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.daOponente(DressFighterNucleo.ARENA_VELOZ, i))).count();
        assertThat(guardasBlindada).isGreaterThan(guardasVeloz);
    }

    @Test
    void modoStylistPedeDeducaoEAPlateiaAbreUmaPistaPorPecaForaDoPerfil() {
        DressTheStarNucleo n = new DressTheStarNucleo();
        CbcRules.Card rock = card("SUP", "style:grunge");
        CbcRules.Card preta = card("INF", "color:black");
        CbcRules.Card neutra = card("CAL");
        CbcRules.Card jaqueta = card("SUP", "style:grunge", "color:black");
        long semente = 1;
        while (!"ESTRELA_ROCK_80".equals(n.abertura(naRodada(DressTheStarNucleo.STYLIST, semente, rock)).get("estrela"))) {
            semente++;
        }
        Contexto c = naRodada(DressTheStarNucleo.STYLIST, semente, rock, preta, neutra, jaqueta);
        // só o estilo ou só a cor valem 10; os dois, 25; fora do perfil, nada
        Resultado r = n.pontuar(vestir(rock, preta, neutra), c);
        assertThat(r.pontos()).isEqualTo(20);
        assertThat(n.pontuar(vestir(jaqueta, preta), c).pontos()).isEqualTo(35);
        assertThat(simples(r, "ESTRELA")).isEqualTo("ESTRELA_ROCK_80");
        assertThat(simples(r, "PISTAS_ABERTAS")).isEqualTo(2L);
        // a peça fora do perfil tira 10 da confiança da estrela (o FOCO)
        assertThat(valor(r, "DESGASTE")).containsEntry("recurso", "FOCO").containsEntry("restante", 30)
                .containsEntry("motivos", Map.of("PECA_FORA_DO_PERFIL", 10));
        // a prévia e a carta não respondem pela pessoa: nem nota, nem selo de quem bate
        Resultado previa = n.previa(vestir(rock, preta, neutra), c);
        assertThat(previa.pontos()).isZero();
        assertThat(previa.resultado()).isEqualTo("PREVIA");
        assertThat(previa.eventos()).isEmpty();
        assertThat(n.efeitos(rock, c)).containsExactly(Efeito.conformeAEtapa());
        assertThat(n.efeitos(neutra, c)).containsExactly(Efeito.conformeAEtapa());
        assertThat(r.eventos()).isEqualTo(n.pontuar(vestir(rock, preta, neutra), c).eventos());
        Resultado nada = n.pontuar(vestir(neutra), c);
        assertThat(nada.eventos()).extracting(Resultado.Evento::codigo).contains("PLATEIA_NAO_ADIVINHOU");
    }

    @Test
    void naPassarelaCadaPecaForaDoTemaTiraConfiancaDaModelo() {
        PassarelaNucleo n = new PassarelaNucleo();
        CbcRules.Card farm = card("SUP", "brand:Farm");
        CbcRules.Card gucci = card("INF", "brand:Gucci");
        CbcRules.Card semMarca = card("CAL");
        Resultado r = n.pontuar(vestir(farm, gucci, semMarca), Flair3dFixtures.contexto(1L, farm, gucci, semMarca));
        assertThat(valor(r, "DESGASTE")).containsEntry("recurso", "FOCO").containsEntry("reserva", 40).containsEntry("restante", 20)
                .containsEntry("motivos", Map.of("PECA_FORA_DO_TEMA", 20));
        CbcRules.Card[] fora = {card("SUP"), card("INF"), card("CAL"), card("ACE")};
        Resultado semConfianca = n.pontuar(vestir(fora), Flair3dFixtures.contexto(1L, fora));
        assertThat(semConfianca.resultado()).isEqualTo("REPROVADO");
        assertThat(valor(semConfianca, "DESGASTE")).containsEntry("restante", 0);
    }

    @Test
    void noFilmeAPacienciaDoDiretorCaiComARespostaErradaEComAParteForaDaCena() {
        PersonagemFilmeNucleo n = new PersonagemFilmeNucleo();
        CbcRules.Card casaco = card("SUP", "sub:coat");
        CbcRules.Card amarela = card("INF", "color:yellow");
        CbcRules.Card rosa = card("CAL", "color:pink");
        CbcRules.Card verde = card("ACE", "color:green");
        Contexto c = Flair3dFixtures.contexto(1L, casaco, amarela, rosa, verde);
        Entrega certa = new Entrega(vestir(casaco, amarela).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        assertThat(valor(n.pontuar(certa, c), "DESGASTE")).containsEntry("recurso", "FOCO").containsEntry("restante", 30)
                .containsEntry("motivos", Map.of("PARTE_FORA_DA_CENA", 10));
        // título errado (15) e três partes fora da cena (30): o diretor corta a cena
        Entrega errada = new Entrega(vestir(casaco, amarela, rosa, verde).cartas(), null, null, "FILME_VERAO_EM_NEON");
        Resultado cortada = n.pontuar(errada, c);
        assertThat(cortada.resultado()).isEqualTo(PersonagemFilmeNucleo.CORTOU);
        assertThat(valor(cortada, "DESGASTE")).containsEntry("restante", 0);
    }

    @Test
    void quatroPecasForaDoPerfilZeramAConfiancaDaEstrela() {
        DressTheStarNucleo n = new DressTheStarNucleo();
        CbcRules.Card[] fora = {card("SUP", "style:classic"), card("INF", "color:green"), card("CAL"), card("ACE")};
        Resultado r = n.pontuar(vestir(fora), Flair3dFixtures.contexto(1L, fora));
        assertThat(r.resultado()).isEqualTo("REPROVADO");
        assertThat(r.pontos()).isZero();
        assertThat(valor(r, "DESGASTE")).containsEntry("restante", 0);
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
    void aNotaDoAdversarioSaiDoLookDeleEMudaComASemente() {
        BatalhaLooksNucleo n = new BatalhaLooksNucleo();
        CbcRules.Card formal = card("SUP", "occasion:formal");
        Set<Object> notas = new HashSet<>();
        for (long semente = 1; semente <= 30; semente++) {
            Contexto c = naRodada("VISTA_O_CLIMA", semente, formal);
            Resultado r = n.pontuar(vestir(formal), c);
            assertThat(n.pontuar(vestir(formal), c).eventos()).isEqualTo(r.eventos());
            notas.add(simples(r, "ADVERSARIO"));
        }
        assertThat(notas).hasSizeGreaterThan(1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void treinosDaBatalhaSorteiamODesafioEOLookDoAdversario() {
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
        // 50 pelas regras do convite mais o que o look soma (regra peça-recurso, dentro da nota da rodada)
        Map<String, Object> conta = (Map<String, Object>) valor(r, "CONTA_DA_BATALHA").get("voce");
        assertThat(conta.get("regra")).isEqualTo(50);
        assertThat(r.pontos()).isEqualTo(50 + (int) conta.get("look") + (int) conta.get("recurso"));
        assertThat(r.regras()).contains(new Resultado.RegraResultado("SEM_PECA_PROIBIDA", false, -25));
        assertThat(simples(r, "DESAFIO")).isEqualTo("CONVITE_BLACK_TIE");
        // o adversário da casa veste um look da semente, avaliado pelas mesmas regras: a nota é a do look dele
        int adversario = (int) simples(r, "ADVERSARIO");
        Map<String, Object> casa = valor(r, "LOOK_DO_ADVERSARIO");
        assertThat(casa.get("nota")).isEqualTo(adversario);
        assertThat((Map<String, Object>) casa.get("look")).containsOnlyKeys("SUP", "INF", "CAL", "ACE");
        assertThat(adversario).isBetween(0, 100).isEqualTo((int) simples(n.pontuar(vestir(formal), c), "ADVERSARIO"));
        assertThat(r.resultado()).isEqualTo(r.pontos() > adversario ? "VITORIA" : "DERROTA");
        // a prévia não revela o adversário: a nota dele só sai na entrega
        assertThat(n.previa(vestir(formal, festa, tenis), c).eventos()).isEmpty();
        assertThat(n.efeitos(formal, c)).containsExactly(new Efeito("NA_REGRA", 25));
        assertThat(n.efeitos(card("SUP"), c)).containsExactly(Efeito.motivo("FORA_DA_REGRA"));
        Contexto clima = naRodada("VISTA_O_CLIMA", 2L, formal);
        assertThat((String) n.abertura(clima).get("desafio")).startsWith("CLIMA_");
    }
}
