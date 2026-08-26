import { PageHeader } from '@/components/page-header';
import { SettingsForm } from '@/components/settings/settings-form';
import { createClient } from '@/lib/supabase/server';
import type { AppSettings } from '@/types/database';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from('app_settings')
    .select('*')
    .maybeSingle<AppSettings>();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Business details and checkout options. These reach the mobile app without a new release."
      />

      {error || !settings ? (
        <p className="text-sm text-destructive">
          Failed to load settings{error ? `: ${error.message}` : '.'}
        </p>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  );
}
