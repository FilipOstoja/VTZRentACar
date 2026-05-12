import { redirect } from "next/navigation";
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
    <div className="flex min-h-screen bg-[#F7F9FC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — gives space for the hamburger button */}
        <div className="lg:hidden h-14 flex-shrink-0 bg-white border-b border-[#E7E7E7] flex items-center px-16">
          <span className="text-sm font-black text-[#003580] tracking-tight">VTZ Rent-a-Car</span>
        </div>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
