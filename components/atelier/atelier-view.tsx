"use client";
import Link from "next/link";
import { useState } from "react";
import { MOTION_TEMPLATES } from "@/lib/fashion-card/aura-impersonation-service";
import { EMPTY_ATELIER_REWARDS, REWARD_CATEGORIES, SAMPLE_PROJECT, projectProgress, rewardCount, toggleTrophy, type AtelierRewardModel } from "@/lib/atelier/model";

export function AtelierView({ rewards: initial = EMPTY_ATELIER_REWARDS }: { rewards?: AtelierRewardModel }) {
  const [rewards, setRewards] = useState(initial);
  const total = rewardCount(rewards);
  const level = 1 + Math.floor(total / 5);
  const season = Math.min(100, (total % 5) * 20);
  const pct = projectProgress(SAMPLE_PROJECT);
  const counts: Record<string, number> = {
    auraSignature: rewards.auraSignature.unlocked.length, garmentMemory: rewards.garmentMemory.length, habitableTrofeus: rewards.habitableTrofeus.length,
    directorPower: rewards.directorPower.permissions.length, collectiveWork: rewards.collectiveWork.length, seasonPasses: rewards.seasonPasses.length,
  };
  return (
    <div className="grid gap-6" data-testid="atelier-view">
      <header className="grid gap-2" aria-labelledby="atelier-progress">
        <h1 id="atelier-progress" className="type-h2">FAI Atelier</h1>
        <p className="type-body-sm text-muted">Jogar constrói identidade, histórias e um espaço próprio.</p>
        <div className="flex flex-wrap gap-4">
          <span>Nível {level}</span><span>Troféus: {rewards.habitableTrofeus.length}</span>
          <span>Temporada: {season}%</span>
        </div>
        <progress value={season} max={100} aria-label="Progresso da temporada" />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REWARD_CATEGORIES.map((c) => (
            <li key={c.key} className="card p-3"><strong>{c.title}</strong> · {counts[c.key]}<br /><span className="type-body-sm text-muted">{c.how}. {c.effect}</span></li>
          ))}
        </ul>
        <section aria-label={SAMPLE_PROJECT.name} className="card p-3">
          <strong>Projeto: {SAMPLE_PROJECT.name}</strong> · {pct}%
          <ul>{SAMPLE_PROJECT.goals.map((g) => <li key={g.label}>{g.done ? "✓" : "○"} {g.label}</li>)}</ul>
          <p className="type-body-sm text-muted">{SAMPLE_PROJECT.reward}</p>
        </section>
      </header>

      <section aria-labelledby="atelier-auras" className="grid gap-2">
        <h2 id="atelier-auras" className="type-h3">Auras e Metamorfoses</h2>
        <p className="type-body-sm text-muted">Transforme e edite as auras das suas peças e fotos.</p>
        <ul className="flex flex-wrap gap-3">
          {MOTION_TEMPLATES.map((m) => (
            <li key={m.id} className="w-40"><video src={m.demo} muted loop playsInline autoPlay aria-label={m.id} className="w-full rounded" /><span className="type-body-sm">{m.id}</span></li>
          ))}
        </ul>
        <div className="flex gap-2"><Link className="btn" href="/settings">Configurar Aura</Link><Link className="btn" href="/atelier/galeria">Minhas fotos</Link></div>
      </section>

      <section aria-labelledby="atelier-memories" className="grid gap-2">
        <h2 id="atelier-memories" className="type-h3">Galeria de memórias</h2>
        {rewards.garmentMemory.length === 0 && <p className="type-body-sm text-muted">Reutilize uma peça em desafios diferentes para abrir capítulos da sua história.</p>}
        {rewards.garmentMemory.map((g) => (
          <article key={g.pieceId}><h3>{g.pieceName}</h3>
            <ol>{[...g.chapters].sort((a, b) => a.date.localeCompare(b.date)).map((c) => <li key={c.id}>{c.date} · {c.title}</li>)}</ol>
          </article>
        ))}
      </section>

      <section aria-labelledby="atelier-room" className="grid gap-2">
        <h2 id="atelier-room" className="type-h3">Quarto 3D</h2>
        {rewards.habitableTrofeus.length === 0 && <p className="type-body-sm text-muted">Complete uma temporada para ganhar vitrine, luminária, espelho ou mesa.</p>}
        <ul>{rewards.habitableTrofeus.map((t) => (
          <li key={t.id}>{t.name}{" "}
            <button type="button" className="btn" aria-pressed={t.equipped} onClick={() => setRewards((r) => toggleTrophy(r, t.id))}>{t.equipped ? "Remover do quarto" : "Equipar no quarto"}</button>
          </li>))}
        </ul>
        <Link className="btn" href="/room">Abrir meu quarto</Link>
      </section>
    </div>
  );
}
