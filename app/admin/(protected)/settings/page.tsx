import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { PlatformSettingsForm } from "../../PlatformSettingsForm";

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const settings = await getPlatformSettings(supabase);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">Settings</h1>
      <PlatformSettingsForm
        dropCommissionBps={settings.dropCommissionBps}
        giftCommissionBps={settings.giftCommissionBps}
        paystackEnabled={settings.paystackEnabled}
        monipayEnabled={settings.monipayEnabled}
        waitlistModeEnabled={settings.waitlistModeEnabled}
      />
    </main>
  );
}
