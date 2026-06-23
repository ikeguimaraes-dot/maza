import { AuthProvider } from "@kph/auth/context";
import type { CurrentUser } from "@kph/auth/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import type { Unit } from "@kph/db/types/database";
import { Sidebar } from "@/components/shell/KphSidebar";
import { PageViewTracker } from "@/components/shell/PageViewTracker";

const STUB_USER: CurrentUser = {
  id: "ike",
  email: "ike@kph.os",
  roles: [{ role: "founder", unitId: null, brandId: null, groupId: null }],
};

export const dynamic = "force-dynamic";

export default async function OrquestradorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = STUB_USER;
  const units = await loadAccessibleUnits();

  return (
    <AuthProvider user={user} units={units}>
      <PageViewTracker />
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 28px" }}>
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}

async function loadAccessibleUnits(): Promise<Unit[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
