import { getServerUser } from "../lib/getServerAuth";
import { redirect } from "next/navigation";
import LogoutButton from "../components/maincomps/LogoutButton";

export default async function DashboardPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <LogoutButton />
        </div>

        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold text-white mb-4">
            Welcome, {user.fullName}!
          </h2>
          <p className="text-neutral-400">Email: {user.email}</p>
        </div>
      </div>
    </div>
  );
}