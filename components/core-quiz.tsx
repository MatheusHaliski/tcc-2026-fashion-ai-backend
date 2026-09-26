"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { Button, Dialog, useToast } from "@/components/ui";

/**
 * DET-C06 — "Qual é o seu core?": seis perguntas curtas que traduzem o arquétipo do DNA (Kibbe) para o vocabulário
 * das microestéticas "-core". O resultado fica nas preferências (coreAesthetic) e aparece no card do DNA.
 */
export const CORES = ["OLD_MONEY", "QUIET_LUXURY", "GORPCORE", "COQUETTE", "Y2K", "STREETWEAR", "DARK_ACADEMIA", "COTTAGECORE"] as const;
export type Core = (typeof CORES)[number];
/** Os nomes das microestéticas são termos internacionais: iguais em todos os idiomas. */
export const CORE_NAME: Record<Core, string> = { OLD_MONEY: "Old money", QUIET_LUXURY: "Quiet luxury", GORPCORE: "Gorpcore", COQUETTE: "Coquette", Y2K: "Y2K", STREETWEAR: "Streetwear", DARK_ACADEMIA: "Dark academia", COTTAGECORE: "Cottagecore" };
/** Enquanto o quiz não é feito, o card do DNA sugere um core pelo arquétipo. */
export const CORE_BY_ARCHETYPE: Record<string, Core> = { CLASSIC: "OLD_MONEY", ROMANTIC: "COQUETTE", DRAMATIC: "STREETWEAR", NATURAL: "GORPCORE", GAMINE: "Y2K" };
export const coreDescription = (c: Core) => tr(`coreQuiz.desc.${c}`);

type Weights = Partial<Record<Core, number>>;
const QUESTIONS: { id: string; options: { id: string; w: Weights }[] }[] = [
  { id: "q1", options: [{ id: "a", w: { OLD_MONEY: 2, QUIET_LUXURY: 1 } }, { id: "b", w: { GORPCORE: 2, COTTAGECORE: 1 } }, { id: "c", w: { Y2K: 2, STREETWEAR: 1 } }, { id: "d", w: { DARK_ACADEMIA: 2, COQUETTE: 1 } }] },
  { id: "q2", options: [{ id: "a", w: { QUIET_LUXURY: 2, OLD_MONEY: 1 } }, { id: "b", w: { GORPCORE: 2, STREETWEAR: 1 } }, { id: "c", w: { COQUETTE: 2, COTTAGECORE: 1 } }, { id: "d", w: { Y2K: 2 } }] },
  { id: "q3", options: [{ id: "a", w: { QUIET_LUXURY: 2, OLD_MONEY: 1 } }, { id: "b", w: { DARK_ACADEMIA: 2, COTTAGECORE: 1 } }, { id: "c", w: { COQUETTE: 2, Y2K: 1 } }, { id: "d", w: { STREETWEAR: 2, GORPCORE: 1 } }] },
  { id: "q4", options: [{ id: "a", w: { QUIET_LUXURY: 2 } }, { id: "b", w: { OLD_MONEY: 2 } }, { id: "c", w: { STREETWEAR: 2, Y2K: 1 } }, { id: "d", w: { GORPCORE: 2 } }] },
  { id: "q5", options: [{ id: "a", w: { OLD_MONEY: 2, DARK_ACADEMIA: 1 } }, { id: "b", w: { GORPCORE: 2 } }, { id: "c", w: { COQUETTE: 2, COTTAGECORE: 1 } }, { id: "d", w: { STREETWEAR: 2, Y2K: 1 } }] },
  { id: "q6", options: [{ id: "a", w: { COTTAGECORE: 2, OLD_MONEY: 1 } }, { id: "b", w: { DARK_ACADEMIA: 2 } }, { id: "c", w: { Y2K: 2 } }, { id: "d", w: { QUIET_LUXURY: 1, GORPCORE: 1 } }] },
];

/** Soma os pesos; empate fica com o core que vem antes na lista (ordem fixa, resultado estável). */
export function scoreCore(answers: Record<string, string>): Core {
  const total: Record<string, number> = {};
  for (const q of QUESTIONS) { const o = q.options.find((x) => x.id === answers[q.id]); if (o) for (const [k, v] of Object.entries(o.w)) total[k] = (total[k] ?? 0) + (v ?? 0); }
  return CORES.reduce((best, c) => ((total[c] ?? 0) > (total[best] ?? 0) ? c : best), CORES[0]);
}

export function CoreQuiz({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (core: Core) => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const done = step >= QUESTIONS.length; const result = done ? scoreCore(answers) : null;
  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  function reset() { setStep(0); setAnswers({}); }
  async function save() {
    if (!result) return; setBusy(true);
    try { await api.put("/api/me/preferences", { coreAesthetic: result, clientUpdatedAt: new Date().toISOString() }); toast.success(t("coreQuiz.salvo", { core: CORE_NAME[result] })); onSaved(result); onClose(); reset(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={() => { onClose(); reset(); }} title={t("coreQuiz.titulo")} size="lg"
      footer={done ? <><Button onClick={reset}>{t("coreQuiz.refazer")}</Button><Button variant="primary" onClick={save} loading={busy}>{t("coreQuiz.salvar")}</Button></>
        : step > 0 ? <Button onClick={() => setStep((s) => s - 1)}>{t("coreQuiz.voltar")}</Button> : undefined}>
      {!done ? (
        <div className="grid gap-3">
          <div className="core-quiz-progress" aria-hidden><i style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></div>
          <p className="type-caption text-muted">{t("coreQuiz.pergunta_n", { n: step + 1, total: QUESTIONS.length })}</p>
          <h3 className="type-h3">{t(`coreQuiz.${q.id}.pergunta`)}</h3>
          <div className="core-quiz-options" role="group" aria-label={t(`coreQuiz.${q.id}.pergunta`)}>
            {q.options.map((o) => <button key={o.id} type="button" className="core-quiz-option type-body" aria-pressed={answers[q.id] === o.id}
              onClick={() => { setAnswers((a) => ({ ...a, [q.id]: o.id })); setStep((s) => s + 1); }}>{t(`coreQuiz.${q.id}.${o.id}`)}</button>)}
          </div>
        </div>
      ) : result && (
        <div className="grid gap-2">
          <p className="label">{t("coreQuiz.seu_core")}</p>
          <p className="type-display">{CORE_NAME[result]}</p>
          <p className="type-body">{coreDescription(result)}</p>
          <p className="type-caption text-muted">{t("coreQuiz.nota")}</p>
        </div>
      )}
    </Dialog>
  );
}
