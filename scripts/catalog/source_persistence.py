"""Persistence rights and URL trust are independent from provenance.

SQL returns the brand's source records; eligibility is evaluated exclusively here
both at inventory/preflight and inside the write transaction. Legacy false flags
are UNKNOWN, because the schema defaults to false and records no explicit denial.
"""
import ipaddress
import re
from urllib.parse import urlsplit


def normalize_domain(domain):
    domain = (domain or '').strip().lower().rstrip('.')
    if domain.startswith('www.'):
        domain = domain[4:]
    try:
        domain = domain.encode('idna').decode('ascii')
    except UnicodeError:
        return ''
    if not domain or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in domain.split('.')):
        return ''
    return domain


def image_hostname(url):
    try:
        if not isinstance(url, str) or any(c.isspace() or ord(c) < 32 for c in url) or '\\' in url:
            raise ValueError()
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.username is not None or parts.password is not None or parts.port not in (None, 443):
            raise ValueError()
        # Do not strip www from image hosts: it remains a subdomain.
        host = (parts.hostname or '').lower().rstrip('.').encode('idna').decode('ascii')
        if not normalize_domain(host):
            raise ValueError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError()
        return host
    except (ValueError, UnicodeError):
        raise ValueError('INVALID_IMAGE_AUTHORITY') from None


def matches(host, domain):
    return host == domain or host.endswith('.' + domain)


def source_decision(sources, image_url, source_domain=None):
    provenance = normalize_domain(source_domain)
    try:
        host = image_hostname(image_url)
    except ValueError:
        return dict(state='DENIED', reason='INVALID_IMAGE_AUTHORITY', host=None, provenance=provenance, domains=[])
    active = [s for s in sources if s.get('active') is True or s.get('active') == 1]
    relevant = [s for s in active if normalize_domain(s.get('domain')) and matches(host, normalize_domain(s['domain']))]
    domains = sorted({normalize_domain(s.get('domain')) for s in active
                      if s.get('allows_image_persistence') in (True, 1) and s.get('authorization_state') in (None, 'AUTHORIZED')
                      and normalize_domain(s.get('domain'))})
    authorized = any(s.get('allows_image_persistence') in (True, 1) and s.get('authorization_state') in (None, 'AUTHORIZED') for s in relevant)
    if any(s.get('authorization_state') == 'DENIED' for s in relevant):
        state, reason = 'DENIED', 'SOURCE_EXPLICITLY_DENIED'
    elif authorized:
        state, reason = 'AUTHORIZED', 'SOURCE_AUTHORIZED'
    elif relevant:
        state, reason = 'UNKNOWN', 'SOURCE_RIGHTS_UNCONFIRMED'
    elif any(normalize_domain(s.get('domain')) and matches(host, normalize_domain(s['domain'])) for s in sources):
        state, reason = 'DENIED', 'SOURCE_INACTIVE'
    else:
        state, reason = 'UNKNOWN', 'SOURCE_HOST_NOT_REGISTERED' if sources else 'SOURCE_MISSING'
    return dict(state=state, reason=reason, host=host, provenance=provenance, domains=domains)


def allows_persistence(sources, image_url, source_domain):
    return source_decision(sources, image_url, source_domain)['state'] == 'AUTHORIZED'
