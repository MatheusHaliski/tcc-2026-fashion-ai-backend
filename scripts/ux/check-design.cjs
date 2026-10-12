/** Guard against the typography regressions measured in the FashionAI UX audit. */
const fs = require('node:fs');
const css = fs.readFileSync('app/(site)/globals.css', 'utf8');
const type = fs.readFileSync('lib/design/typography.css', 'utf8');
const errors = [];
for (const match of css.matchAll(/font-size:\s*([\d.]+)px/g)) if (Number(match[1]) < 12) errors.push(`CSS: font-size ${match[1]}px`);
for (const role of ['h1','h2','h3','body','body-sm','caption','label']) {
  const rule = type.match(new RegExp(`\\.type-${role} \\{([^}]+)\\}`));
  if (!rule || !rule[1].includes('font-size:')) errors.push(`type-${role} has no explicit size`);
}
const spec = JSON.parse(fs.readFileSync('lib/design/typography.json', 'utf8'));
if (spec.base.minUppercaseLabelPx < 12 || spec.scale.find(x => x.token === 'label').px < 12) errors.push('Label token below 12px');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Design checks passed: explicit typography roles and labels >=12px.');
