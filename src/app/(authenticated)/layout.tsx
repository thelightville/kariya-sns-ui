import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-navy-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ marginLeft: 256 }}>
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
