"use client";
import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";
import { ExpandedPiece } from "@/components/expanded-card";

/**
 * Peça ampliada (RF7): a página é o próprio card ampliado, com os botões no fim e tudo dentro da borda. Vinda de um
 * look (RF7.CA01/CA03), mostra o atalho de volta ao look de origem.
 */
export default function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t } = useI18n(); const sp = useSearchParams();
  const fromScheme = sp.get("fromScheme");
  return (
    <div className="expanded-page">
      {fromScheme && <p className="mb-3"><Link href={`/schemes/${fromScheme}`} className="btn btn-sm"><FaiIcon id="SOC-10" size={20} variant="glyph" decorative />{t("pieces.id.voltar_ao_look", { value: "" })}</Link></p>}
      <ExpandedPiece id={id} from={fromScheme} startEditing={sp.get("edit") === "1"} />
    </div>
  );
}
