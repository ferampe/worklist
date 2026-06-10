import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Worklist</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" />
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{session.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <DashboardClient />
      </main>
    </div>
  );
}
