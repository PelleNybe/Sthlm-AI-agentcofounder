import { Dashboard } from "./Dashboard";
import { ErrorBoundary } from "./ErrorBoundary";
import { Moon, Sun, Monitor, Menu } from "lucide-react";
import { useTheme } from "./useTheme";
import { useState, useCallback } from "react";

export function App() {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-lg leading-none">AC</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">
                AgentCofounder
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-1.5 rounded-md transition-colors ${theme === "light" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  aria-label="Light theme"
                  title="Light theme"
                >
                  <Sun size={16} />
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`p-1.5 rounded-md transition-colors ${theme === "system" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  aria-label="System theme"
                  title="System theme"
                >
                  <Monitor size={16} />
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-1.5 rounded-md transition-colors ${theme === "dark" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  aria-label="Dark theme"
                  title="Dark theme"
                >
                  <Moon size={16} />
                </button>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 focus:outline-none"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle mobile menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Theme</p>
              <div className="flex gap-2">
                <button onClick={() => setTheme("light")} className={`flex-1 py-2 rounded-md flex justify-center border ${theme === "light" ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  <Sun size={18} />
                </button>
                <button onClick={() => setTheme("system")} className={`flex-1 py-2 rounded-md flex justify-center border ${theme === "system" ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  <Monitor size={18} />
                </button>
                <button onClick={() => setTheme("dark")} className={`flex-1 py-2 rounded-md flex justify-center border ${theme === "dark" ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  <Moon size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col items-center">
        <header className="mb-10 w-full text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Control Panel
          </h1>
          <p className="mt-3 text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            Live monitoring and execution tracking for autonomous systems.
          </p>
        </header>

        <div className="w-full">
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500 dark:text-slate-400">
          AgentCofounder Hackathon &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
