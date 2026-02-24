import { useAuth } from "@/hooks/useAuth";
import { useLogout, getGoogleLoginURL } from "@/api/auth";
import { getStoredRefreshToken } from "@/api/client";
import ImportCSV from "@/components/ImportCSV";
import CreateOrder from "@/components/CreateOrder";
import OrdersTable from "@/components/OrdersTable";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogOut, ExternalLink } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function DashboardPage() {
  const { logout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    const rt = getStoredRefreshToken();
    if (rt) {
      await logoutMutation.mutateAsync(rt);
    }
    logout();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="w-full px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Instant Wellness</h1>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">Tax Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`${API_URL}/swagger/index.html`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                API Docs
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ImportCSV />
          <CreateOrder />
        </div>
        <OrdersTable />
      </main>
    </div>
  );
}
