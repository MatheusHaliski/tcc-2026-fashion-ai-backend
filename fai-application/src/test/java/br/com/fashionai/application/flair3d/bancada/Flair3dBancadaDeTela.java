package br.com.fashionai.application.flair3d.bancada;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.flair3d.Flair3dProgresso;
import br.com.fashionai.application.flair3d.Flair3dRascunho;
import br.com.fashionai.application.flair3d.Flair3dRetomada;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoUso;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bancada de tela do FLAIR 3D: as regras de verdade do servidor (os mesmos services, com os repositórios em memória do
 * {@link Kit}) atrás de um HTTP local, para jogar uma partida inteira pela tela do jogo sem banco, sem rede e sem conta
 * real. Serve só os contratos que /flair/3d/[nucleo] usa. Não roda na suíte: só com a porta pedida.
 *
 * <pre>mvn -o -pl fai-application -am -Dtest=Flair3dBancadaDeTela -Dflair3d.bancada.porta=8131 \
 *     -Dsurefire.failIfNoSpecifiedTests=false test</pre>
 *
 * Fica de pé até o processo ser encerrado (ou até {@code -Dflair3d.bancada.minutos}, padrão 120). O roteiro do navegador
 * está em docs/flair/flair-3d/BANCADA_DE_TELA.md.
 */
class Flair3dBancadaDeTela {
    private static final Pattern NUCLEO = Pattern.compile("/api/flair/3d/nucleos/([A-Za-z_0-9]+)(?:/(efeitos|partidas|progresso|em-andamento))?");
    private static final Pattern PARTIDA = Pattern.compile("/api/flair/3d/partidas/([0-9a-f-]+)/(entrega|previa|acionar|rascunho|recursos|usar)");

    private Flair3dNucleoService service;
    private Flair3dRetomada retomada;
    private Flair3dProgresso progresso;
    private Flair3dRascunho rascunho;
    private Flair3dRecursoUso uso;
    private CurrentUser ana;
    private List<FlairCardInstance> cartas;

    @Test
    @EnabledIfSystemProperty(named = "flair3d.bancada.porta", matches = "\\d+")
    void servir() throws Exception {
        Kit kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
        Flair3dMatchRepository partidas = kit.dep(Flair3dMatchRepository.class);
        retomada = new Flair3dRetomada(partidas, service);
        progresso = new Flair3dProgresso(partidas);
        rascunho = new Flair3dRascunho(partidas, service);
        uso = kit.build(Flair3dRecursoUso.class);
        cartas = Flair3dBancadaGuardaRoupa.cartas(ana.id()).stream().map(c -> kit.save(FlairCardInstanceRepository.class, c)).toList();

        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", Integer.getInteger("flair3d.bancada.porta")), 0);
        http.createContext("/", this::atender);
        http.start();
        try {
            Thread.sleep(Integer.getInteger("flair3d.bancada.minutos", 120) * 60_000L);
        } finally {
            http.stop(0);
        }
    }

    private synchronized void atender(HttpExchange x) throws IOException {
        int status = 200;
        Object corpo;
        try {
            byte[] lido = x.getRequestBody().readAllBytes();
            corpo = rota(x.getRequestMethod(), x.getRequestURI().getPath(), lido.length == 0 ? "{}" : new String(lido, StandardCharsets.UTF_8));
            if (corpo == null) {
                status = 204;
            }
        } catch (ApiException e) {
            status = e.status();
            Map<String, Object> erro = new LinkedHashMap<>();
            erro.put("status", e.status());
            erro.put("code", e.code());
            erro.put("message", String.valueOf(e.getMessage()));
            erro.put("details", e.details());
            corpo = erro;
        } catch (RuntimeException e) {
            status = 500;
            corpo = Map.of("status", 500, "code", "BANCADA", "message", String.valueOf(e));
        }
        byte[] saida = corpo == null ? new byte[0] : Json.write(corpo).getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        x.sendResponseHeaders(status, status == 204 ? -1 : saida.length);
        if (status != 204) {
            x.getResponseBody().write(saida);
        }
        x.close();
    }

    private static <T> T ler(String json, Class<T> tipo) {
        return Json.MAPPER.readValue(json, tipo);
    }

    /** O que cada rota devolve (nulo = 204); rota que a tela não usa responde 404, para aparecer no roteiro. */
    private Object rota(String metodo, String caminho, String json) {
        if (caminho.equals("/api/me/flair/cards")) {
            return Map.of("season", "SPRING", "counts", Map.of(), "total", cartas.size(),
                    "cards", cartas.stream().map(Flair3dBancadaGuardaRoupa::naColecao).toList());
        }
        if (caminho.equals("/api/flair/3d/nucleos")) {
            return service.lista();
        }
        Matcher n = NUCLEO.matcher(caminho);
        if (n.matches()) {
            return doNucleo(n.group(1), n.group(2), json);
        }
        Matcher p = PARTIDA.matcher(caminho);
        if (p.matches()) {
            return daPartida(UUID.fromString(p.group(1)), p.group(2), json);
        }
        throw new ApiException(404, "BANCADA_SEM_ROTA", metodo + " " + caminho);
    }

    private Object doNucleo(String codigo, String resto, String json) {
        if (resto == null) {
            return service.definicao(codigo);
        }
        return switch (resto) {
            case "efeitos" -> service.efeitos(ana, codigo, ler(json, Flair3dNucleoService.PedidoEfeitos.class));
            case "progresso" -> progresso.doJogo(ana, codigo);
            case "em-andamento" -> retomada.emAndamento(ana, codigo).orElse(null);
            default -> {
                Flair3dNucleoService.AbrirPartida pedido = ler(json, Flair3dNucleoService.AbrirPartida.class);
                progresso.conferirAberta(ana, codigo, pedido.rodada());
                yield service.abrir(ana, codigo, pedido);
            }
        };
    }

    private Object daPartida(UUID id, String resto, String json) {
        return switch (resto) {
            case "entrega" -> service.entregar(ana, id, ler(json, Entrega.class));
            case "previa" -> service.previa(ana, id, ler(json, Entrega.class));
            case "acionar" -> service.acionar(ana, id, ler(json, Acionamento.class));
            case "rascunho" -> rascunho.guardar(ana, id, ler(json, Entrega.class));
            case "usar" -> uso.usar(ana, id, ler(json, Flair3dRecursoUso.PedidoDeUso.class));
            default -> uso.estado(ana, id);
        };
    }
}
