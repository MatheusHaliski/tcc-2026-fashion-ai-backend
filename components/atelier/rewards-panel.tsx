'use client';
import {useI18n} from '@/lib/i18n/i18n';
import type {AtelierRewardSystem} from '@/lib/atelier/types';

const CATEGORIES = ['habitableTrofeus', 'directorPower', 'collectiveWork', 'seasonPasses'] as const;

/**
 * Atelier › Conquistas: as recompensas concedidas em quatro categorias (troféus habitáveis, poder de direção, obra
 * coletiva e convites de temporada). Era a primeira parte da aba "Conquistas & Quarto"; o quarto em 3D e a instalação
 * de objetos saíram com o Meu Quarto (15/11/2026). Só lê o que o Atelier já trouxe (GET /api/me/atelier).
 */
export function AtelierRewardsPanel({rewards}: {rewards?: AtelierRewardSystem}) {
  const {t} = useI18n();
  return (
    <div>
      <div className="atelier-section-heading">
        <div>
          <h2>{t('atelier.rewardsPanel.title')}</h2>
          <p>{t('atelier.rewardsPanel.hint')}</p>
        </div>
      </div>
      <div className="atelier-earned-grid">
        {CATEGORIES.map(category => (
          <section className="atelier-earned" key={category}>
            <h3>{t(`atelier.category.${category}`)}</h3>
            {!rewards
              ? <p>{t('atelier.rewardsUnavailable')}</p>
              : rewards.categories[category]?.length
                ? rewards.categories[category].map(reward => <article key={reward.id}><h4>{reward.title}</h4><p>{reward.description}</p></article>)
                : <p>{t('atelier.rewardsPanel.none')}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
