package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Ponto;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveAcusacao;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveMundo;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O estado da investigação depois dos passos jogados (refeito do começo a cada pedido, a partir da semente e dos
 * acionamentos): sala e ponto, vida, relógio, pistas, chaves, portas abertas, vigias convencidos e furtados, enigmas e
 * a acusação. {@link #retrato} é o que a tela recebe; a resposta dos enigmas e o culpado nunca entram nele.
 */
final class DetetiveEstado {
    static final int VIDA = 3;
    /** Relógio da partida: no máximo 45 minutos; passou, Iolanda chama para a passarela. */
    static final int LIMITE_DE_TEMPO = 45 * 60;

    String sala = FashionDetectiveMundo.INICIO;
    String ponto = DetetiveSalas.sala(FashionDetectiveMundo.INICIO).entrada().id();
    /** por onde a pessoa entrou na sala (volta para cá sem vida) e o último esconderijo em que esteve */
    String chegada = ponto;
    String ultimaCobertura;
    boolean escondido;
    int vida = VIDA;
    int tempo;
    int passo;
    int penalidades;
    int tentativas;
    final Map<String, Boolean> pistas = new LinkedHashMap<>();
    final Set<String> chaves = new LinkedHashSet<>();
    final Set<String> abertos = new LinkedHashSet<>();
    final Set<String> portasAbertas = new LinkedHashSet<>();
    final Set<String> convencidos = new LinkedHashSet<>();
    final Set<String> furtados = new LinkedHashSet<>();
    final Set<String> resolvidas = new LinkedHashSet<>();
    final Set<String> visitadas = new LinkedHashSet<>(List.of(FashionDetectiveMundo.INICIO));
    final Map<String, Integer> erros = new HashMap<>();
    /** os vigias fora da ronda (perseguindo, procurando, voltando) na sala de agora ({@link DetetivePerseguicao}) */
    final Map<String, DetetivePerseguicao.Alerta> alertas = new LinkedHashMap<>();
    String salaDosAlertas = FashionDetectiveMundo.INICIO;
    /** a cutscene que a tela mostra agora ("ABERTURA:SALAO", "RESOLUCAO:CAMARIM", "ALIBI:4", "FINAL:COMPLETO") */
    String cutscene = "ABERTURA:" + FashionDetectiveMundo.INICIO;
    /** o que acabou de acontecer (VISTO, BOLSO_OK, CHAVE:K1, PISTA:P3...) */
    final List<String> avisos = new ArrayList<>();
    FashionDetectiveAcusacao.Final fim;

    DetetiveSala salaAtual() {
        return DetetiveSalas.sala(sala);
    }

    Ponto pontoAtual() {
        return salaAtual().ponto(ponto);
    }

    static String porta(String a, String b) {
        return a.compareTo(b) < 0 ? a + "-" + b : b + "-" + a;
    }

    int pistasCompletas() {
        return (int) pistas.values().stream().filter(Boolean::booleanValue).count();
    }

    /** O retrato para a tela: tudo o que a pessoa pode ver, mais a sala em que está. */
    Map<String, Object> retrato(List<UUID> mao, int baralho) {
        DetetiveSala s = salaAtual();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("sala", sala);
        r.put("ponto", ponto);
        r.put("escondido", escondido);
        r.put("vida", vida);
        r.put("tempo", tempo);
        r.put("limite", LIMITE_DE_TEMPO);
        r.put("pistas", pistas.entrySet().stream().map(e -> Map.of("id", e.getKey(), "completa", e.getValue())).toList());
        r.put("totalDePistas", DetetiveSalas.PISTAS.size());
        r.put("chaves", List.copyOf(chaves));
        r.put("visitadas", List.copyOf(visitadas));
        r.put("resolvidas", List.copyOf(resolvidas));
        r.put("portasAbertas", List.copyOf(portasAbertas));
        r.put("cutscene", cutscene);
        r.put("avisos", List.copyOf(avisos));
        r.put("dica", erros.getOrDefault(sala, 0) > 0);
        r.put("tentativas", tentativas);
        r.put("final", fim == null ? null : fim.name());
        r.put("mao", mao.stream().map(UUID::toString).toList());
        r.put("baralho", baralho);
        r.put("alcance", DetetiveVigias.ALCANCE);
        r.put("meiaAbertura", DetetiveVigias.MEIA_ABERTURA);
        r.put("passoMaximo", DetetiveSala.PASSO);
        r.put("layout", layout(s));
        r.put("mapa", FashionDetectiveMundo.PORTAS.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("de", p.de());
            m.put("para", p.para());
            m.put("chave", p.chave());
            return m;
        }).toList());
        return r;
    }

    private Map<String, Object> layout(DetetiveSala s) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("pontos", s.pontos().stream().map(p -> Map.of("id", p.id(), "x", p.x(), "z", p.z(), "esconderijo", p.esconderijo())).toList());
        l.put("armarios", s.armarios().stream().map(a -> Map.of("id", a.id(), "ponto", a.ponto(), "aberto", abertos.contains(s.id() + ":" + a.id()))).toList());
        l.put("saidas", s.saidas().stream().map(x -> {
            var p = FashionDetectiveMundo.porta(s.id(), x.para()).orElseThrow();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ponto", x.ponto());
            m.put("para", x.para());
            m.put("chave", p.chave());
            m.put("aberta", p.chave() == null || portasAbertas.contains(porta(s.id(), x.para())));
            m.put("barrada", s.vigias().stream().anyMatch(v -> x.para().equals(v.barra()) && !convencidos.contains(v.id())));
            return m;
        }).toList());
        l.put("vigias", s.vigias().stream().map(v -> {
            Ponto onde = DetetivePerseguicao.onde(this, s, v);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", v.id());
            m.put("papel", v.papel());
            m.put("ponto", onde.id());
            m.put("x", onde.x());
            m.put("z", onde.z());
            m.put("olhar", DetetivePerseguicao.olhar(this, s, v));
            Ponto depois = alertas.containsKey(v.id()) ? onde : DetetiveVigias.onde(s, v, passo + 1);
            m.put("proximo", List.of(depois.x(), depois.z()));
            m.put("modo", DetetivePerseguicao.modo(this, v));
            m.put("vigia", v.barra() == null);
            m.put("barra", v.barra());
            m.put("convencido", convencidos.contains(v.id()));
            m.put("temBolso", v.bolso() != null && !furtados.contains(v.id()));
            return m;
        }).toList());
        l.put("enigma", s.enigma() == null ? null : Map.of("id", s.enigma().id(), "opcoes", s.enigma().opcoes()));
        return l;
    }
}
