// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { FittingRemoteControls } from './fitting-remote-controls';
afterEach(cleanup);
it('offers only camera rotation and zoom, with no mirror or movement controls',()=>{
 const api={step:vi.fn(),subscribe:vi.fn(()=>()=>{})};
 render(<I18nProvider initial="pt-BR"><FittingRemoteControls api={api}/></I18nProvider>);
 const buttons=screen.getAllByRole('button');expect(buttons).toHaveLength(4);
 for(const [label,action] of [['Girar para a esquerda','left'],['Girar para a direita','right'],['Aproximar','in'],['Afastar','out']]) {
  fireEvent.click(screen.getByRole('button',{name:label}));expect(api.step).toHaveBeenLastCalledWith(action);
 }
 expect(screen.queryByText(/espelho|centro|andar/i)).toBeNull();
});

it('reauditoria: os botões e a etiqueta do ambiente ficam no alto do palco, sem cobrir os pés do manequim', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('app/(site)/_styles/15-provador-espelho.css', 'utf8');
  const rules = [...css.matchAll(/\.fitting-(remote|stage-tag) \{([^}]*)\}/g)];
  expect(rules.length).toBeGreaterThanOrEqual(4);
  for (const rule of rules) {
    expect(rule[2]).toMatch(/top: \d+px/);
    expect(rule[2]).not.toMatch(/bottom:/);
  }
  const scene = readFileSync('components/three/fitting-room-scene.tsx', 'utf8');
  expect(scene).toMatch(/className="fitting-stage-tag /);
  expect(scene).not.toMatch(/absolute bottom-3 left-3/);
});
