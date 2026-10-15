import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/AdminShell";

// Runs once per navigation instead of once per page -- the previous
// per-page auth check (getUser + a role lookup query) duplicated this on
// every single tab click, on top of the whole nav shell remounting since
// it wasn't a real layout. Both are now shared here.
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role === "artist") redirect("/artist/dashboard");
  if (roleRow?.role !== "admin") redirect("/");

  // Sidebar count pills (support open tickets, drops, approved artists,
  // merch awaiting shipment) -- one parallel wave here in the layout so
  // every admin page gets them without refetching per tab.
  const [{ count: openSupport }, { count: songsCount }, { count: artistsCount }, { count: merchCount }] =
    await Promise.all([
      supabase.from("support_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("drops").select("id", { count: "exact", head: true }),
      supabase.from("artists").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
      supabase
        .from("merch_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "success")
        .neq("fulfillment", "delivered"),
    ]);

  return (
    <AdminShell
      badges={{
        support: openSupport ?? 0,
        songs: songsCount ?? 0,
        artists: artistsCount ?? 0,
        merch: merchCount ?? 0,
      }}
    >
      {children}
    </AdminShell>
  );
}
