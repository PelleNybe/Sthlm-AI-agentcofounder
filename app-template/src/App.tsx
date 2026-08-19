import { Dashboard } from "./Dashboard";

export function App() {
  return (
    <main className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900 flex flex-col items-center">
      <header className="mb-8 w-full max-w-4xl text-left">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AgentCofounder Control Panel
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Live monitoring and control for autonomous agents.
        </p>
      </header>

      <Dashboard />
    </main>
  );
}
