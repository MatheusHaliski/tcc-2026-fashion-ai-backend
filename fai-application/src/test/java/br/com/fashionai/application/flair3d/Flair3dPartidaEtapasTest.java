package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FLAIR 3D — a partida em etapas no serviço (repositórios em memória): entrega que começa a ação, acionamento que avança
 * e fecha, LABIRINTO que segue aberto enquanto o espelho não abre, a prévia que não grava nada e o motivo SEM_BONUS.
 */
class Flair3dPartidaEtapasTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        Brand farm = new Brand();
        farm.setName("Farm");
        farm.setSlug("farm");
        farm.setCountry("BR");
        kit.save(BrandRepository.class, farm);
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
    }

    FlairCardInstance carta(CurrentUser dono, String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(dono.id(), posicao, etiquetas));
    }

    UUID abrir(String nucleo, FlairCardInstance... deck) {
        List<UUID> ids = Arrays.stream(deck).map(FlairCardInstance::getId).toList();
        return (UUID) service.abrir(ana, nucleo, new Flair3dNucleoService.AbrirPartida(ids, null)).get("id");
    }

    static Entrega vestir(FlairCardInstance... cartas) {
        Map<String, UUID> m = new LinkedHashMap<>();
        for (FlairCardInstance c : cartas) {
            m.put(c.getPosition(), c.getId());
        }
        return new Entrega(m, null, null, null);
    }

    Flair3dMatch partida(UUID id) {
        return kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow();
    }

    ApiException erro(Runnable r) {
        return catchThrowableOfType(ApiException.class, r::run);
    }

    @Test
    void lutaAndaRoundARoundComUmaEspecialDoDeck() {
        FlairCardInstance sup = carta(ana, "SUP");
        FlairCardInstance inf = carta(ana, "INF");
        FlairCardInstance cal = carta(ana, "CAL", "sub:casual_sneakers");
        FlairCardInstance ace = carta(ana, "ACE");
        FlairCardInstance especial = carta(ana, "ACE", "tier:ESPECIAL", "ovr:90");
        FlairCardInstance especialForaDoDeck = carta(ana, "ACE", "tier:ESPECIAL", "ovr:90");
        FlairCardInstance daBia = carta(bia, "ACE", "tier:ESPECIAL");
        UUID id = abrir("DRESS_FIGHTER", sup, inf, cal, ace, especial);
        assertThat(erro(() -> service.acionar(ana, id, null)).code()).isEqualTo("PARTIDA_SEM_ACAO");

        Resultado round1 = service.entregar(ana, id, vestir(sup, inf, cal, ace));
        assertThat(round1.status()).isEqualTo("EM_ACAO");
        assertThat(round1.eventos()).hasSize(1);
        assertThat(partida(id).getStatus()).isEqualTo("EM_ACAO");
        assertThat(partida(id).getPontos()).isNull();
        assertThat(partida(id).getResultadoJson()).isNull();
        assertThat(erro(() -> service.entregar(ana, id, vestir(sup))).status()).isEqualTo(409);
        assertThat(erro(() -> service.previa(ana, id, vestir(sup))).status()).isEqualTo(409);

        assertThat(erro(() -> service.acionar(bia, id, null)).status()).isEqualTo(403);
        assertThat(erro(() -> service.acionar(ana, UUID.randomUUID(), null)).status()).isEqualTo(404);
        assertThat(erro(() -> service.acionar(ana, id, new Acionamento(daBia.getId(), null))).code()).isEqualTo("CARTA_ALHEIA");
        assertThat(erro(() -> service.acionar(ana, id, new Acionamento(especialForaDoDeck.getId(), null))).code()).isEqualTo("CARTA_FORA_DO_DECK");
        ApiException comum = erro(() -> service.acionar(ana, id, new Acionamento(ace.getId(), null)));
        assertThat(comum.status()).isEqualTo(422);
        assertThat(comum.code()).isEqualTo("CARTA_NAO_ESPECIAL");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).acionamentos()).isEmpty();

        Resultado round2 = service.acionar(ana, id, new Acionamento(especial.getId(), null));
        assertThat(round2.status()).isEqualTo("EM_ACAO");
        assertThat(round2.eventos()).extracting(Resultado.Evento::codigo).containsExactly("ROUND", "ESPECIAL", "ROUND");
        assertThat(erro(() -> service.acionar(ana, id, new Acionamento(especial.getId(), null))).code()).isEqualTo("ESPECIAL_JA_USADA");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).acionamentos()).containsExactly(new Acionamento(especial.getId(), null));

        Resultado fim = service.acionar(ana, id, null);
        assertThat(fim.status()).isEqualTo("ENTREGUE");
        assertThat(fim.pontos()).isEqualTo(100);
        assertThat(fim.resultado()).isEqualTo("VITORIA");
        assertThat(fim.eventos()).hasSize(4);
        assertThat(fim.cartas()).hasSize(4);
        Flair3dMatch salva = partida(id);
        assertThat(salva.getStatus()).isEqualTo("ENTREGUE");
        assertThat(salva.getPontos()).isEqualTo(100);
        assertThat(salva.getEstrelas()).isEqualTo(3);
        assertThat(salva.getResultadoJson()).contains("ESPECIAL").contains("\"cartas\"").contains("\"status\":\"ENTREGUE\"");
        ApiException depois = erro(() -> service.acionar(ana, id, null));
        assertThat(depois.status()).isEqualTo(409);
        assertThat(depois.code()).isEqualTo("PARTIDA_SEM_ACAO");
    }

    @Test
    void fashionSportsJogaOPrimeiroTempoEAceitaUmaTrocaDoDeckNoIntervalo() {
        FlairCardInstance sup = carta(ana, "SUP", "ovr:90", "material:linen", "material:leather");
        FlairCardInstance inf = carta(ana, "INF", "ovr:10");
        FlairCardInstance salto = carta(ana, "CAL", "ovr:10", "sub:heels");
        FlairCardInstance chuteira = carta(ana, "CAL", "ovr:90", "sub:casual_sneakers");
        FlairCardInstance foraDoDeck = carta(ana, "CAL", "ovr:90", "sub:casual_sneakers");
        UUID id = abrir("FASHION_SPORTS", sup, inf, salto, chuteira);

        Resultado intervalo = service.entregar(ana, id, vestir(sup, inf, salto));
        assertThat(intervalo.status()).isEqualTo("EM_ACAO");
        assertThat(intervalo.eventos()).contains(new Resultado.Evento("INTERVALO", "0-1"));
        assertThat(partida(id).getStatus()).isEqualTo("EM_ACAO");

        Acionamento fora = new Acionamento(null, new Acionamento.Troca("CAL", foraDoDeck.getId()));
        assertThat(erro(() -> service.acionar(ana, id, fora)).code()).isEqualTo("CARTA_FORA_DO_DECK");
        Acionamento vagaErrada = new Acionamento(null, new Acionamento.Troca("SUP", chuteira.getId()));
        assertThat(erro(() -> service.acionar(ana, id, vagaErrada)).code()).isEqualTo("TROCA_INVALIDA");
        assertThat(partida(id).getStatus()).isEqualTo("EM_ACAO");

        Resultado fim = service.acionar(ana, id, new Acionamento(null, new Acionamento.Troca("CAL", chuteira.getId())));
        assertThat(fim.status()).isEqualTo("ENTREGUE");
        assertThat(fim.resultado()).isEqualTo("EMPATE");
        assertThat(fim.pontos()).isEqualTo(60);
        assertThat(fim.eventos()).contains(new Resultado.Evento("PLACAR", "1-1"), new Resultado.Evento("FORCA_SEGUNDO_TEMPO", 32));
        assertThat(fim.cartas()).extracting(Resultado.CartaPontos::cardId).containsExactly(sup.getId(), inf.getId(), chuteira.getId());
        assertThat(partida(id).getPontos()).isEqualTo(60);
        assertThat(erro(() -> service.acionar(ana, id, null)).status()).isEqualTo(409);
    }

    @Test
    void labirintoSegueAbertoAteOEspelhoAbrirEContaAsTentativas() {
        FlairCardInstance sup = carta(ana, "SUP", "color:navy");
        FlairCardInstance inf = carta(ana, "INF", "color:blue");
        FlairCardInstance cal = carta(ana, "CAL", "color:cobalt");
        FlairCardInstance ace = carta(ana, "ACE", "color:red");
        UUID id = abrir("LABIRINTO", sup, inf, cal, ace);

        Resultado falhou = service.entregar(ana, id, vestir(sup, inf, ace));
        assertThat(falhou.status()).isEqualTo("ABERTA");
        assertThat(falhou.resultado()).isEqualTo("NAO_ABRE");
        assertThat(falhou.pontos()).isZero();
        assertThat(falhou.eventos()).contains(new Resultado.Evento("FALTAM_PECAS", 1), new Resultado.Evento("TENTATIVA", 1));
        assertThat(partida(id).getStatus()).isEqualTo("ABERTA");
        assertThat(partida(id).getPontos()).isNull();
        assertThat(Andamento.ler(partida(id).getEstadoJson()).tentativas()).isEqualTo(1);

        Resultado previa = service.previa(ana, id, vestir(sup, inf, cal));
        assertThat(previa.pontos()).isEqualTo(80);
        assertThat(previa.status()).isEqualTo("ABERTA");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).tentativas()).isEqualTo(1);

        Resultado abriu = service.entregar(ana, id, vestir(sup, inf, cal));
        assertThat(abriu.status()).isEqualTo("ENTREGUE");
        assertThat(abriu.resultado()).isEqualTo("ABRE");
        assertThat(abriu.pontos()).isEqualTo(80);
        assertThat(abriu.estrelas()).isEqualTo(2);
        assertThat(abriu.eventos()).contains(new Resultado.Evento("TENTATIVA", 2));
        assertThat(partida(id).getStatus()).isEqualTo("ENTREGUE");
        assertThat(partida(id).getEstrelas()).isEqualTo(2);
        assertThat(erro(() -> service.entregar(ana, id, vestir(sup, inf, cal))).code()).isEqualTo("PARTIDA_JA_ENTREGUE");

        UUID outra = abrir("LABIRINTO", sup, inf, cal, ace);
        for (int i = 0; i < 3; i++) {
            assertThat(service.entregar(ana, outra, vestir(sup, ace)).status()).isEqualTo("ABERTA");
        }
        Resultado naQuarta = service.entregar(ana, outra, vestir(sup, inf, cal));
        assertThat(naQuarta.resultado()).isEqualTo("ABRE");
        assertThat(naQuarta.pontos()).isZero();
        assertThat(naQuarta.status()).isEqualTo("ENTREGUE");
    }

    @Test
    void previaDevolvePontosERegrasSemFecharAPartida() {
        FlairCardInstance sup = carta(ana, "SUP", "brand:Farm");
        FlairCardInstance inf = carta(ana, "INF", "brand:Farm");
        FlairCardInstance cal = carta(ana, "CAL", "brand:Gucci", "sub:casual_sneakers");
        FlairCardInstance foraDoDeck = carta(ana, "ACE");
        UUID id = abrir("PASSARELA", sup, inf, cal);

        Resultado previa = service.previa(ana, id, vestir(sup, inf));
        assertThat(previa.pontos()).isEqualTo(57);
        assertThat(previa.status()).isEqualTo("ABERTA");
        assertThat(previa.regras()).extracting(Resultado.RegraResultado::codigo).containsExactly("MARCA_BR", "TODAS_BR");
        assertThat(previa.cartas()).containsExactly(new Resultado.CartaPontos("SUP", sup.getId(), 28.57),
                new Resultado.CartaPontos("INF", inf.getId(), 28.57));
        Flair3dMatch intacta = partida(id);
        assertThat(intacta.getStatus()).isEqualTo("ABERTA");
        assertThat(intacta.getEntregaJson()).isNull();
        assertThat(intacta.getEstadoJson()).isNull();
        assertThat(intacta.getPontos()).isNull();
        assertThat(service.previa(ana, id, null).pontos()).isZero();

        assertThat(erro(() -> service.previa(bia, id, vestir(sup))).status()).isEqualTo(403);
        assertThat(erro(() -> service.previa(ana, UUID.randomUUID(), vestir(sup))).status()).isEqualTo(404);
        assertThat(erro(() -> service.previa(ana, id, vestir(foraDoDeck))).code()).isEqualTo("CARTA_FORA_DO_DECK");

        Resultado entrega = service.entregar(ana, id, vestir(sup, inf, cal));
        assertThat(entrega.status()).isEqualTo("ENTREGUE");
        assertThat(entrega.cartas()).extracting(Resultado.CartaPontos::pontos).containsExactly(14.29, 14.29, 0.0);
        assertThat(erro(() -> service.previa(ana, id, vestir(sup))).status()).isEqualTo(409);

        UUID luta = abrir("DRESS_FIGHTER", sup, inf, cal);
        Resultado atributos = service.previa(ana, luta, vestir(sup, inf, cal));
        assertThat(atributos.eventos()).extracting(Resultado.Evento::codigo).containsExactly("VELOCIDADE", "ATAQUE", "DEFESA");
        assertThat(atributos.regras()).isEmpty();
        assertThat(atributos.status()).isEqualTo("ABERTA");
        assertThat(partida(luta).getStatus()).isEqualTo("ABERTA");
    }

    @Test
    void cartaSemEfeitoNoNucleoLevaOMotivoSemBonus() {
        FlairCardInstance neutra = carta(ana, "CAL", "brand:Gucci");
        FlairCardInstance leve = carta(ana, "SUP", "material:linen");
        Map<String, Object> out = service.efeitos(ana, "AROUND_THE_WORLD",
                new Flair3dNucleoService.PedidoEfeitos(List.of(neutra.getId(), leve.getId())));
        assertThat(out.get("efeitos")).isEqualTo(List.of(
                Map.of("cardId", neutra.getId(), "itens", List.of(Efeito.motivo("SEM_BONUS"))),
                Map.of("cardId", leve.getId(), "itens", List.of(new Efeito("CIMA_LEVE", 25)))));
        Map<String, Object> zonas = service.efeitos(ana, "SUPER_HEROI", new Flair3dNucleoService.PedidoEfeitos(List.of(neutra.getId())));
        assertThat(zonas.get("efeitos")).isEqualTo(List.of(Map.of("cardId", neutra.getId(), "itens", List.of())));
    }
}
