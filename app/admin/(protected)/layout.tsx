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
  if (!user) redirect("/artist/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "admin") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
