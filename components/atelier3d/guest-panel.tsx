"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Input, Select } from "@/components/ui";
import type { sceneApi } from "./scene-api";
import type { GuestInvite } from "./contracts";
import styles from "./editor.module.css";
export function GuestPanel({
  client,
}: {
  client: ReturnType<typeof sceneApi>;
}) {
  const { t, fmtDateTime } = useI18n();
  const [invites, setInvites] = useState<GuestInvite[]>([]),
    [name, setName] = useState(""),
    [role, setRole] = useState("VIEWER"),
    [hours, setHours] = useState(24),
    [allow, setAllow] = useState(false),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    client
      .invites()
      .then((r) => {
        if (alive) setInvites(r);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [client]);
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const r = await client.invite({
        label: name,
        role,
        hours,
        allowExport: allow,
      });
      setLink(`${location.origin}/atelier/guest/${r.invite.id}#${r.token}`);
      setInvites(await client.invites());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.evidence}>
      <h2 className="type-h3">{t("atelier3d.guests.title")}</h2>
      <p>{t("atelier3d.guests.hint")}</p>
      <div className={styles.toolbar}>
        <Field id="guest-name" label={t("atelier3d.guests.name")}>
          <Input
            id="guest-name"
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id="guest-role" label={t("atelier3d.guests.role")}>
          <Select
            id="guest-role"
            value={role}
            disabled={busy}
            onChange={(e) => setRole(e.target.value)}
          >
            {["VIEWER", "EDITOR"].map((r) => (
              <option key={r} value={r}>
                {t(`atelier3d.guests.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="guest-hours" label={t("atelier3d.guests.hours")}>
          <Input
            id="guest-hours"
            type="number"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </Field>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allow}
            onChange={(e) => setAllow(e.target.checked)}
          />
          {t("atelier3d.guests.export")}
        </label>
        <Button disabled={busy || !name.trim()} onClick={() => void create()}>
          {t("atelier3d.guests.create")}
        </Button>
      </div>
      {link && (
        <Field id="guest-link" label={t("atelier3d.guests.link")}>
          <Input
            id="guest-link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </Field>
      )}
      {error && <p role="alert">{t("atelier3d.guests.error")}</p>}
      {invites.map((i) => (
        <div key={i.id} className={styles.toolbar}>
          <span>
            {i.label} · {t(`atelier3d.guests.${i.role}`)} ·{" "}
            {fmtDateTime(i.expiresAt)}
          </span>
          {i.revoked ? (
            <span>{t("atelier3d.guests.revoked")}</span>
          ) : (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await client.revoke(i.id);
                  setInvites(await client.invites());
                  setLink("");
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("atelier3d.guests.revoke")}
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
