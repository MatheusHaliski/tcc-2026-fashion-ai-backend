import { useState, type FormEvent } from "react";
import { isoToLocalInput } from "@/lib/seals/availability";
import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { Negotiation } from "@/lib/marketplace/negotiation";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import { Button, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import styles from "./marketplace.module.css";

export function NegotiationForm({
  existing, pieceId, storeId, onSave,
}: { existing: Negotiation | null; pieceId?: string; storeId?: string; onSave: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const filter = new URLSearchParams({ name: search });
  const shops = useApi<{ stores: PhysicalStore[] }>(
    (signal) => api.get(`/api/marketplace/stores?${filter}`, { signal }), [search], { enabled: !existing && !storeId },
  );
  const closet = useApi<{ items: PieceView[] }>(
    (signal) => api.get("/api/me/closet?size=60", { signal }), [], { enabled: !existing && !pieceId },
  );
  const available = closet.data?.items.filter((piece) => piece.visibility === "PUBLIC" && piece.moderationStatus === "APPROVED");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const expiry = new Date(String(fields.get("expiresAt")));
    if (!Number.isFinite(expiry.getTime())) return;
    const body = {
      pieceId: pieceId ?? fields.get("piece"),
      storeId: storeId ?? fields.get("store"),
      recipient: fields.get("recipient"),
      amount: fields.get("amount"),
      currency: "FAI",
      terms: fields.get("terms"),
      expiresAt: expiry.toISOString(),
      version: existing?.version,
    };
    setBusy(true);
    try {
      if (existing) await api.put(`/api/me/marketplace/negotiations/${existing.id}`, body);
      else await api.post("/api/me/marketplace/negotiations", body);
      onSave();
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.directory} onSubmit={save}>
      {!existing && <>
        {!pieceId && <Field id="neg-piece" label={t("marketplace.neg_piece")} required>
          <Select id="neg-piece" name="piece" required defaultValue="">
            <option value="" disabled>{t("marketplace.neg_choose")}</option>
            {available?.map((piece) => <option key={piece.id} value={piece.id}>{piece.name}</option>)}
          </Select>
        </Field>}
        {!storeId && <>
          <Field id="neg-search" label={t("marketplace.filter_name")}>
            <Input id="neg-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </Field>
          <Field id="neg-store" label={t("marketplace.physical_stores")} required>
            <Select id="neg-store" name="store" required key={search} defaultValue="">
              <option value="" disabled>{t("marketplace.neg_choose")}</option>
              {shops.data?.stores.filter((store) => store.brandProfileSlug).map((store) => <option key={store.id} value={store.id}>{store.brand} · {store.name} · {store.city}</option>)}
            </Select>
          </Field>
        </>}
        <Field id="neg-recipient" label={t("marketplace.neg_recipient")}>
          <Input id="neg-recipient" name="recipient" maxLength={30} />
        </Field>
      </>}
      <div className={styles.filters}>
        <Field id="neg-price" label={t("marketplace.neg_price")} required>
          <Input id="neg-price" name="amount" type="number" step="1" min="1" max="9999999999" required defaultValue={existing?.amount} />
        </Field>
        <Field id="neg-expiry" label={t("marketplace.expiry")} required>
          <Input id="neg-expiry" name="expiresAt" type="datetime-local" required defaultValue={isoToLocalInput(existing?.expiresAt)} />
        </Field>
      </div>
      <Field id="neg-terms" label={t("marketplace.neg_terms")}>
        <Textarea id="neg-terms" name="terms" maxLength={1000} defaultValue={existing?.terms ?? ""} />
      </Field>
      <Button variant="primary" type="submit" loading={busy}>{t("marketplace.neg_send")}</Button>
    </form>
  );
}
