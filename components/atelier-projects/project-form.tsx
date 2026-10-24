'use client';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
import { SPEC_FIELDS, type ProjectDraft, type ProjectVisibility, type Specification } from './contracts';
import styles from './atelier-projects.module.css';

export function ProjectForm({ draft, onChange, disabled = false }: { draft: ProjectDraft; onChange: (draft: ProjectDraft) => void; disabled?: boolean }) {
  const { t } = useI18n();
  function spec<K extends keyof Specification>(key: K, value: Specification[K]) { onChange({ ...draft, specification: { ...draft.specification, [key]: value } }); }
  return <fieldset disabled={disabled} className={styles.stack}>
    <div className={styles.formGrid}>
      <Field id="project-title" label={t('atelierProjects.title')} required><Input id="project-title" required maxLength={160} value={draft.title} onChange={e => onChange({ ...draft, title: e.target.value })}/></Field>
      <Field id="project-visibility" label={t('atelierProjects.visibility')}><Select id="project-visibility" value={draft.visibility} onChange={e => onChange({ ...draft, visibility: e.target.value as ProjectVisibility })}>{(['PRIVATE', 'FOLLOWERS', 'PUBLIC'] as const).map(value => <option key={value} value={value}>{t(`atelierProjects.visibility.${value}`)}</option>)}</Select></Field>
      <Field id="project-brief" label={t('atelierProjects.brief')} className={styles.full}><Textarea id="project-brief" maxLength={4000} value={draft.brief} onChange={e => onChange({ ...draft, brief: e.target.value })}/></Field>
    </div>
    <h2 className="type-h3">{t('atelierProjects.specification')}</h2>
    <p>{t('atelierProjects.specificationHint')}</p>
    <div className={styles.formGrid}>{SPEC_FIELDS.map(key => <Field key={key} id={`spec-${key}`} label={t(`atelierProjects.field.${key}`)}>{key === 'family' || key === 'colors' ? <Input id={`spec-${key}`} maxLength={key === 'family' ? 120 : 1000} value={draft.specification[key] ?? ''} onChange={e => spec(key, e.target.value)}/> : <Textarea id={`spec-${key}`} maxLength={['frontView', 'backView', 'referenceNotes', 'notes'].includes(key) ? 3000 : ['pockets', 'collar', 'sleeves', 'fastenings'].includes(key) ? 1500 : 2000} value={draft.specification[key] ?? ''} onChange={e => spec(key, e.target.value)}/>}</Field>)}</div>
    <h2 className="type-h3">{t('atelierProjects.field.measurements')}</h2><p>{t('atelierProjects.measurementHint')}</p>
    {draft.specification.measurements.map((measurement, index) => <div className={styles.measurement} key={index}>
      <Field id={`point-${index}`} label={t('atelierProjects.measurementPoint')} required><Input id={`point-${index}`} required maxLength={80} value={measurement.point} onChange={e => spec('measurements', draft.specification.measurements.map((m, i) => i === index ? { ...m, point: e.target.value } : m))}/></Field>
      <Field id={`protocol-${index}`} label={t('atelierProjects.measurementProtocol')} required><Input id={`protocol-${index}`} required maxLength={160} value={measurement.protocol} onChange={e => spec('measurements', draft.specification.measurements.map((m, i) => i === index ? { ...m, protocol: e.target.value } : m))}/></Field>
      <Field id={`cm-${index}`} label={t('atelierProjects.centimeters')} required><Input id={`cm-${index}`} required type="number" min="0.1" max="1000" step="0.1" value={measurement.centimeters || ''} onChange={e => spec('measurements', draft.specification.measurements.map((m, i) => i === index ? { ...m, centimeters: Number(e.target.value) } : m))}/></Field>
      <Button type="button" onClick={() => spec('measurements', draft.specification.measurements.filter((_, i) => i !== index))}>{t('atelierProjects.remove')}</Button>
    </div>)}
    <div><Button type="button" disabled={draft.specification.measurements.length >= 40} onClick={() => spec('measurements', [...draft.specification.measurements, { point: '', protocol: '', centimeters: 0 }])}>{t('atelierProjects.addMeasurement')}</Button></div>
    <label className={styles.check}><input type="checkbox" required checked={draft.rightsAccepted} onChange={e => onChange({ ...draft, rightsAccepted: e.target.checked })}/><span>{t('atelierProjects.rights')}</span></label>
  </fieldset>;
}
