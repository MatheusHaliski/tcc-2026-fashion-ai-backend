// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, renderApp, screen } from '@/test-utils/render';
import { AuraGuide } from './aura-guide';
afterEach(cleanup);

it('illustrates each AURA family and points out the unchanged garment photo', async () => {
  const { container } = renderApp(<AuraGuide />);
  fireEvent.click(screen.getByRole('button', { name: 'Entenda as AURAs' }));
  expect(await screen.findByText('AURA Electro · fios de luz')).toBeTruthy();
  expect(screen.getByText('AURA Splash · tinta fluida')).toBeTruthy();
  expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(5);
  expect(screen.getAllByText('foto intacta')).toHaveLength(5);
});
