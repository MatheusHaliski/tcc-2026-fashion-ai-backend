// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { loggedAs, renderApp, ME } from '@/test-utils/render';
import { AtelierWorkspace } from './atelier-workspace';
vi.mock('next/dynamic', () => ({ default: () => function LegacyAtelier() { return <div data-testid="legacy-atelier"/>; } }));
afterEach(cleanup);

describe('Atelier › novo projeto sem a declaração marcada', () => {
  it('mostra o aviso do app (não o do navegador), leva o foco à declaração e não envia', async () => {
    const { calls } = loggedAs(ME, { 'GET /api/atelier/projects': { items: [], page: 0, size: 24, hasMore: false }, 'GET /api/atelier/projects/invitations/me': [] });
    renderApp(<AtelierWorkspace/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Novo projeto' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Novo projeto' }));
    fireEvent.change(dialog.getByLabelText(/^Nome do projeto/), { target: { value: 'Camisa do grupo' } });
    const box = dialog.getByRole('checkbox') as HTMLInputElement;
    expect(box.required).toBe(false);
    fireEvent.click(dialog.getByRole('button', { name: 'Criar projeto' }));
    expect(await dialog.findByRole('alert')).toHaveProperty('textContent', 'Para criar o projeto, marque a declaração de autorização acima.');
    expect(document.activeElement).toBe(box);
    expect(calls.some(c => c.method === 'POST' && c.path === '/api/atelier/projects')).toBe(false);
    fireEvent.click(box);
    await waitFor(() => expect(dialog.queryByRole('alert')).toBeNull());
  });
});
