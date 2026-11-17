"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { api } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import type { useTaxonomy } from "@/lib/api/taxonomy";
import type { CatalogSearchContext } from "@/components/catalog/catalog-search";
import { EMPTY_PIECE, type PieceFormValue } from "@/components/piece-form";
import { validPiecePrefill, type PiecePrefillParams } from "@/lib/pieces/prefill";
import { useApi } from "@/lib/hooks/use-api";

/** Pré-preenchimento de criação: Lens, taxonomia tardia e tipo padrão do perfil. */
export function usePieceCreationState(initial: Partial<CatalogSearchContext>, prefill: PiecePrefillParams,
                                      tax: ReturnType<typeof useTaxonomy>, categoryIds: string[]) {
  const [pre] = useState(() => validPiecePrefill(prefill, tax, categoryIds));
  const [value, updateValue] = useState<PieceFormValue>(() => ({
    ...EMPTY_PIECE,
    useDefaultImage: true,
    category: initial.category ?? "",
    subcategory: pre.subcategory || (initial.subcategory ?? ""),
    brandName: initial.brand ?? "",
    name: pre.name,
    color: pre.color,
    material: pre.material,
    style: pre.style,
  }));
  const [catalogSub, setCatalogSub] = useState(pre.subcategory);
  const lateApplied = useRef(!!tax);
  const preference = useApi<{ tipoLook: TipoLook | null }>((signal) =>
    api.get("/api/me/preferences/tipo-look", { signal }), []);
  const code = preference.data?.tipoLook?.codigo;
  const sex = code === "UNISEX" ? "UNISSEX" : code;

  // Mantém o tipo configurado ao escolher um produto/foto ou reiniciar o formulário após salvar.
  const setValue = useCallback((next: SetStateAction<PieceFormValue>) => {
    updateValue((current) => {
      const result = typeof next === "function" ? next(current) : next;
      return sex ? { ...result, sex } : result;
    });
  }, [sex]);
  useEffect(() => {
    if (sex) updateValue((current) => ({ ...current, sex }));
  }, [sex]);

  useEffect(() => {
    if (lateApplied.current || !tax) return;
    lateApplied.current = true;
    const late = validPiecePrefill(prefill, tax, categoryIds);
    // Só completa campos ainda vazios; o subtipo depende de a categoria continuar a mesma.
    updateValue((current) => ({
      ...current,
      subcategory: current.subcategory || (current.category === late.category ? late.subcategory : ""),
      color: current.color || late.color,
      material: current.material || late.material,
      style: current.style.length ? current.style : late.style,
    }));
    if (late.subcategory) setCatalogSub(late.subcategory);
  }, [tax, prefill, categoryIds]);

  return { value, setValue, pre, catalogSub };
}
