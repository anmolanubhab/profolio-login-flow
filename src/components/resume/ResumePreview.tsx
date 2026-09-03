import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { ResumeDoc, SectionId } from '@/lib/resume/schema';
import { getTemplate } from '@/lib/resume/templates';
import { FONT_STACKS, SCALE_PX } from '@/lib/resume/templates';

/**
 * Single parametric renderer for every template. The editor's live preview and
 * the gallery thumbnails both use this, so what you pick is what you download.
 * Rendered at a fixed A4 pixel width (794 = 210mm @96dpi); callers scale it
 * with a CSS transform.
 */

const A4_W = 794;
const A4_MIN_H = 1123;

function sanitize(html: string): string {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

const SECTION_LABEL: Record<SectionId, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  custom: 'More',
};

interface Props {
  doc: ResumeDoc;
  /** px width to fit into; the A4 page is scaled to match. */
  fitWidth?: number;
  className?: string;
}

export function ResumePreview({ doc, fitWidth, className }: Props) {
  const tpl = getTemplate(doc.design.template);
  const accent = `hsl(${doc.design.accent})`;
  const accentSoft = `hsl(${doc.design.accent} / 0.12)`;
  const fontStack = FONT_STACKS[doc.design.font].stack;
  const scale = SCALE_PX[doc.design.scale];
  const rhythm = doc.design.spacing;

  const wrapStyle = useMemo(() => {
    if (!fitWidth) return undefined;
    const s = fitWidth / A4_W;
    return {
      width: fitWidth,
      height: A4_MIN_H * s,
      overflow: 'hidden',
    } as React.CSSProperties;
  }, [fitWidth]);

  const pageStyle: React.CSSProperties = {
    width: A4_W,
    minHeight: A4_MIN_H,
    background: '#fff',
    color: '#1f2430',
    fontFamily: fontStack,
    fontSize: scale.base,
    lineHeight: 1.5,
    transform: fitWidth ? `scale(${fitWidth / A4_W})` : undefined,
    transformOrigin: 'top left',
    boxShadow: fitWidth ? undefined : '0 1px 3px rgba(16,24,40,.12)',
  };

  const gap = `${18 * rhythm}px`;

  const orderedSections = doc.design.order;

  const Heading = ({ children }: { children: React.ReactNode }) => {
    const base: React.CSSProperties = {
      color: accent,
      fontWeight: 700,
      fontSize: scale.h2,
      margin: `0 0 ${8 * rhythm}px`,
      letterSpacing: tpl.heading === 'caps' ? '.12em' : undefined,
      textTransform: tpl.heading === 'caps' ? 'uppercase' : undefined,
    };
    if (tpl.heading === 'underline')
      return (
        <h2 style={{ ...base, borderBottom: `1px solid ${accent}`, paddingBottom: 3 }}>
          {children}
        </h2>
      );
    if (tpl.heading === 'bar')
      return (
        <h2 style={{ ...base, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 22,
              height: 3,
              background: accent,
            }}
          />
          {children}
        </h2>
      );
    return <h2 style={base}>{children}</h2>;
  };

  const RichText = ({ html }: { html: string }) => (
    <div
      className="resume-rt"
      style={{ fontSize: scale.base }}
      dangerouslySetInnerHTML={{ __html: sanitize(html) }}
    />
  );

  const EntryHead = ({
    title,
    right,
    sub,
  }: {
    title: string;
    right?: string;
    sub?: string;
  }) => (
    <div style={{ marginBottom: 3 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'baseline',
        }}
      >
        <strong style={{ fontSize: scale.base + 1 }}>{title}</strong>
        {right ? (
          <span style={{ color: '#6b7280', fontSize: scale.base - 1, whiteSpace: 'nowrap' }}>
            {right}
          </span>
        ) : null}
      </div>
      {sub ? (
        <div style={{ color: '#6b7280', fontSize: scale.base - 1 }}>{sub}</div>
      ) : null}
    </div>
  );

  const renderSection = (sec: SectionId) => {
    if (sec === 'summary') {
      if (!strip(doc.summary)) return null;
      return (
        <section key={sec}>
          <Heading>{SECTION_LABEL.summary}</Heading>
          <RichText html={doc.summary} />
        </section>
      );
    }
    if (sec === 'experience') {
      const rows = doc.experience.filter((e) => e.role || e.company || strip(e.description));
      if (!rows.length) return null;
      return (
        <section key={sec}>
          <Heading>{SECTION_LABEL.experience}</Heading>
          <div style={{ display: 'grid', gap: `${12 * rhythm}px` }}>
            {rows.map((e) => (
              <div key={e.id}>
                <EntryHead
                  title={[e.role, e.company].filter(Boolean).join(' · ') || 'Role'}
                  right={dateRange(e.startDate, e.current ? 'Present' : e.endDate)}
                  sub={e.location || undefined}
                />
                <RichText html={e.description} />
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (sec === 'education') {
      const rows = doc.education.filter((e) => e.school || e.degree);
      if (!rows.length) return null;
      return (
        <section key={sec}>
          <Heading>{SECTION_LABEL.education}</Heading>
          <div style={{ display: 'grid', gap: `${10 * rhythm}px` }}>
            {rows.map((e) => (
              <div key={e.id}>
                <EntryHead
                  title={
                    [[e.degree, e.field].filter(Boolean).join(', '), e.school]
                      .filter(Boolean)
                      .join(' — ') || 'School'
                  }
                  right={dateRange(e.startDate, e.endDate)}
                  sub={e.location || undefined}
                />
                <RichText html={e.description} />
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (sec === 'skills') {
      const rows = doc.skills.filter((s) => s.name);
      if (!rows.length) return null;
      return (
        <section key={sec}>
          <Heading>{SECTION_LABEL.skills}</Heading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rows.map((s) => (
              <span
                key={s.id}
                style={{
                  background: accentSoft,
                  color: '#1f2430',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: scale.base - 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {s.name}
                {s.level > 0 && (
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 9,
                          background: i < s.level ? accent : 'hsl(220 10% 80%)',
                        }}
                      />
                    ))}
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      );
    }
    if (sec === 'projects') {
      const rows = doc.projects.filter((p) => p.name || strip(p.description));
      if (!rows.length) return null;
      return (
        <section key={sec}>
          <Heading>{SECTION_LABEL.projects}</Heading>
          <div style={{ display: 'grid', gap: `${10 * rhythm}px` }}>
            {rows.map((p) => (
              <div key={p.id}>
                <EntryHead title={p.name || 'Project'} right={p.url || undefined} />
                <RichText html={p.description} />
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (sec === 'custom') {
      const rows = doc.custom.filter((c) => c.title || strip(c.body));
      if (!rows.length) return null;
      return (
        <div key={sec} style={{ display: 'grid', gap }}>
          {rows.map((c) => (
            <section key={c.id}>
              <Heading>{c.title || 'Section'}</Heading>
              <RichText html={c.body} />
            </section>
          ))}
        </div>
      );
    }
    return null;
  };

  const contact = [
    doc.basics.email,
    doc.basics.phone,
    doc.basics.location,
    doc.basics.website,
    doc.basics.linkedin,
  ].filter(Boolean);

  /* -------- header variants -------- */
  const HeaderBand = (
    <div style={{ background: accent, color: '#fff', padding: '28px 40px' }}>
      <div style={{ fontSize: scale.h1, fontWeight: 800, lineHeight: 1.1 }}>
        {doc.basics.fullName || 'Your Name'}
      </div>
      {doc.basics.headline && (
        <div style={{ fontSize: scale.base + 1, opacity: 0.92, marginTop: 4 }}>
          {doc.basics.headline}
        </div>
      )}
      {contact.length > 0 && (
        <div style={{ fontSize: scale.base - 1, opacity: 0.9, marginTop: 8 }}>
          {contact.join('  |  ')}
        </div>
      )}
    </div>
  );

  const HeaderPlain = (
    <div style={{ padding: '32px 40px 0' }}>
      <div style={{ fontSize: scale.h1, fontWeight: 800, lineHeight: 1.1 }}>
        {doc.basics.fullName || 'Your Name'}
      </div>
      {doc.basics.headline && (
        <div style={{ fontSize: scale.base + 2, color: accent, marginTop: 4 }}>
          {doc.basics.headline}
        </div>
      )}
      {contact.length > 0 && (
        <div style={{ fontSize: scale.base - 1, color: '#6b7280', marginTop: 8 }}>
          {contact.join('  |  ')}
        </div>
      )}
      <div style={{ borderBottom: `2px solid ${accent}`, marginTop: 14 }} />
    </div>
  );

  /* -------- layout: single vs sidebar -------- */
  if (tpl.header === 'sidebar') {
    const railSections = orderedSections.filter((s) => s === 'skills');
    const mainSections = orderedSections.filter((s) => s !== 'skills');
    return (
      <div className={className} style={wrapStyle}>
        <div style={pageStyle}>
          <div style={{ display: 'flex', minHeight: A4_MIN_H }}>
            <aside
              style={{
                width: 232,
                background: accentSoft,
                padding: '28px 22px',
                display: 'grid',
                gap,
                alignContent: 'start',
              }}
            >
              {tpl.photo && (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 999,
                    background: `hsl(${doc.design.accent} / 0.25)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accent,
                    fontWeight: 700,
                    fontSize: 28,
                  }}
                >
                  {initials(doc.basics.fullName)}
                </div>
              )}
              <div>
                <div style={{ fontSize: scale.h1 - 6, fontWeight: 800, lineHeight: 1.15 }}>
                  {doc.basics.fullName || 'Your Name'}
                </div>
                {doc.basics.headline && (
                  <div style={{ fontSize: scale.base, color: accent, marginTop: 2 }}>
                    {doc.basics.headline}
                  </div>
                )}
              </div>
              {contact.length > 0 && (
                <div style={{ display: 'grid', gap: 3, fontSize: scale.base - 1 }}>
                  {contact.map((c) => (
                    <div key={c} style={{ wordBreak: 'break-word' }}>
                      {c}
                    </div>
                  ))}
                </div>
              )}
              {railSections.map((s) => renderSection(s))}
            </aside>
            <main style={{ flex: 1, padding: '28px 32px', display: 'grid', gap, alignContent: 'start' }}>
              {mainSections.map((s) => renderSection(s))}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={wrapStyle}>
      <div style={pageStyle}>
        {tpl.header === 'band' ? HeaderBand : HeaderPlain}
        <div style={{ padding: '22px 40px 40px', display: 'grid', gap }}>
          {orderedSections.map((s) => renderSection(s))}
        </div>
      </div>
    </div>
  );
}

function strip(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').trim();
}
function dateRange(a: string, b: string): string | undefined {
  const x = [a, b].filter(Boolean);
  if (!x.length) return undefined;
  return x.join(' – ');
}
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '—'
  );
}
