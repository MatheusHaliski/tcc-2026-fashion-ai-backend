"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { requestSealPolicyDraft } from "@/lib/seals/policy-draft";
import { Button, SegmentPicker } from "@/components/ui";
import { CopilotChatComposer, CopilotChatMessage } from "@/components/copilot-chat";
import { SealReferencePreview } from "@/components/seal-reference-model";
import { cleanPolicy, type SealPolicy, type SealTierId } from "@/components/seal-policy-editor";
import type { SealDesign } from "@/components/seal-medallion";

export interface SealPolicyDraft {
  status: "VALID" | "INCOMPLETE"; name: string; tier: SealTierId; policy?: SealPolicy; design: SealDesign;
  text?: string; reasons: string[]; questions: string[]; sources: string[]; fallbackUsed?: boolean;
}
interface Message { role: "user" | "copilot"; text: string; draft?: SealPolicyDraft }

/** A conversa gera rascunhos; apenas Aplicar atualiza o criador e nenhum pedido publica um selo. */
export function SealPolicyChat({ tier, onTier, previousPolicy, brandName, onApply }: {
  tier: SealTierId; onTier: (tier: SealTierId) => void; previousPolicy: SealPolicy;
  brandName?: string | null; onApply: (draft: SealPolicyDraft) => void;
}) {
  const { t } = useI18n(); const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SealPolicyDraft | null>(null);
  const latestPolicy = useRef<SealPolicy | null>(null);
  const lock = useRef(false); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);
  function reset() { setMessages([]); setInput(""); setDraft(null); latestPolicy.current = null; setError(null); }
  async function send(raw: string) {
    const text = raw.trim(); if (!text || lock.current) return;
    const message = `#createsealpolicy ${text}`;
    if (message.length > 6000) { setError(t("sealChat.conversation_limit")); return; }
    lock.current = true; setBusy(true); setInput(""); setError(null); setDraft(null);
    setMessages((current) => [...current, { role: "user", text }]);
    try {
      const conversation = messages.slice(-20).map((entry) => ({ role: entry.role === "user" ? "user" : "assistant", text: entry.text }));
      while (conversation.reduce((length, entry) => length + entry.text.length, 0) > 12_000) conversation.shift();
      const response = await requestSealPolicyDraft<SealPolicyDraft>({ tier, message, conversation, previousPolicy: cleanPolicy(latestPolicy.current ?? previousPolicy) });
      setDraft(response);
      if (response.status === "VALID" && response.policy?.referenceModel) latestPolicy.current = response.policy;
      const baseReply = response.text || (response.status === "VALID" ? t("sealChat.draft_ready") : response.questions?.join("\n")) || t("sealChat.more_details");
      const reply = [baseReply, ...(response.questions ?? []).filter((question) => !baseReply.includes(question))].join("\n");
      setMessages((current) => [...current, { role: "copilot", text: reply, draft: response }]);
    } catch (cause) {
      const failure = cause instanceof ApiError ? cause : new ApiError(0, "ERRO", String(cause));
      const text = failure.status === 404 ? t("sealChat.route_unavailable") : failure.message;
      setError(text);
    } finally { lock.current = false; setBusy(false); }
  }
  const examples = [t("sealChat.example.item", { brand: brandName || user?.displayName || t("common.brand") }), t("sealChat.example.look"), t("sealChat.example.profile")];
  return <section aria-label={t("sealCopilot.title")} className="grid gap-3">
    <SegmentPicker label={t("sealPolicy.nivel")} value={tier} onChange={(next) => { if (busy) return; onTier(next); reset(); }}
      options={[{ id: "PERFIL", label: t("sealCopilot.profile") }, { id: "PECA", label: t("sealPolicy.nivel_peca") }, { id: "LOOK", label: t("sealPolicy.nivel_look") }]} />
    {tier === "PERFIL" && <p className="help">{t("sealCopilot.profile_hint")}</p>}
    <div className="surface flex min-h-72 flex-col">
      <div role="log" aria-live="polite" aria-label={t("sealChat.conversation")} className="flex-1 space-y-3 overflow-auto p-4">
        <CopilotChatMessage role="copilot"><p className="type-body whitespace-pre-wrap">{t("sealChat.greeting", { name: user?.displayName || brandName || t("sealChat.issuer") })}</p><p className="mt-1 type-caption text-muted">#createsealpolicy</p></CopilotChatMessage>
        {messages.map((message, index) => <CopilotChatMessage key={index} role={message.role}>
          <p className="type-body whitespace-pre-wrap">{message.text}</p>
          {message.draft?.fallbackUsed && <p role="note" className="type-caption text-muted">{t("sealChat.local_fallback")}</p>}
          {message.draft?.policy?.referenceModel && <div className="mt-3"><SealReferencePreview model={message.draft.policy.referenceModel} /></div>}
          {message.draft?.status === "VALID" && message.draft === draft && message.draft.policy?.referenceModel && <Button className="mt-3" size="sm" variant="primary" disabled={busy} onClick={() => onApply(message.draft!)}>{t("sealChat.apply_draft")}</Button>}
        </CopilotChatMessage>)}
        {busy && <p role="status" className="type-body-sm text-muted">{t("sealChat.thinking")}</p>}
        <div ref={end} />
      </div>
      <div className="border-t border-line-soft p-3">
        {!messages.length && <div className="mb-3 flex flex-wrap gap-2">{examples.map((example) => <Button key={example} type="button" size="sm" disabled={busy} onClick={() => send(example)}>{example}</Button>)}</div>}
        <CopilotChatComposer value={input} onChange={setInput} onSend={send} busy={busy} placeholder={t("sealChat.placeholder")} label={t("sealCopilot.request")} maxLength={5900} />
      </div>
    </div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {messages.length > 0 && <Button type="button" size="sm" disabled={busy} onClick={reset}>{t("sealCopilot.restart")}</Button>}
  </section>;
}
