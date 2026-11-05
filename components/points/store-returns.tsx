"use client";

import type { StoreOrder } from "@/lib/store/types";

/** RF-PESQ-02 — pedido de troca/devolução (implementado no lote seguinte). */
export function ReturnRequest({ order, onChanged }: { order: StoreOrder; onChanged: () => void }) {
  void order; void onChanged;
  return null;
}
