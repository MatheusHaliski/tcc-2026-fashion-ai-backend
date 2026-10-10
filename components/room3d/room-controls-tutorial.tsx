"use client";
import { useEffect, useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
const COMMANDS = ["walk", "right", "left", "open", "pick", "carry", "try", "drop"] as const;
/** Animated diagrams rather than videos: small, offline, with reduced-motion support. */
function CommandAnimation({ command, paused }: { command: typeof COMMANDS[number]; paused: boolean }) {
  const move = command === "walk" || command === "carry", arm = ["right", "left", "pick", "open"].includes(command);
  return <svg viewBox="0 0 420 220" role="img" className="w-full rounded-xl bg-stone-100" aria-hidden="true">
    <style>{`@keyframes roomDemoWalk{50%{transform:translateX(100px)}} @keyframes roomDemoArm{50%{transform:rotate(-50deg)}} @keyframes roomDemoDoor{50%{transform:scaleX(.25)}} @keyframes roomDemoDrop{70%,100%{transform:translateY(100px) rotate(60deg)}} @media(prefers-reduced-motion:reduce){.room-demo{animation:none!important}}`}</style>
    <path d="M20 195H400" stroke="#78716c" strokeWidth="3" />
    <rect x="265" y="25" width="125" height="170" rx="5" fill="#d6c7b1" stroke="#57534e" strokeWidth="3" />
    <g style={{ transformOrigin: "265px 100px", animation: command === "open" && !paused ? "roomDemoDoor 3s ease-in-out infinite" : undefined }} className="room-demo">
      <rect x="266" y="26" width="123" height="168" fill="#e7ddce" stroke="#78716c" /><path d="M280 90V120" stroke="#44403c" strokeWidth="5" />
    </g>
    <rect x="215" y="45" width="35" height="130" rx="10" fill="#b8d9dc" stroke="#0f766e" strokeWidth="4" />
    <g transform={command === "left" ? "translate(240 0) scale(-1 1)" : undefined}><g className="room-demo" style={{ animation: move && !paused ? "roomDemoWalk 3s ease-in-out infinite" : undefined }}>
      <circle cx="120" cy="63" r="18" fill="#c98c67" /><path d="M120 85V138" stroke="#2563eb" strokeWidth="28" strokeLinecap="round" />
      <path d="M112 137L98 190M128 137L144 190" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
      <path d="M110 95L88 125" stroke="#c98c67" strokeWidth="10" strokeLinecap="round" />
      <g className="room-demo" style={{ transformOrigin: "130px 95px", animation: arm && !paused ? "roomDemoArm 3s ease-in-out infinite" : undefined }}>
        <path d="M130 95L164 125" stroke="#c98c67" strokeWidth="10" strokeLinecap="round" /><circle cx="165" cy="126" r="7" fill="#c98c67" />
      </g>
      {["carry", "drop", "pick", "try"].includes(command) && <g className="room-demo" style={{ transformOrigin: "165px 125px", animation: command === "drop" && !paused ? "roomDemoDrop 3s ease-out infinite" : undefined }}>
        <path d="M155 133L165 128L175 133" fill="none" stroke="#57534e" strokeWidth="3" /><path d="M153 136L141 146L150 156L155 151V174H177V151L182 156L191 146L179 136Z" fill="#0d9488" stroke="#115e59" strokeWidth="2" />
      </g>}
    </g></g>
    {command === "walk" && <path d="M38 25H91M80 15L91 25L80 35" fill="none" stroke="#0f766e" strokeWidth="5" />}
    {command === "try" && <path d="M211 105L220 114L238 91" fill="none" stroke="#15803d" strokeWidth="6" />}
  </svg>;
}
export default function RoomControlsTutorial({ enabled }: { enabled: boolean }) {
  const { t } = useI18n(), { user } = useAuth();
  const key = `fai:room-controls:v1:${user?.id ?? "local"}`;
  const [open, setOpen] = useState(false), [step, setStep] = useState(0), [hide, setHide] = useState(false), [paused, setPaused] = useState(false);
  useEffect(() => { if (!enabled) return; try { const hidden = localStorage.getItem(key) === "hidden"; setHide(hidden); setOpen(!hidden); } catch { setOpen(true); } }, [enabled, key]);
  const finish = () => { try { if (hide) localStorage.setItem(key, "hidden"); else localStorage.removeItem(key); } catch { /* tutorial still works without storage */ } setOpen(false); };
  const command = COMMANDS[step];
  return <>
    <Button onClick={() => { setStep(0); setOpen(true); }}>{t("room.play.help")}</Button>
    <Dialog open={open} onClose={finish} title={t("room.play.tutorial")} size="lg" footer={<>
      <Button disabled={step === 0} onClick={() => setStep(v => v - 1)}>{t("common.back")}</Button>
      <Button onClick={() => step === COMMANDS.length - 1 ? finish() : setStep(v => v + 1)}>{t(step === COMMANDS.length - 1 ? "room.play.understood" : "common.next")}</Button>
    </>}>
      <div className="space-y-4">
        <p className="text-lg font-semibold">{step + 1} / {COMMANDS.length} · {t(`room.play.demo.${command}.title`)}</p>
        <CommandAnimation command={command} paused={paused} />
        <p className="text-lg">{t(`room.play.demo.${command}.body`)}</p>
        <Button onClick={() => setPaused(v => !v)}>{t(paused ? "room.play.animation_start" : "room.play.animation_pause")}</Button>
        <label className="flex items-center gap-3 text-base"><input type="checkbox" checked={hide} onChange={event => setHide(event.target.checked)} />{t("room.play.hide_tutorial")}</label>
      </div>
    </Dialog>
  </>;
}
