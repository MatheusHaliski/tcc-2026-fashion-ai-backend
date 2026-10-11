"use client";
import { useState } from "react";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, Field, Input, PageHeader, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
const COLORS = ["ground", "surface", "surface-2", "ink", "muted", "faint", "mark", "thread", "chalk"];
/** Reference page for reviewing the actual shared components in every theme and viewport. */
export default function DesignPage() {
  const { t } = useI18n(); const [open, setOpen] = useState(false); const [checked, setChecked] = useState(false);
  return <RequireAuth admin><PageHeader title={t("design.title")} lead={t("design.lead")} />
    <div className="grid gap-4 md:grid-cols-2">
      <Card><h2 className="type-h2">{t("design.typography")}</h2><p className="type-h1 mt-3">FashionAI</p><p className="type-body mt-2">{t("design.sample")}</p><p className="type-caption text-faint mt-2">{t("design.caption")}</p><p className="type-label mt-2">{t("design.label")}</p></Card>
      <Card><h2 className="type-h2">{t("design.controls")}</h2><div className="flex flex-wrap gap-2 my-3"><Button variant="primary" onClick={() => setOpen(true)}>{t("common.open")}</Button><Button>{t("common.cancel")}</Button><Button disabled>{t("common.save")}</Button><Badge tone="chalk">{t("common.new")}</Badge></div><Field label={t("common.name")} id="design-name"><Input id="design-name" /></Field><Switch checked={checked} onChange={setChecked} label={t("settings.notifications")} /></Card>
      <Card className="md:col-span-2"><h2 className="type-h2">{t("design.colors")}</h2><div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mt-3">{COLORS.map(token => <figure key={token}><div className="h-16 rounded border border-line-soft" style={{ background: `var(--${token})` }} /><figcaption className="type-caption mt-1">{token}</figcaption></figure>)}</div></Card>
    </div><Dialog open={open} onClose={() => setOpen(false)} title={t("design.dialog")} footer={<Button onClick={() => setOpen(false)}>{t("common.close")}</Button>}><Field label={t("common.name")} id="design-dialog-name"><Input id="design-dialog-name" /></Field></Dialog>
  </RequireAuth>;
}
