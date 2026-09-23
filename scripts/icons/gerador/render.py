import sys, os, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageEnhance
import numpy as np
from objects import OBJ, HAS_ACTIVE

FILTER = '''
<filter id="clay" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
 <feGaussianBlur in="SourceAlpha" stdDeviation="1.3" result="blur"/>
 <feSpecularLighting in="blur" surfaceScale="3.5" specularConstant="0.7" specularExponent="14" lighting-color="#fff4e0" result="spec">
   <feDistantLight azimuth="225" elevation="40"/></feSpecularLighting>
 <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
 <feOffset in="SourceAlpha" dx="-0.9" dy="-1.1" result="inOff"/>
 <feComposite in="SourceAlpha" in2="inOff" operator="out" result="rimShadow"/>
 <feGaussianBlur in="rimShadow" stdDeviation="0.6" result="rimBlur"/>
 <feFlood flood-color="#000" flood-opacity="0.35"/>
 <feComposite in2="rimBlur" operator="in" result="rimDark"/>
 <feComposite in="specIn" in2="SourceGraphic" operator="arithmetic" k2="0.38" k3="1" result="lit0"/>
 <feComposite in="lit0" in2="SourceAlpha" operator="in" result="lit"/>
 <feOffset in="SourceAlpha" dx="1.3" dy="2.0" result="sOff"/>
 <feGaussianBlur in="sOff" stdDeviation="1.4" result="sBlur"/>
 <feFlood flood-color="#5a3c18" flood-opacity="0.42"/>
 <feComposite in2="sBlur" operator="in" result="shadow"/>
 <feMerge><feMergeNode in="shadow"/><feMergeNode in="lit"/><feMergeNode in="rimDark"/></feMerge>
</filter>'''

PX = 1024  # render size of the 100-unit medallion box


def svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{PX}" height="{PX}" viewBox="0 0 100 100">'
            f'<defs>{FILTER}</defs><g filter="url(#clay)">{body}</g></svg>')


def main(ids=None, outdir='layers'):
    os.makedirs(outdir, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': PX, 'height': PX})
        for oid, fn in OBJ.items():
            if ids and oid not in ids:
                continue
            states = ['normal'] + (['ativo'] if HAS_ACTIVE[oid] else [])
            for st in states:
                html = ('<html><body style="margin:0;background:transparent">' + svg(fn(st == 'ativo')) +
                        '</body></html>')
                pg.set_content(html)
                pg.screenshot(path=f'{outdir}/{oid}-{st}.png', omit_background=True,
                              clip={'x': 0, 'y': 0, 'width': PX, 'height': PX})
        b.close()


if __name__ == '__main__':
    main(sys.argv[1:] or None)
