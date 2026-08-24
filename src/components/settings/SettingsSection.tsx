import { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { SettingsRow } from './SettingsRow';
import type { SettingsSectionConfig } from '@/config/settingsConfig';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Card wrapper with a title and a divided list of rows -- the standard "section" shell for every settings panel. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Card className="bg-card shadow-card border-0 overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-2 space-y-0.5">
        <CardTitle className="text-[15px] font-bold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/60">{children}</CardContent>
    </Card>
  );
}

/** Renders a static SettingsSectionConfig (placeholder rows only) as a standalone SettingsSection. */
export function ConfiguredSettingsSection({ section }: { section: SettingsSectionConfig }) {
  return (
    <SettingsSection title={section.title}>
      <SettingsConfigRows rows={section.rows} />
    </SettingsSection>
  );
}

/** Renders just the rows from a SettingsRowConfig[] (no Card wrapper) -- for mixing placeholder rows into a hand-authored SettingsSection alongside real controls. */
export function SettingsConfigRows({ rows }: { rows: SettingsSectionConfig['rows'] }) {
  return (
    <>
      {rows.map((row) => (
        <SettingsRow
          key={row.id}
          icon={row.icon}
          title={row.label}
          description={row.description}
          status={row.status}
        />
      ))}
    </>
  );
}
