/**
 * Itens do menu lateral por domínio. A ordem aqui é a padrão; cada pessoa pode reordenar grupos e itens em Configurações
 * (RF23 — customização salva no perfil, ver lib/nav/nav-order.ts).
 */
export type NavGroup = { key: string; items: NavItem[] };
export type NavItem = { href: string; key: string; icon: string; auth?: boolean };
export const NAV_GROUPS: NavGroup[] = [
  // domínios: descobrir · guarda-roupa · looks · perfil · jogar · loja
  { key: "nav.group.discover", items: [
    { href: "/feed", key: "nav.feed", icon: "NAV-05" },
    { href: "/search", key: "nav.search", icon: "NAV-09" },
    { href: "/explorer", key: "nav.explorer", icon: "NAV-08" },
    { href: "/brands", key: "nav.brands", icon: "NAV-11" },
    { href: "/lens", key: "nav.lens", icon: "ACT-08", auth: true },
  ] },
  { key: "nav.group.wardrobe", items: [
    { href: "/closet", key: "nav.closet", icon: "NAV-02", auth: true },
    { href: "/pieces/new", key: "nav.addPiece", icon: "ACT-06", auth: true },
    { href: "/room", key: "nav.room", icon: "NAV-16", auth: true },
    { href: "/atelier", key: "nav.atelier", icon: "NAV-10", auth: true },
    { href: "/try-on", key: "nav.tryon", icon: "NAV-07", auth: true },
    { href: "/avatar", key: "nav.avatar3d", icon: "ACT-20", auth: true },
  ] },
  { key: "nav.group.create", items: [
    { href: "/looks", key: "nav.myLooks", icon: "NAV-04", auth: true },
    { href: "/schemes/new", key: "nav.create", icon: "NAV-03", auth: true },
    { href: "/copilot", key: "nav.copilot", icon: "ACT-13", auth: true },
    { href: "/autopilot", key: "nav.autopilot", icon: "NAV-06", auth: true },
    { href: "/dna", key: "nav.dna", icon: "ACT-19", auth: true },
  ] },
  { key: "nav.group.profile", items: [
    { href: "/lookbook", key: "nav.profile", icon: "NAV-15", auth: true },
    { href: "/history", key: "nav.history", icon: "SOC-07", auth: true },
  ] },
  { key: "nav.group.play", items: [
    { href: "/moments", key: "nav.moments", icon: "NAV-13", auth: true },
    { href: "/flair", key: "nav.flair", icon: "ACT-46", auth: true },
    { href: "/highlights", key: "nav.highlights", icon: "ACT-37", auth: true },
    { href: "/coupons", key: "nav.coupons", icon: "ACT-26", auth: true },
  ] },
  { key: "nav.group.store", items: [
    { href: "/points", key: "nav.points", icon: "ACT-40", auth: true },
  ] },
];

