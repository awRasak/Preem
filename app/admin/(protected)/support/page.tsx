import { createClient } from "@/lib/supabase/server";
import { SupportRequestRow } from "../../SupportRequestRow";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const { data: openSupportRequests } = await supabase
    .from("support_requests")
    .select("id, fan_phone, fan_email, message, created_at, drops(title)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">
        Support requests ({openSupportRequests?.length ?? 0})
      </h1>
      {(openSupportRequests ?? []).length === 0 ? (
        <p className="text-sm text-muted">No open support requests.</p>
      ) : (
        <div className="rounded-xl border border-line px-4">
          {openSupportRequests?.map((r) => {
            type WithDrop = { title: string } | { title: string }[] | null;
            const drop = r.drops as WithDrop;
            const dropTitle = Array.isArray(drop) ? drop[0]?.title : drop?.title;
            return (
              <SupportRequestRow
                key={r.id}
                id={r.id}
                fanPhone={r.fan_phone}
                fanEmail={r.fan_email}
                dropTitle={dropTitle ?? null}
                message={r.message}
                createdAt={r.created_at}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
