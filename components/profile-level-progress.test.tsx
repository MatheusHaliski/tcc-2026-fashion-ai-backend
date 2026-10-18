// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,renderApp,screen} from '@/test-utils/render';
import {ProfileLevelChip,type LevelProgress} from './profile-level-progress';
afterEach(cleanup);
const base:LevelProgress={level:'STUDIO',lifetime:1500,currentThreshold:1000,percent:42.7,nextLevel:{level:'LOFT',threshold:3000,missing:1500},futureLevels:[]};
it('mostra o nível e a porcentagem no chip e abre o progresso no modal',()=>{
 renderApp(<ProfileLevelChip progress={base}/>);
 const chip=screen.getByRole('button',{name:/Nível Studio, 42% até o próximo/});expect(chip.textContent).toContain('42%');
 fireEvent.click(chip);expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
});
it('no nível máximo não anuncia porcentagem até o próximo',()=>{
 renderApp(<ProfileLevelChip progress={{...base,level:'MAISON',percent:100,nextLevel:null}}/>);
 const chip=screen.getByRole('button',{name:/nível máximo alcançado/});expect(chip.getAttribute('aria-label')).not.toMatch(/%/);expect(chip.textContent).not.toContain('%');
});
