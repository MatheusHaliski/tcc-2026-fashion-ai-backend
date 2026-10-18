export const ERA_THEMES = [
 {id:'RETRO_DISCO',colors:['#472349','#dd73b2','#eccc80'],symbol:'VINYL'},
 {id:'CYBER_NEON',colors:['#111333','#ff52cd','#64e8fa'],symbol:'SPARK'},
 {id:'ACOUSTIC',colors:['#392b22','#bb8864','#f2d5ac'],symbol:'GUITAR'},
 {id:'DARK_POP',colors:['#170f22','#9649a4','#c18dd7'],symbol:'MOON'},
 {id:'STADIUM',colors:['#101b31','#397dbc','#adceef'],symbol:'STAGE'},
 {id:'GOLDEN_RNB',colors:['#292015','#cfaa62','#f9df9c'],symbol:'CROWN'},
] as const;
export const ERA_SYMBOLS={MIC:'🎙️',STAGE:'🎭',SPOTLIGHT:'🔦',GUITAR:'🎸',VINYL:'💿',STAR:'⭐',HEART:'💖',CROWN:'👑',SPARK:'✨',BUTTERFLY:'🦋',MOON:'🌙',HORSE:'🐎',SPEAKER:'🔊'} as const;
export interface EraEditorial {theme:string;symbols:string[];headline:string;motion:boolean;timeline:{date:string;title:string;description:string}[];photos:{url:string;caption:string;alt:string}[]}
export const emptyEditorial=():EraEditorial=>({theme:'STADIUM',symbols:['MIC','STAR'],headline:'',motion:true,timeline:[],photos:[]});
export function readEditorial(raw?:Partial<EraEditorial>|null):EraEditorial{return {...emptyEditorial(),...raw,symbols:raw?.symbols??['MIC','STAR'],timeline:raw?.timeline??[],photos:raw?.photos??[]};}
