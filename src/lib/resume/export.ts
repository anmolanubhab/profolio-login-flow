import jsPDF from 'jspdf';
import type { ResumeDoc, SectionId } from './schema';
import { getTemplate } from './templates';
import { htmlToBullets } from './phrases';

/**
 * Render a ResumeDoc to a text-based PDF with jsPDF (no html2canvas, so the
 * output stays selectable and small). The layout follows the chosen template's
 * accent colour and heading style so the download resembles the on-screen
 * preview without trying to be a pixel copy of it.
 */

function hslToRgb(hsl: string): [number, number, number] {
  const m = hsl.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return [30, 64, 175];
  const h = +m[1] / 360;
  const s = +m[2] / 100;
  const l = +m[3] / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(conv(h + 1 / 3) * 255),
    Math.round(conv(h) * 255),
    Math.round(conv(h - 1 / 3) * 255),
  ];
}

const SECTION_TITLE: Record<SectionId, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  custom: 'More',
};

export function resumeToPlainText(doc: ResumeDoc): string {
  const L: string[] = [];
  const b = doc.basics;
  L.push(b.fullName || 'Your Name');
  if (b.headline) L.push(b.headline);
  L.push(
    [b.email, b.phone, b.location, b.website, b.linkedin]
      .filter(Boolean)
      .join('  |  '),
  );
  L.push('');

  const order = doc.design.order;
  for (const sec of order) {
    if (sec === 'summary' && stripTags(doc.summary)) {
      L.push('SUMMARY', stripTags(doc.summary), '');
    }
    if (sec === 'experience' && doc.experience.length) {
      L.push('EXPERIENCE');
      for (const e of doc.experience) {
        L.push(
          [e.role, e.company].filter(Boolean).join(' — ') +
            (e.startDate || e.current
              ? `  (${e.startDate}${e.startDate ? ' – ' : ''}${
                  e.current ? 'Present' : e.endDate
                })`
              : ''),
        );
        for (const bl of htmlToBullets(e.description)) L.push(`  • ${bl}`);
        L.push('');
      }
    }
    if (sec === 'education' && doc.education.length) {
      L.push('EDUCATION');
      for (const e of doc.education) {
        L.push(
          [
            [e.degree, e.field].filter(Boolean).join(', '),
            e.school,
          ]
            .filter(Boolean)
            .join(' — '),
        );
        if (e.endDate || e.startDate)
          L.push(`  ${e.startDate}${e.startDate ? ' – ' : ''}${e.endDate}`);
        for (const bl of htmlToBullets(e.description)) L.push(`  • ${bl}`);
        L.push('');
      }
    }
    if (sec === 'skills' && doc.skills.length) {
      L.push('SKILLS', doc.skills.map((s) => s.name).filter(Boolean).join(', '), '');
    }
    if (sec === 'projects' && doc.projects.length) {
      L.push('PROJECTS');
      for (const p of doc.projects) {
        L.push([p.name, p.url].filter(Boolean).join(' — '));
        for (const bl of htmlToBullets(p.description)) L.push(`  • ${bl}`);
        L.push('');
      }
    }
    if (sec === 'custom') {
      for (const c of doc.custom) {
        if (!stripTags(c.body) && !c.title) continue;
        L.push((c.title || 'Section').toUpperCase());
        for (const bl of htmlToBullets(c.body)) L.push(`  • ${bl}`);
        L.push('');
      }
    }
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function stripTags(s: string): string {
  return (s || '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function downloadResumeText(doc: ResumeDoc, fileName: string): void {
  const blob = new Blob([resumeToPlainText(doc)], {
    type: 'text/plain;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName(fileName)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function buildResumePdf(doc: ResumeDoc, fileName: string): jsPDF {
  const tpl = getTemplate(doc.design.template);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const [ar, ag, ab] = hslToRgb(doc.design.accent);
  const lh =
    doc.design.scale === 'compact' ? 13 : doc.design.scale === 'roomy' ? 17 : 15;
  let y = margin;

  const ensure = (need: number) => {
    if (y + need > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const font = tpl.font === 'serif' ? 'times' : 'helvetica';

  // Header
  if (tpl.header === 'band') {
    pdf.setFillColor(ar, ag, ab);
    pdf.rect(0, 0, pageW, 96, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(font, 'bold');
    pdf.setFontSize(22);
    pdf.text(doc.basics.fullName || 'Your Name', margin, 44);
    pdf.setFont(font, 'normal');
    pdf.setFontSize(11);
    if (doc.basics.headline) pdf.text(doc.basics.headline, margin, 62);
    pdf.setFontSize?.(9);
    pdf.setFontSize(9);
    pdf.text(
      [
        doc.basics.email,
        doc.basics.phone,
        doc.basics.location,
        doc.basics.website,
        doc.basics.linkedin,
      ]
        .filter(Boolean)
        .join('   |   '),
      margin,
      80,
    );
    y = 120;
    pdf.setTextColor(30, 30, 30);
  } else {
    pdf.setTextColor(20, 20, 20);
    pdf.setFont(font, 'bold');
    pdf.setFontSize(22);
    pdf.text(doc.basics.fullName || 'Your Name', margin, y + 6);
    y += 22;
    if (doc.basics.headline) {
      pdf.setFont(font, 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(ar, ag, ab);
      pdf.text(doc.basics.headline, margin, y);
      y += 16;
    }
    pdf.setTextColor(90, 90, 90);
    pdf.setFontSize(9);
    pdf.text(
      [
        doc.basics.email,
        doc.basics.phone,
        doc.basics.location,
        doc.basics.website,
        doc.basics.linkedin,
      ]
        .filter(Boolean)
        .join('   |   '),
      margin,
      y,
    );
    y += 14;
    pdf.setDrawColor(ar, ag, ab);
    pdf.setLineWidth(1.2);
    pdf.line(margin, y, pageW - margin, y);
    y += 18;
    pdf.setTextColor(30, 30, 30);
  }

  const heading = (label: string) => {
    ensure(30);
    y += 4;
    pdf.setFont(font, 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(ar, ag, ab);
    const text = tpl.heading === 'caps' ? label.toUpperCase() : label;
    pdf.text(text, margin, y);
    y += 6;
    if (tpl.heading === 'underline' || tpl.heading === 'bar') {
      pdf.setDrawColor(ar, ag, ab);
      pdf.setLineWidth(tpl.heading === 'bar' ? 3 : 0.8);
      pdf.line(margin, y, tpl.heading === 'bar' ? margin + 36 : pageW - margin, y);
    }
    y += 12;
    pdf.setTextColor(30, 30, 30);
  };

  const para = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    if (!text) return;
    pdf.setFont(font, opts?.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts?.size ?? 10);
    pdf.setTextColor(...(opts?.color ?? [40, 40, 40]));
    const lines = pdf.splitTextToSize(text, contentW);
    for (const ln of lines) {
      ensure(lh);
      pdf.text(ln, margin, y);
      y += lh;
    }
  };

  const bullets = (items: string[]) => {
    pdf.setFont(font, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(45, 45, 45);
    for (const it of items) {
      const lines = pdf.splitTextToSize(it, contentW - 14);
      lines.forEach((ln: string, i: number) => {
        ensure(lh);
        if (i === 0) {
          pdf.setFillColor(ar, ag, ab);
          pdf.circle(margin + 3, y - 3, 1.6, 'F');
        }
        pdf.text(ln, margin + 14, y);
        y += lh;
      });
    }
  };

  for (const sec of doc.design.order) {
    if (sec === 'summary' && stripTags(doc.summary)) {
      heading(SECTION_TITLE.summary);
      para(stripTags(doc.summary));
      y += 6;
    }
    if (sec === 'experience' && doc.experience.some((e) => e.role || e.company)) {
      heading(SECTION_TITLE.experience);
      for (const e of doc.experience) {
        ensure(24);
        para([e.role, e.company].filter(Boolean).join(' — '), { bold: true, size: 11 });
        const dates =
          e.startDate || e.current || e.endDate
            ? `${e.startDate}${e.startDate ? ' – ' : ''}${
                e.current ? 'Present' : e.endDate
              }${e.location ? '  ·  ' + e.location : ''}`
            : e.location;
        if (dates) para(dates, { size: 9, color: [120, 120, 120] });
        const bl = htmlToBullets(e.description);
        if (bl.length) bullets(bl);
        y += 8;
      }
    }
    if (sec === 'education' && doc.education.some((e) => e.school)) {
      heading(SECTION_TITLE.education);
      for (const e of doc.education) {
        ensure(20);
        para(
          [[e.degree, e.field].filter(Boolean).join(', '), e.school]
            .filter(Boolean)
            .join(' — '),
          { bold: true, size: 11 },
        );
        const d = `${e.startDate}${e.startDate && e.endDate ? ' – ' : ''}${
          e.endDate
        }${e.location ? '  ·  ' + e.location : ''}`.trim();
        if (d) para(d, { size: 9, color: [120, 120, 120] });
        const bl = htmlToBullets(e.description);
        if (bl.length) bullets(bl);
        y += 8;
      }
    }
    if (sec === 'skills' && doc.skills.some((s) => s.name)) {
      heading(SECTION_TITLE.skills);
      para(doc.skills.map((s) => s.name).filter(Boolean).join(' · '));
      y += 6;
    }
    if (sec === 'projects' && doc.projects.some((p) => p.name)) {
      heading(SECTION_TITLE.projects);
      for (const p of doc.projects) {
        ensure(18);
        para([p.name, p.url].filter(Boolean).join(' — '), { bold: true, size: 11 });
        const bl = htmlToBullets(p.description);
        if (bl.length) bullets(bl);
        y += 8;
      }
    }
    if (sec === 'custom') {
      for (const c of doc.custom) {
        if (!stripTags(c.body) && !c.title) continue;
        heading(c.title || 'Section');
        const bl = htmlToBullets(c.body);
        if (bl.length) bullets(bl);
        else para(stripTags(c.body));
        y += 6;
      }
    }
  }

  return pdf;
}

export function downloadResumePdf(doc: ResumeDoc, fileName: string): void {
  buildResumePdf(doc, fileName).save(`${safeName(fileName)}.pdf`);
}

function safeName(s: string): string {
  return (s || 'resume').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'resume';
}
