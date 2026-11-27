import { tr } from "@/lib/i18n/i18n";

/** Campo com problema → nome que a pessoa vê no formulário. */
const FIELD_LABEL: Record<string, string> = {
  name: "common.nome",
  category: "common.category",
  subcategory: "common.subcategory",
  color: "common.color",
  material: "common.material",
  price: "common.price",
  occasion: "common.occasion",
  style: "common.style",
};

/**
 * Aviso da etapa "Peça" do criador quando a pessoa tenta avançar sem os campos obrigatórios: diz quais faltam.
 * `errors` é o resultado de `validatePieceForm`; sem erros devolve `null` (pode avançar).
 */
export function pieceStepProblem(errors: Record<string, string>): string | null {
  const fields = Object.keys(errors);
  if (!fields.length) return null;
  const names = fields.map((k) => (FIELD_LABEL[k] ? tr(FIELD_LABEL[k]).toLowerCase() : k));
  return tr("pieces.new.falta_preencher", { campos: names.join(", ") });
}

const REQUIRED_FIELDS = ["name", "category", "subcategory", "color", "material", "price"] as const;

/**
 * Erros que ainda valem: o aviso de um campo obrigatório some quando o campo é preenchido por outro caminho
 * (o tipo da peça escolhido nos botões do topo preenche a categoria sem passar pelo formulário).
 */
export function liveFieldErrors(errors: Record<string, string>, value: Partial<Record<(typeof REQUIRED_FIELDS)[number], unknown>>): Record<string, string> {
  const filled = REQUIRED_FIELDS.filter((k) => errors[k] && value[k] !== "" && value[k] != null);
  if (!filled.length) return errors;
  const live = { ...errors };
  for (const k of filled) delete live[k];
  return live;
}

/** Controle do primeiro campo com erro na etapa (ou o resumo "Para avançar, preencha…" quando não há campo marcado). */
export function firstStepProblem(root: ParentNode): HTMLElement | null {
  const message = root.querySelector<HTMLElement>("#piece-form-fields .error-text");
  if (!message) return root.querySelector<HTMLElement>("[data-step-problem]");
  const control = message.parentElement?.querySelector<HTMLElement>("input, select, textarea, button");
  return control ?? message;
}

/**
 * Depois de trocar de etapa: em geral a tela volta ao topo; quando a troca foi barrada por campo faltando, a tela vai
 * até o primeiro campo com erro e põe o foco nele, com a mensagem à vista (antes voltava ao topo, longe de qualquer aviso).
 */
export function scrollAfterStep(toProblem: boolean) {
  if (typeof window === "undefined") return;
  if (!toProblem) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  // espera o React desenhar os avisos e abrir "Mais detalhes" antes de procurar o campo
  window.setTimeout(() => {
    const target = firstStepProblem(document);
    if (!target) return;
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }, 60);
}
