import { useAuth } from "@/contexts/auth";
import { useLogout } from "@/contexts/auth/hooks/api";
import { getStoredRefreshToken } from "@/shared/api/client";
import { OrdersDashboardPage } from "@/contexts/board/elements/orders";
import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { LogOut, ExternalLink, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

function DashboardPage() {
  const { logout } = useAuth();
  const { logoutAsync } = useLogout();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    const rt = getStoredRefreshToken();
    try {
      if (rt) await logoutAsync(rt);
    } catch {
      toast.error(
        "Sign-out request failed, but you have been logged out locally.",
      );
    }
    logout();
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      <header className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="w-full px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Instant Wellness</h1>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">Tax Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="/swagger/index.html"
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

      <div className="flex-1 overflow-auto">
        <OrdersDashboardPage />
      </div>
    </div>
  );
}

export { DashboardPage };
