"""Um domínio oficial para o coletor (RF47): robots.txt, sitemaps declarados e o fetch educado por domínio, que para
no 403/429 e nunca sai do domínio."""
from __future__ import annotations

import re
import time
import urllib.robotparser
from dataclasses import dataclass, field
from typing import Callable, Optional
from urllib.parse import urljoin

from normalize_product import domain
from validate_source import same_site

Fetch = Callable[[str], tuple[int, bytes, str]]
DEFAULT_UA = "FashionAI-CatalogBot/1.0 (+https://fashionai.app/catalog-bot)"


class StopDomain(Exception):
    """O site pediu para parar (403/429) ou o robots.txt não deixa: o coletor larga o domínio."""


@dataclass
class Politeness:
    """Intervalo entre requisições por domínio: o maior entre o mínimo configurado e o Crawl-delay do robots.txt."""
    min_interval: float = 1.0
    last: dict = field(default_factory=dict)
    sleep: Callable[[float], None] = time.sleep
    clock: Callable[[], float] = time.monotonic

    def wait(self, host: str, crawl_delay: Optional[float]):
        interval = max(self.min_interval, crawl_delay or 0)
        now = self.clock()
        due = self.last.get(host, -1e9) + interval
        if now < due:
            self.sleep(due - now)
        self.last[host] = self.clock()


def looks_like_html(body: bytes, content_type: str) -> bool:
    """Página HTML no lugar de um arquivo (robots.txt/sitemap que redirecionou para a página inicial)."""
    if "html" in (content_type or "").lower():
        return True
    head = body[:512].lstrip().lower()
    return head.startswith((b"<!doctype html", b"<html"))


class Site:
    """Um domínio oficial: robots.txt, sitemaps e o fetch educado."""

    def __init__(self, official_domain: str, fetch: Fetch, politeness: Politeness, user_agent: str = DEFAULT_UA):
        self.domain = official_domain.lower()
        self.base = f"https://{self.domain}"
        self.fetch_raw, self.polite, self.ua = fetch, politeness, user_agent
        self.robots = urllib.robotparser.RobotFileParser()
        self.robots_loaded = False
        self.sitemaps: list[str] = []
        self.requests = 0

    def load_robots(self):
        try:
            status, body, ctype = self._get(urljoin(self.base + "/", "robots.txt"), check_robots=False)
        except StopDomain:
            status, body, ctype = 403, b"", ""
        if status == 200 and looks_like_html(body, ctype):
            # o domínio sem www. redirecionou o robots.txt para a página inicial (ex.: hering.com.br → www.hering.com.br/):
            # HTML não é robots.txt — sem isso o coletor ficava sem sitemaps e não achava nenhum produto
            status, body = 404, b""
        if status in (0, 403, 404) and not self.domain.startswith("www."):
            alt = f"https://www.{self.domain}"                    # muitos sites só respondem (ou só liberam) no www.
            try:
                s2, b2, _ = self._get(urljoin(alt + "/", "robots.txt"), check_robots=False)
            except StopDomain:
                s2, b2 = 403, b""
            if s2 == 200 and looks_like_html(b2, ""):
                s2 = 404
            if s2 not in (0, 404):
                self.base, status, body = alt, s2, b2
        if status in (401, 403):
            raise StopDomain(f"{self.domain}: robots.txt respondeu {status} — sem permissão para coletar")
        if status == 0:
            raise StopDomain(f"{self.domain}: sem conexão com o site (rede/proxy bloqueou ou o domínio não respondeu)")
        text = body.decode("utf-8", "replace") if status == 200 else ""
        self.robots.parse(text.splitlines())                      # 404 = sem regras (permitido, como manda o padrão)
        # sitemap do próprio site declarado em http:// (Aéropostale) é lido em https: o coletor só fala https
        self.sitemaps = [("https://" + u[len("http://"):]) if u.lower().startswith("http://") and same_site(domain(u), self.domain) else u
                         for u in (m.group(1).strip() for m in re.finditer(r"(?im)^\s*sitemap:\s*(\S+)", text))]
        if not any(same_site(domain(u), self.domain) for u in self.sitemaps):
            # nenhum sitemap declarado no próprio domínio (robots aponta para um domínio antigo ou de outra loja, ex.:
            # lezalez.com → lezalez.com.br, richards.com.br → richards.br): tenta também os sitemaps padrão do site —
            # Superdry e Birkenstock só respondem em /sitemap_index.xml (Salesforce Commerce), sem declará-lo no robots
            self.sitemaps.append(urljoin(self.base + "/", "sitemap.xml"))
            self.sitemaps.append(urljoin(self.base + "/", "sitemap_index.xml"))
        self.robots_loaded = True

    def allowed(self, url: str) -> bool:
        return self.robots.can_fetch(self.ua, url)

    def get(self, url: str) -> tuple[int, bytes, str]:
        return self._get(url, check_robots=True)

    def _get(self, url: str, check_robots: bool) -> tuple[int, bytes, str]:
        if not same_site(domain(url), self.domain):
            return 0, b"", ""                                     # nunca sai do domínio oficial
        if check_robots and self.robots_loaded and not self.allowed(url):
            return 0, b"", ""
        crawl_delay = self.robots.crawl_delay(self.ua) if self.robots_loaded else None
        self.polite.wait(self.domain, float(crawl_delay) if crawl_delay else None)
        self.requests += 1
        status, body, ctype = self.fetch_raw(url)
        if status in (403, 429):
            raise StopDomain(f"{self.domain}: {status} em {url} — o site pediu para parar")
        return status, body, ctype
