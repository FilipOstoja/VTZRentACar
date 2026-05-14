import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — gives space for the hamburger button */}
        <div className="lg:hidden h-14 flex-shrink-0 bg-white border-b border-ink-150 flex items-center px-16">
          <Link href="/dashboard" className="text-sm font-black text-brand-500 tracking-tight hover:opacity-75 transition-opacity">VTZ Rent-a-Car</Link>
        </div>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
