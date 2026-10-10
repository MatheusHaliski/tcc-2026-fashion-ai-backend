"""Match authorized sources like the backend, with domain label boundaries."""
from urllib.parse import urlsplit


def normalize_domain(domain):
    domain = (domain or '').strip().lower()
    return domain[4:] if domain.startswith('www.') else domain


def allows_persistence(sources, image_url, source_domain):
    host = urlsplit(image_url or '').hostname or ''
    host = host.lower()
    origin = normalize_domain(source_domain)
    for source in sources:
        domain = normalize_domain(source.get('domain'))
        if domain and source.get('active') and source.get('allows_image_persistence'):
            if origin == domain or host == domain or host.endswith('.' + domain):
                return True
    return False


def _normalized(expression):
    value = f'LOWER(TRIM({expression}))'
    return f"(CASE WHEN LEFT({value},4)='www.' THEN SUBSTRING({value},5) ELSE {value} END)"


# Sources are joined to the product brand; no wildcard or unrelated suffix match.
DOMAIN = _normalized('s.domain')
ORIGIN = _normalized('i.source_domain')
# Remove query/fragment before extracting authority, including URLs with no path.
# Then discard userinfo and port. IPv6 authorities fail closed for DNS grants.
URL_WITHOUT_SUFFIX = "SUBSTRING_INDEX(SUBSTRING_INDEX(i.image_url,'?',1),'#',1)"
AUTHORITY = f"SUBSTRING_INDEX(SUBSTRING_INDEX({URL_WITHOUT_SUFFIX},'://',-1),'/',1)"
HOST = f"LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX({AUTHORITY},'@',-1),':',1))"
SOURCE_MATCH_SQL = (f"({DOMAIN} <> '' AND ({ORIGIN}={DOMAIN} OR {HOST}={DOMAIN} "
                    f"OR RIGHT({HOST},CHAR_LENGTH({DOMAIN})+1)=CONCAT('.',{DOMAIN})))")
