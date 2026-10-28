"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { SizePicker } from "@/components/try-on/size-picker";
import { api } from "@/lib/api/client";
import { mannequinBody } from "@/lib/avatar3d/body-spec";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { State } from "@/lib/tryon/fitting-room-model";
import { GRIDS, bodyMeasures, bodyPosition, naturalSize, readMySizes, sizeFit, sizeSteps, writeMySize, type SizeGrid } from "@/lib/tryon/sizes";
import { SizeReferenceTable } from "./SizeReferenceTable";

const GRID_ORDER: { grid: SizeGrid; category: string }[] = [
  { grid: "letter", category: "upper_piece" }, { grid: "numeric", category: "lower_piece" }, { grid: "shoes", category: "shoes_piece" },
];

/**
 * Meus tamanhos (sem formulário): em cada grade do sistema, um toque escolhe o tamanho. O corpo do avatar marca o
 * tamanho dele (•) e a linha diz como o escolhido fica; o provador veste as próximas peças nesse tamanho.
 */
export function FitPage() {
  const { t } = useI18n();
  const [mine, setMine] = useState(readMySizes);
  const state = useApi<State>((signal) => api.get("/api/try-on", { signal }), []);
  const sex: "FEMININO" | "MASCULINO" = state.data?.avatar?.model?.sex ?? (state.data?.mannequin.sex === "FEMININO" ? "FEMININO" : "MASCULINO");
  const measures = state.data?.avatar ? bodyMeasures(mannequinBody(sex, state.data.mannequin.build, state.data.avatar.model?.body), sex) : null;
  return <div>
    <PageHeader title={t("size.pagina_titulo")} lead={t("size.pagina_lead")} />
    <div className="grid gap-5">
      {!measures && !state.loading && <p className="type-body text-muted" role="status">{t("size.sem_avatar")} <Link className="underline" href="/avatar">{t("mirror.criar_avatar")}</Link></p>}
      {GRID_ORDER.map(({ grid, category }) => {
        const position = measures ? bodyPosition(grid, sex, measures, category) : null;
        const natural = position == null ? null : naturalSize(grid, position);
        const chosen = mine[grid] ?? null;
        const steps = position == null ? null : sizeSteps(grid, position, chosen ?? natural);
        return <Card key={grid}>
          <h2 className="type-h3 mb-2">{t(`size.grade.${grid}`)}</h2>
          {natural && <p className="type-body-sm text-muted mb-2">{t("size.avatar_veste", { size: natural })}</p>}
          <SizePicker grid={grid} options={GRIDS[grid]} chosen={chosen} natural={natural} fit={steps == null ? null : sizeFit(grid, steps)}
            label={t(`size.grade.${grid}`)} onPick={(label) => { writeMySize(grid, label); setMine((current) => ({ ...current, [grid]: label })); }} />
          <div className="mt-3"><SizeReferenceTable grid={grid} sex={sex} highlight={chosen ?? natural} /></div>
        </Card>;
      })}
    </div>
  </div>;
}
