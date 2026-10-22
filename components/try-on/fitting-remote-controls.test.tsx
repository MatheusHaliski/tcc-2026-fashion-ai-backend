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
