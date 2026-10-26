import br.com.fashionai.application.flair.AfterpartyEngine;
import br.com.fashionai.application.flair.AfterpartyEngine.*;
import br.com.fashionai.application.flair.AfterpartyMods;
import java.util.*;

/** Testes práticos 01–06 da auditoria no motor autoritativo do v1, no ritmo do cliente (um MOVE a cada 150 ms). */
public class Scenarios {
  static long now = 1_000; static int seq = 0;
  static List<Loadout> deck() { return List.of(
    new Loadout("staff","Equipe","COMMON","STAFF","#333333",false,null,10,6000),
    new Loadout("guest","Convidada","RARE","GUEST","#884488",false,null,20,9000),
    new Loadout("vip","Gala","LEGENDARY","VIP","#c9a227",false,null,35,14000)); }
  static State game() { now = 1_000; return AfterpartyEngine.start(deck(), AfterpartyMods.NEUTRAL, now); }
  static void act(State s, String type, String deck, double dx, double dz, boolean run) { AfterpartyEngine.apply(s, new Action(type, deck, dx, dz, run, "req_" + (seq++) + "_aud"), now); }
  /** Anda em linha reta até (x,z) no ritmo do cliente; para no bloqueio ou no fim da partida. */
  static String walk(State s, double x, double z, boolean run, int maxSteps) {
    for (int i = 0; i < maxSteps && s.status.equals("ACTIVE"); i++) {
      double dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz); if (d < .2) return "ARRIVED";
      now += 150; act(s, "MOVE", null, dx / d, dz / d, run);
      if (s.feedback.endsWith("_BLOCKED")) return s.feedback;
    }
    return s.status.equals("ACTIVE") ? "TIMEOUT" : s.status;
  }
  static void wait(State s, long ms) { for (long t = 0; t < ms && s.status.equals("ACTIVE"); t += 150) { now += 150; AfterpartyEngine.tick(s, now); } }
  static String fmt(State s) { return String.format(Locale.ROOT, "pos=(%.2f,%.2f) suspeita=%.0f%% energia=%.0f status=%s fase=%s feedback=%s cracha=%s item=%s", s.x, s.z, s.suspicion, s.energy, s.status, s.phase, s.feedback, s.badge, s.item); }

  public static void main(String[] a) {
    // T01 — entrada: do tapete (0,5) em direção ao salão, sem disfarce
    State s = game(); long t0 = now;
    System.out.println("T01 inicio " + fmt(s));
    String r = walk(s, 0, -1, false, 200);
    System.out.printf(Locale.ROOT, "T01 caminhada ate a portaria: %s em %.1fs; %s%n", r, (now - t0) / 1000.0, fmt(s));

    // T02 — primeiro furto: disfarce de equipe, porta lateral, crachá na penteadeira, joia na vitrine VIP
    s = game(); t0 = now; act(s, "ACTIVATE", "staff", 0, 0, false);
    String r1 = walk(s, 3.6, 0.6, false, 200), r2 = walk(s, 3.6, -1.2, false, 200), r3 = walk(s, 4, -2, false, 200);
    now += 150; act(s, "INTERACT", null, 0, 0, false); String fb1 = s.feedback;
    String r4 = walk(s, 1.0, -4.8, false, 300), r5 = walk(s, 0, -5.4, false, 100);
    now += 150; act(s, "INTERACT", null, 0, 0, false);
    System.out.printf(Locale.ROOT, "T02 rotas=[%s,%s,%s] cracha=%s rotas2=[%s,%s] furto=%s em %.1fs; %s%n", r1, r2, r3, fb1, r4, r5, s.feedback, (now - t0) / 1000.0, fmt(s));
    State afterTheft = s;

    // T03 — suspeita: parada na área vista pelos seguranças, depois se afasta
    s = game(); walk(s, 0, 2, false, 100); double before = s.suspicion; wait(s, 2000); double seen = s.suspicion;
    walk(s, 0, 5.5, false, 100); wait(s, 4000); double after = s.suspicion;
    System.out.printf(Locale.ROOT, "T03 suspeita: chegou %.0f%%, 2s parada %.0f%%, depois de sair e esperar 4s %.0f%%; %s%n", before, seen, after, fmt(s));
    s = game(); walk(s, 0, 2, false, 100); wait(s, 8000);
    System.out.println("T03 parada 8s na vista: " + fmt(s));
    s = game(); walk(s, 0, 2, true, 100); wait(s, 3000);
    System.out.println("T03 correndo na vista: " + fmt(s));

    // T04 — confronto: não há ação de combate no motor
    s = game();
    try { now += 150; act(s, "ATTACK", null, 0, 0, false); System.out.println("T04 ATTACK aceito: " + fmt(s)); }
    catch (Exception e) { System.out.println("T04 ATTACK recusado: " + e.getClass().getSimpleName()); }

    // T05 — fuga: com a joia, de volta à saída pelo centro (vista dos seguranças) e pela lateral (fora da vista)
    s = afterTheft; State lateral = AfterpartyEngine.start(deck(), AfterpartyMods.NEUTRAL, 1_000);
    long mark = now; String c = walk(s, 0, 5, false, 300); now += 150; act(s, "INTERACT", null, 0, 0, false);
    System.out.printf(Locale.ROOT, "T05 fuga pelo centro: %s em %.1fs; %s%n", c, (now - mark) / 1000.0, fmt(s));

    // T06 — estresse do motor: 20 000 ações seguidas
    s = game(); long n0 = System.nanoTime(); Random rnd = new Random(7);
    for (int i = 0; i < 20_000 && s.status.equals("ACTIVE"); i++) { now += 150; act(s, "MOVE", null, rnd.nextDouble() * 2 - 1, rnd.nextDouble() * 2 - 1, false); if (s.suspicion > 90) s.suspicion = 0; }
    System.out.printf(Locale.ROOT, "T06 motor: %.3f ms por ação (média de 20 000)%n", (System.nanoTime() - n0) / 1e6 / 20_000);
  }
}
