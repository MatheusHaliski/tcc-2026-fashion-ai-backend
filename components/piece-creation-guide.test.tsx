// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderApp, screen } from '@/test-utils/render';
import { PieceCreationGuide } from './piece-creation-guide';
afterEach(cleanup);

it('orienta numa etapa para cada aba do formulário (4), com os mesmos nomes, e termina sem bloquear o criador', () => {
  const close = vi.fn();
  renderApp(<PieceCreationGuide open onClose={close} />);
  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['1. Peça', '2. Mais detalhes', '3. Arte de fundo', '4. Revisar e salvar']);
  expect(screen.getByRole('img', { name: 'Uma foto clara ou um produto do catálogo dá a base da peça.' })).toBeTruthy();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
  expect(screen.getByText(/Salvar a peça não garante/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
  expect(close).toHaveBeenCalledOnce();
});
