"use client";
import { useState, type DragEvent } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { NAV_GROUPS } from "@/lib/nav/nav-items";
import { applyNavOrder, move, moveTo, setNavOrder, snapshot, useNavOrder } from "@/lib/nav/nav-order";
import { FaiIcon } from "@/components/fai-icon";
import { Button, UiIcon, useToast } from "@/components/ui";

/**
 * RF23 — customização salva por usuário: a pessoa reordena os grupos do menu lateral (ex.: Guarda-roupa primeiro) e os
 * itens dentro de cada grupo (ex.: Meu Quarto no topo do Guarda-roupa). Cada mudança já vale no menu e é salva no perfil;
 * "Restaurar" volta à ordem padrão. Grupo e item têm controles visualmente diferentes (o grupo, botões com texto; o item,
 * setas e alça de arrastar) para não se confundir qual dos dois está sendo movido. As setas funcionam no teclado, no
 * leitor de tela e no celular; arrastar é o atalho no computador e só reordena dentro do mesmo grupo.
 */
export function NavOrderEditor() {
  const { t } = useI18n(); const toast = useToast();
  const order = useNavOrder();
  const groups = applyNavOrder(NAV_GROUPS, order);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{ gi: number; ii: number } | null>(null);

  const save = (next: typeof groups | null) => {
    setStatus("");
    setNavOrder(next ? snapshot(next) : null).then(() => setStatus(t(next ? "settings.navOrder.saved" : "settings.navOrder.restored")), (e) => toast.fromError(e));
  };
  const withItems = (gi: number, reorder: (items: (typeof groups)[number]["items"]) => (typeof groups)[number]["items"]) =>
    save(groups.map((g, i) => (i === gi ? { ...g, items: reorder(g.items) } : g)));

  const onDrop = (gi: number, ii: number) => (e: DragEvent) => {
    e.preventDefault();
    if (drag && drag.gi === gi && drag.ii !== ii) withItems(gi, (items) => moveTo(items, drag.ii, ii));
    setDrag(null);
  };

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3" aria-label={t("settings.navOrder.title")}>
        {groups.map((g, gi) => {
          const name = t(g.key);
          return (
            <li key={g.key} className="rounded-lg border border-line-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-label">{t("settings.navOrder.groupTitle", { n: gi + 1, name })}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" aria-label={t("settings.navOrder.moveGroupUp", { name })} disabled={gi === 0} onClick={() => save(move(groups, gi, -1))}>
                    <UiIcon name="chevronDown" size={16} className="rotate-180" /> {t("settings.navOrder.groupUp")}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={t("settings.navOrder.moveGroupDown", { name })} disabled={gi === groups.length - 1} onClick={() => save(move(groups, gi, 1))}>
                    <UiIcon name="chevronDown" size={16} /> {t("settings.navOrder.groupDown")}
                  </Button>
                </span>
              </div>
              <ol className="mt-2 grid gap-1 border-l-2 border-line-soft pl-3" aria-label={name}>
                {g.items.map((n, ii) => {
                  const label = t(n.key);
                  const dragging = drag?.gi === gi && drag.ii === ii;
                  return (
                    <li key={n.href} draggable
                      onDragStart={(e) => { setDrag({ gi, ii }); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { if (drag?.gi === gi) e.preventDefault(); }}
                      onDrop={onDrop(gi, ii)} onDragEnd={() => setDrag(null)}
                      className={`flex items-center justify-between gap-2 rounded-md px-1 ${dragging ? "opacity-50" : ""}`}>
                      <span className="flex min-w-0 items-center gap-2 type-body-sm">
                        <span className="cursor-grab text-muted" title={t("settings.navOrder.dragHint")}><UiIcon name="menu" size={16} /></span>
                        <span className="w-5 text-right tabular text-muted">{ii + 1}.</span>
                        <FaiIcon id={n.icon} size={20} variant="glyph" decorative />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" aria-label={t("settings.navOrder.moveUp", { name: label })} disabled={ii === 0} onClick={() => withItems(gi, (items) => move(items, ii, -1))}>
                          <UiIcon name="chevronDown" size={18} className="rotate-180" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={t("settings.navOrder.moveDown", { name: label })} disabled={ii === g.items.length - 1} onClick={() => withItems(gi, (items) => move(items, ii, 1))}>
                          <UiIcon name="chevronDown" size={18} />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => save(null)} disabled={!order}>{t("settings.navOrder.reset")}</Button>
        <span className="type-caption text-muted" role="status" aria-live="polite">{status}</span>
      </div>
    </div>
  );
}
