import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Worklist</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Bienvenido, {session.user?.name ?? session.user?.email}</p>
          <p className="mt-2 text-sm">Los espacios de trabajo aparecerán aquí (Fase 1).</p>
        </div>
      </main>
    </div>
  );
}
