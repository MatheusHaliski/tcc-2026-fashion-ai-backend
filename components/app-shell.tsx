"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme/theme";
import { api } from "@/lib/api/client";
import { FaiIcon } from "@/components/fai-icon";
import { Avatar, Sheet, Skeleton, UiIcon, cn, useDismiss, useFocusTrap } from "@/components/ui";

/**
 * Estrutura de todas as telas logadas: cabeçalho de altura fixa, menu lateral por domínios (desktop), gaveta (tablet e
 * celular) e barra inferior com os 5 destinos principais. O menu fica sempre num container branco (regra do RF23).
 */
type NavItem = { href: string; key: string; icon: string; auth?: boolean };
const GROUPS: { key: string; items: NavItem[] }[] = [
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
    { href: "/photos", key: "nav.photos", icon: "NAV-10", auth: true },
    { href: "/try-on", key: "nav.tryon", icon: "NAV-07", auth: true },
    { href: "/mirror", key: "nav.mirror", icon: "ACT-32", auth: true },
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

const THEMES: { mode: ThemeMode; key: string }[] = [
  { mode: "AUTO", key: "settings.systemTheme" }, { mode: "LIGHT", key: "settings.light" },
  { mode: "DARK", key: "settings.dark" }, { mode: "HIGH_CONTRAST", key: "settings.contrast" },
];

function useIsActive() {
  const pathname = usePathname(); const { user } = useAuth();
  return (href: string) => {
    if (href === "/lookbook") return pathname === "/lookbook" || (!!user && pathname === `/u/${user.username}`);
    if (href === "/schemes/new" || href === "/feed") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };
}

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n(); const { user, isAdmin } = useAuth(); const isActive = useIsActive(); const pathname = usePathname();
  const manage: NavItem[] = [
    // painel do emissor (marca/celebridade) fica no próprio perfil; o menu lateral só mostra o Dashboard da administração
    ...(isAdmin ? [{ href: "/admin/dashboard", key: "nav.admin", icon: "NAV-14" }] : []),
  ];
  const groups = [...GROUPS, ...(manage.length ? [{ key: "nav.group.manage", items: manage }] : [])];
  return (
    <div className="nav-groups">
      {groups.map((g) => {
        const items = g.items.filter((n) => !n.auth || user);
        if (!items.length) return null;
        return (
          <section key={g.key} aria-labelledby={`nav-${g.key}`}>
            <h2 id={`nav-${g.key}`} className="nav-group-title">{t(g.key)}</h2>
            <ul>
              {items.map((n) => {
                const on = n.href.startsWith("/admin") ? pathname.startsWith("/admin") : isActive(n.href);
                return (
                  <li key={n.href}>
                    <Link href={n.href} aria-current={on ? "page" : undefined} className="nav-link" onClick={onNavigate}>
                      <FaiIcon id={n.icon} size={24} variant="glyph" decorative /><span>{t(n.key)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Menu da conta: perfil, configurações, tema, idioma, administração e sair. Tema e idioma saíram do cabeçalho. */
function AccountMenu() {
  const { t, locale, setLocale, locales } = useI18n(); const { user, isAdmin, signOut } = useAuth(); const { prefs, update } = useTheme();
  const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null); const menuId = useId();
  useDismiss(box, open, () => setOpen(false));
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus(); }, [open]);
  if (!user) return null;
  const setTheme = (mode: ThemeMode) => {
    update({ theme: mode, highContrast: false });
    api.put("/api/me/preferences", { theme: mode, highContrast: false, clientUpdatedAt: new Date().toISOString() }).catch(() => undefined);
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const list = Array.from(box.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    if (e.key === "Tab") setOpen(false);
  };
  const close = () => setOpen(false);
  return (
    <div ref={box} className="relative">
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={t("nav.accountMenu")} onClick={() => setOpen((o) => !o)}>
        <Avatar src={user.avatarUrl} name={user.displayName} size={32} />
        <span className="hidden max-w-[140px] truncate type-body-sm font-medium lg:inline">@{user.username}</span>
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={t("nav.accountMenu")} className="menu-pop right-0 w-72" onKeyDown={onKey}>
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar src={user.avatarUrl} name={user.displayName} size={40} />
            <div className="min-w-0"><p className="truncate font-semibold">{user.displayName}</p><p className="truncate type-caption text-muted">@{user.username}</p></div>
          </div>
          <div className="menu-sep" />
          <Link role="menuitem" tabIndex={-1} href="/lookbook" className="menu-item" onClick={close}><UiIcon name="user" />{t("nav.profile")}</Link>
          <Link role="menuitem" tabIndex={-1} href="/settings" className="menu-item" onClick={close}><UiIcon name="settings" />{t("nav.settings")}</Link>
          {isAdmin && <Link role="menuitem" tabIndex={-1} href="/admin/dashboard" className="menu-item" onClick={close}><UiIcon name="shield" />{t("nav.admin")}</Link>}
          <div className="menu-sep" />
          <p className="menu-label" id={`${menuId}-theme`}>{t("settings.theme")}</p>
          <div role="group" aria-labelledby={`${menuId}-theme`}>
            {THEMES.map((th) => {
              const on = prefs.theme === th.mode && (th.mode === "HIGH_CONTRAST" || !prefs.highContrast);
              return <button key={th.mode} type="button" role="menuitemradio" aria-checked={on} tabIndex={-1} className="menu-item" onClick={() => setTheme(th.mode)}>
                <span className="w-5">{on && <UiIcon name="check" size={18} />}</span>{t(th.key)}</button>;
            })}
          </div>
          <p className="menu-label" id={`${menuId}-lang`}>{t("settings.language")}</p>
          <div role="group" aria-labelledby={`${menuId}-lang`}>
            {locales.filter((l) => !l.qa).map((l) => (
              <button key={l.code} type="button" role="menuitemradio" aria-checked={locale === l.code} tabIndex={-1} lang={l.code} className="menu-item" onClick={() => setLocale(l.code)}>
                <span className="w-5">{locale === l.code && <UiIcon name="check" size={18} />}</span>{l.label}</button>
            ))}
          </div>
          <div className="menu-sep" />
          <button role="menuitem" tabIndex={-1} type="button" className="menu-item" onClick={() => { close(); signOut(); }}><UiIcon name="logout" />{t("nav.logout")}</button>
        </div>
      )}
    </div>
  );
}

/** Idioma para quem ainda não entrou: botão com globo e nomes completos dos idiomas. */
function LanguageMenu() {
  const { t, locale, setLocale, locales } = useI18n();
  const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null); const menuId = useId();
  useDismiss(box, open, () => setOpen(false));
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus(); }, [open]);
  const current = locales.find((l) => l.code === locale);
  return (
    <div ref={box} className="relative">
      <button type="button" className="btn btn-ghost btn-icon" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={`${t("settings.language")}: ${current?.label ?? locale}`} title={t("settings.language")} onClick={() => setOpen((o) => !o)}>
        <UiIcon name="globe" />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={t("settings.language")} className="menu-pop right-0 w-56">
          {locales.filter((l) => !l.qa).map((l) => (
            <button key={l.code} type="button" role="menuitemradio" aria-checked={locale === l.code} tabIndex={-1} lang={l.code} className="menu-item"
              onClick={() => { setLocale(l.code); setOpen(false); }}>
              <span className="w-5">{locale === l.code && <UiIcon name="check" size={18} />}</span>{l.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const CREATE = [
  { href: "/pieces/new", key: "nav.createPiece", hint: "nav.createPieceHint", icon: "ACT-06" },
  { href: "/schemes/new", key: "nav.createLook", hint: "nav.createLookHint", icon: "NAV-03" },
  { href: "/dna-schemes/new", key: "nav.createDna", hint: "nav.createDnaHint", icon: "ACT-19" },
  { href: "/photos", key: "nav.uploadPhotos", hint: "nav.uploadPhotosHint", icon: "ACT-07" },
];

const SIDEBAR_KEY = "fai.sidebar";
const DESKTOP = "(min-width: 1024px)";

/** true a partir de 1024 px (menu lateral fixo); abaixo disso o hambúrguer abre a gaveta. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

/** Menu lateral recolhido (desktop): lembrado neste navegador; no <html> o CSS libera o espaço e tira o véu do fundo. */
function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed"); } catch { /* armazenamento indisponível */ }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (collapsed) root.dataset.sidebar = "collapsed"; else delete root.dataset.sidebar;
    return () => { delete root.dataset.sidebar; };
  }, [collapsed]);
  const set = (v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem(SIDEBAR_KEY, v ? "collapsed" : "open"); } catch { /* armazenamento indisponível */ }
  };
  return [collapsed, set];
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n(); const { user, ready } = useAuth(); const { prefs, update } = useTheme();
  const pathname = usePathname(); const router = useRouter(); const isActive = useIsActive();
  const [unread, setUnread] = useState(0); const [drawer, setDrawer] = useState(false); const [create, setCreate] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useSidebarCollapsed(); const desktop = useIsDesktop();
  useFocusTrap(drawerRef, drawer, () => setDrawer(false));
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => api.get<{ unread: number }>("/api/notifications/unread-count").then((r) => alive && setUnread(r.unread)).catch(() => undefined);
    load(); const h = setInterval(load, 60000);
    return () => { alive = false; clearInterval(h); };
  }, [user, pathname]);
  useEffect(() => { setDrawer(false); setCreate(false); }, [pathname]);
  // RF23.CA02 — ao entrar, aplica as preferências salvas no servidor (tema, fundo do chrome, cor dos containers…)
  useEffect(() => {
    if (!user) return;
    api.get<{ theme?: string; density?: string; fontScale?: number; highContrast?: boolean; reduceMotion?: boolean; chromeBackgroundId?: string | null; contentContainerColor?: string | null }>("/api/me/preferences")
      .then((p) => update({ ...(p.theme ? { theme: p.theme as typeof prefs.theme } : {}), ...(p.density ? { density: p.density as typeof prefs.density } : {}), fontScale: p.fontScale ?? prefs.fontScale, highContrast: !!p.highContrast, reduceMotion: !!p.reduceMotion, chromeBackgroundId: p.chromeBackgroundId ?? null, contentContainerColor: p.contentContainerColor ?? null }))
      .catch(() => undefined);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bottom = user
    ? [{ href: "/feed", key: "nav.feed", icon: "NAV-05" }, { href: "/search", key: "nav.search", icon: "NAV-09" }, null, { href: "/closet", key: "nav.closetShort", icon: "NAV-02" }, { href: "/lookbook", key: "nav.profileShort", icon: "NAV-15" }]
    : [{ href: "/feed", key: "nav.feed", icon: "NAV-05" }, { href: "/search", key: "nav.search", icon: "NAV-09" }, { href: "/explorer", key: "nav.explorer", icon: "NAV-08" }, { href: "/brands", key: "nav.brands", icon: "NAV-11" }];

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="skip-link">{t("a11y.skip")}</a>
      <header className="app-header">
        <div className="app-header-inner">
          <button type="button" className="btn btn-ghost btn-icon menu-toggle" aria-label={t("a11y.menu")}
            aria-expanded={desktop ? !collapsed : drawer} aria-controls={desktop ? "app-sidebar" : "app-drawer"}
            onClick={() => (desktop ? setCollapsed(!collapsed) : setDrawer(true))}>
            <UiIcon name="menu" size={22} />
          </button>
          <Link href="/feed" className="brand-link" aria-label={t("nav.brandHome")}>
            <img src="/brand/fai-logo.png" alt="" width={32} height={32} />
            <span className="brand-name">Fashion AI</span>
          </Link>
          <form role="search" className="header-search" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value; router.push(`/search?q=${encodeURIComponent(q)}`); }}>
            <UiIcon name="search" size={18} className="header-search-icon" />
            <input name="q" type="search" className="input" placeholder={t("common.search") + "…"} aria-label={t("nav.search")} />
          </form>
          <div className="header-actions">
            {!ready ? (
              <><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-10 w-10 rounded-full" /></>
            ) : user ? (
              <>
                <Link href="/notifications" className="btn btn-ghost btn-icon relative" aria-label={unread ? `${t("nav.notifications")} (${unread})` : t("nav.notifications")}>
                  <FaiIcon id="ACT-03" size={24} variant="glyph" decorative />
                  {unread > 0 && <span className="notif-badge tabular" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
                </Link>
                <AccountMenu />
              </>
            ) : (
              <>
                <LanguageMenu />
                <Link href="/login" className="btn btn-sm">{t("nav.login")}</Link>
                <Link href="/register" className="btn btn-sm btn-primary hidden sm:inline-flex">{t("nav.register")}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav id="app-sidebar" aria-label={t("a11y.menu")} className="app-sidebar" inert={collapsed || undefined}><div className="side-nav-box"><NavGroups /></div></nav>
        <main id="conteudo" tabIndex={-1} className="app-main"><div className="page-container">{children}</div></main>
      </div>

      {drawer && (
        <div className="drawer-backdrop lg:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div ref={drawerRef} id="app-drawer" role="dialog" aria-modal="true" aria-label={t("a11y.menu")} className="drawer side-nav-box" tabIndex={-1}>
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="brand-link"><img src="/brand/fai-logo.png" alt="" width={28} height={28} /><span className="type-h3">Fashion AI</span></span>
              <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} onClick={() => setDrawer(false)}><UiIcon name="close" /></button>
            </div>
            <nav aria-label={t("a11y.menu")}><NavGroups onNavigate={() => setDrawer(false)} /></nav>
          </div>
        </div>
      )}

      <nav aria-label={t("a11y.menu")} className="bottom-nav side-nav-box lg:hidden" style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}>
        {bottom.map((n) => n === null ? (
          <button key="create" type="button" className="bottom-nav-create" aria-haspopup="dialog" aria-expanded={create} onClick={() => setCreate(true)}>
            <span className="bottom-nav-plus"><UiIcon name="plus" size={24} /></span><span>{t("nav.createShort")}</span>
          </button>
        ) : (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className="bottom-nav-link">
            <FaiIcon id={n.icon} size={24} variant="glyph" decorative /><span>{t(n.key)}</span>
          </Link>
        ))}
      </nav>

      <Sheet open={create} onClose={() => setCreate(false)} title={t("nav.createTitle")} side="bottom">
        <ul className="grid gap-1">
          {CREATE.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="create-option" onClick={() => setCreate(false)}>
                <FaiIcon id={c.icon} size={32} variant="glyph" decorative />
                <span className="min-w-0"><b className="block">{t(c.key)}</b><span className="type-body-sm text-muted">{t(c.hint)}</span></span>
                <UiIcon name="chevronRight" className="ml-auto text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

/** Página que exige login: redireciona visitantes e mostra o esqueleto da página enquanto a sessão carrega. */
export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready, isAdmin, me } = useAuth(); const router = useRouter(); const pathname = usePathname(); const { t } = useI18n();
  useEffect(() => { if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [ready, user, router, pathname]);
  if (!ready || !user) return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="mb-2 h-8 w-56" /><Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <div className="grid-cards">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
    </div>
  );
  if (admin && !me) return <div aria-busy="true"><span className="sr-only">{t("common.loading")}</span><Skeleton className="mb-2 h-8 w-56" /></div>;   // área de admin: nada aparece antes de /api/me confirmar o papel
  if (admin && !isAdmin) return (
    <div role="alert" className="surface mx-auto mt-6 max-w-lg p-6 text-center">
      <p className="type-label text-mark">{t("common.n403_acesso_negado")}</p>
      <h1 className="type-h2 mt-1">{t("appShell.area_restrita_a_administradores")}</h1>
      <p className="type-body mt-2 text-muted">{t("appShell.seu_perfil_nao_tem_o")}</p>
      <Link href="/feed" className="btn mt-4">{t("common.voltar_ao_feed")}</Link>
    </div>);
  return <>{children}</>;
}
