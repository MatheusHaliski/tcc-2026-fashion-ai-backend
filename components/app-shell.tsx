"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { useTheme } from "@/lib/theme/theme";
import { api } from "@/lib/api/client";
import { FaiIcon } from "@/components/fai-icon";
import { Avatar, cn } from "@/components/ui";

/** Itens de navegação: rota, chave i18n e ícone FAI (catálogo docs/icones). */
const NAV = [
  { href: "/feed", key: "nav.feed", icon: "NAV-05", auth: false },
  { href: "/search", key: "nav.search", icon: "NAV-09", auth: false },
  { href: "/closet", key: "nav.closet", icon: "NAV-02", auth: true },
  { href: "/schemes/new", key: "nav.create", icon: "NAV-03", auth: true },
  { href: "/lookbook", key: "nav.lookbook", icon: "NAV-15", auth: true },
  { href: "/autopilot", key: "nav.autopilot", icon: "NAV-06", auth: true },
  { href: "/copilot", key: "nav.copilot", icon: "ACT-13", auth: true },
  { href: "/dna", key: "nav.dna", icon: "ACT-19", auth: true },
  { href: "/room", key: "nav.room", icon: "NAV-16", auth: true },
  { href: "/mirror", key: "nav.mirror", icon: "ACT-32", auth: true },
  { href: "/highlights", key: "nav.highlights", icon: "ACT-37", auth: true },
  { href: "/challenges", key: "nav.challenges", icon: "ACT-43", auth: true },
  { href: "/points", key: "nav.points", icon: "ACT-40", auth: true },
  { href: "/try-on", key: "nav.tryon", icon: "NAV-07", auth: true },
  { href: "/photos", key: "nav.photos", icon: "NAV-10", auth: true },
  { href: "/brands", key: "nav.brands", icon: "NAV-11", auth: false },
  { href: "/explorer", key: "nav.explorer", icon: "NAV-08", auth: false },
] as const;
const PRIMARY = ["/feed", "/closet", "/schemes/new", "/lookbook", "/copilot"];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n(); const { user, isAdmin, signOut, ready } = useAuth(); const { prefs, update, resolved } = useTheme();
  const pathname = usePathname(); const router = useRouter();
  const [unread, setUnread] = useState(0); const [menu, setMenu] = useState(false); const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => api.get<{ unread: number }>("/api/notifications/unread-count").then((r) => alive && setUnread(r.unread)).catch(() => undefined);
    load(); const h = setInterval(load, 60000);
    return () => { alive = false; clearInterval(h); };
  }, [user, pathname]);
  useEffect(() => { setDrawer(false); setMenu(false); }, [pathname]);
  const items = NAV.filter((n) => !n.auth || user);
  const isActive = (href: string) => pathname === href || (href !== "/feed" && pathname.startsWith(href));
  const cycleTheme = () => update({ theme: prefs.theme === "LIGHT" ? "DARK" : prefs.theme === "DARK" ? "HIGH_CONTRAST" : "LIGHT", highContrast: false });

  const NavList = ({ compact }: { compact?: boolean }) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((n) => (
        <li key={n.href}>
          <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 type-body hover:bg-surface-2", isActive(n.href) && "bg-surface-2 font-semibold")}>
            <FaiIcon id={n.icon} size={24} active={isActive(n.href)} decorative />
            {!compact && <span>{t(n.key)}</span>}
          </Link>
        </li>
      ))}
      {isAdmin && (
        <li><Link href="/admin/dashboard" aria-current={pathname.startsWith("/admin") ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 type-body hover:bg-surface-2", pathname.startsWith("/admin") && "bg-surface-2 font-semibold")}>
          <FaiIcon id="NAV-01" size={24} active={pathname.startsWith("/admin")} decorative />{!compact && <span>{t("nav.dashboard")}</span>}</Link></li>
      )}
    </ul>
  );

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="skip-link">{t("a11y.skip")}</a>
      <header className="sticky top-0 z-40 border-b border-line-soft bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2 sm:px-5">
          <button type="button" className="btn btn-ghost btn-icon lg:hidden" aria-label={t("a11y.menu")} aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>☰</button>
          <Link href="/feed" className="flex items-center gap-2" aria-label="Fashion AI">
            <img src="/brand/fai-logo.png" alt="" width={30} height={30} />
            <span className="type-h3 hidden sm:inline">Fashion AI</span>
          </Link>
          <form role="search" className="ml-2 hidden flex-1 md:block" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value; router.push(`/search?q=${encodeURIComponent(q)}`); }}>
            <input name="q" className="input max-w-md" placeholder={t("common.search") + "…"} aria-label={t("nav.search")} />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-icon" onClick={cycleTheme} aria-label={`${t("settings.theme")}: ${resolved}`} title={t("settings.theme")}>
              <FaiIcon id="ACT-28" size={24} active={resolved !== "light"} decorative />
            </button>
            <label className="sr-only" htmlFor="locale">{t("settings.language")}</label>
            <select id="locale" className="input w-auto py-1 text-sm" value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
            </select>
            {user ? (
              <>
                <Link href="/notifications" className="btn btn-ghost btn-icon relative" aria-label={`${t("nav.notifications")}${unread ? ` (${unread})` : ""}`}>
                  <FaiIcon id="ACT-03" size={24} active={unread > 0} decorative />
                  {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-mark px-1.5 text-[10px] font-bold text-white tabular">{unread > 99 ? "99+" : unread}</span>}
                </Link>
                <div className="relative">
                  <button type="button" className="btn btn-ghost flex items-center gap-2 px-2" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                    <Avatar src={user.avatarUrl} name={user.displayName} size={28} /><span className="hidden sm:inline type-body-sm">@{user.username}</span>
                  </button>
                  {menu && (
                    <div role="menu" className="surface absolute right-0 mt-1 w-56 p-1">
                      <Link role="menuitem" href="/lookbook" className="block rounded px-3 py-2 hover:bg-surface-2">{t("nav.lookbook")}</Link>
                      <Link role="menuitem" href="/settings" className="block rounded px-3 py-2 hover:bg-surface-2">{t("nav.settings")}</Link>
                      {isAdmin && <Link role="menuitem" href="/admin/dashboard" className="block rounded px-3 py-2 hover:bg-surface-2">{t("nav.admin")}</Link>}
                      <button role="menuitem" type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-surface-2" onClick={signOut}>{t("nav.logout")}</button>
                    </div>
                  )}
                </div>
              </>
            ) : ready ? (
              <>
                <Link href="/login" className="btn btn-sm">{t("nav.login")}</Link>
                <Link href="/register" className="btn btn-sm btn-primary hidden sm:inline-flex">{t("nav.register")}</Link>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1400px] gap-6 px-3 py-4 sm:px-5">
        <nav aria-label={t("a11y.menu")} className="hidden w-56 shrink-0 lg:block"><div className="sticky top-16"><NavList /></div></nav>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <nav aria-label={t("a11y.menu")} className="absolute left-0 top-0 h-full w-72 overflow-auto bg-surface p-3 shadow-xl" onClick={(e) => e.stopPropagation()}><NavList /></nav>
          </div>
        )}
        <main id="conteudo" className="min-w-0 flex-1 pb-20 lg:pb-6">{children}</main>
      </div>
      <nav aria-label={t("a11y.menu")} className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-line-soft bg-surface/95 py-1 backdrop-blur lg:hidden">
        {NAV.filter((n) => PRIMARY.includes(n.href) && (!n.auth || user)).map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]">
            <FaiIcon id={n.icon} size={24} active={isActive(n.href)} decorative /><span className={cn(isActive(n.href) && "font-semibold")}>{t(n.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Página que exige login: redireciona visitantes e mostra placeholder enquanto a sessão carrega. */
export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready, isAdmin, me } = useAuth(); const router = useRouter(); const pathname = usePathname(); const { t } = useI18n();
  useEffect(() => { if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [ready, user, router, pathname]);
  if (!ready || !user) return <p className="type-body text-muted p-6">{t("common.loading")}</p>;
  if (admin && me && !isAdmin) return <p role="alert" className="surface p-6">Área restrita a administradores.</p>;
  return <>{children}</>;
}
