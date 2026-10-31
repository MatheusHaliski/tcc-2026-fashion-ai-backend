/*
 * MET Gala Heist v2 — textos DIEGÉTICOS do vestíbulo e das portas, desenhados nas texturas da área nos três idiomas do
 * cenário: placas de bronze, letreiros, painel dos pavimentos, totem, livro de presença, placa do credenciamento, bandejas
 * das pulseiras, estêncil e fita crepe das portas do palco. Tudo é ficção (Museu Vesper, Gala Lumière). O varredor de
 * i18n ignora os `*-copy.ts`; o idioma vem dos textos que a montagem do interior recebeu (interior-copy.ts).
 */
import { COPY, type InteriorCopy, type SceneLocale } from "../interior-copy";

export interface VestCopy {
  hall: string; dock: string; staff: string; coat: string; checkin: string; welcome: string; gallery: string; floors: [string, string][];
  founded: string; museum: string; guestBook: string; wristbands: string; totemTitle: string; totemLines: string[]; youAreHere: string; quiet: string;
}
const VCOPY: Record<SceneLocale, VestCopy> = {
  "pt-BR": {
    hall: "GRANDE SALÃO", dock: "DOCA · SERVIÇO", staff: "SOMENTE FUNCIONÁRIOS", coat: "CHAPELARIA", checkin: "CREDENCIAMENTO", welcome: "BEM-VINDOS À GALA LUMIÈRE", gallery: "GALERIA",
    floors: [["2", "Galeria superior · Camarote"], ["1", "Grande Salão · Lounge e Bar"], ["1", "Instituto do Traje · Sala das Joias"], ["T", "Vestíbulo · Credenciamento · Chapelaria"]],
    founded: "MUSEU VESPER · FUNDADO EM MCMXII", museum: "MUSEU VESPER", guestBook: "Livro de presença", wristbands: "Pulseiras · acesso ao salão",
    totemTitle: "VOCÊ ESTÁ AQUI", totemLines: ["Grande Salão  ↑", "Chapelaria  →", "Credenciamento  ←", "Galeria  ↑ escadas"], youAreHere: "Vestíbulo", quiet: "Por favor, apresente o convite",
  },
  en: {
    hall: "GREAT HALL", dock: "DOCK · SERVICE", staff: "STAFF ONLY", coat: "COAT CHECK", checkin: "CHECK-IN", welcome: "WELCOME TO THE GALA LUMIÈRE", gallery: "GALLERY",
    floors: [["2", "Upper gallery · Balcony"], ["1", "Great Hall · Lounge and Bar"], ["1", "Costume Institute · Jewel Room"], ["G", "Vestibule · Check-in · Coat check"]],
    founded: "VESPER MUSEUM · FOUNDED MCMXII", museum: "VESPER MUSEUM", guestBook: "Guest book", wristbands: "Wristbands · hall access",
    totemTitle: "YOU ARE HERE", totemLines: ["Great Hall  ↑", "Coat check  →", "Check-in  ←", "Gallery  ↑ stairs"], youAreHere: "Vestibule", quiet: "Please present your invitation",
  },
  es: {
    hall: "GRAN SALÓN", dock: "MUELLE · SERVICIO", staff: "SOLO PERSONAL", coat: "GUARDARROPA", checkin: "ACREDITACIÓN", welcome: "BIENVENIDOS A LA GALA LUMIÈRE", gallery: "GALERÍA",
    floors: [["2", "Galería superior · Palco"], ["1", "Gran Salón · Lounge y Bar"], ["1", "Instituto del Traje · Sala de las Joyas"], ["PB", "Vestíbulo · Acreditación · Guardarropa"]],
    founded: "MUSEO VESPER · FUNDADO EN MCMXII", museum: "MUSEO VESPER", guestBook: "Libro de invitados", wristbands: "Pulseras · acceso al salón",
    totemTitle: "USTED ESTÁ AQUÍ", totemLines: ["Gran Salón  ↑", "Guardarropa  →", "Acreditación  ←", "Galería  ↑ escaleras"], youAreHere: "Vestíbulo", quiet: "Por favor, presente la invitación",
  },
};
/** Idioma do cenário a partir dos textos que a montagem recebeu. */
export function vLocale(copy: InteriorCopy): SceneLocale { return (Object.keys(COPY) as SceneLocale[]).find((k) => COPY[k] === copy) ?? "pt-BR"; }
export const vCopy = (copy: InteriorCopy): VestCopy => VCOPY[vLocale(copy)];

/** Portas do palco: o nome em estêncil (porta dos bastidores no lounge, porta do palco no salão) e a fita crepe do ensaio. */
export interface DoorCopy { backstage: string; stage: string; tape: string }
export const DOOR_COPY: Record<SceneLocale, DoorCopy> = {
  "pt-BR": { backstage: "BASTIDORES", stage: "PALCO", tape: "CENA 4 · ENTRADA L" },
  en: { backstage: "BACKSTAGE", stage: "STAGE", tape: "SCENE 4 · ENTRANCE L" },
  es: { backstage: "BASTIDORES", stage: "ESCENARIO", tape: "ESCENA 4 · ENTRADA I" },
};
