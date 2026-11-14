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
