import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Users, Activity, Plug, Plus, RefreshCw, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface Integration {
  id: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksRes, intsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/integrations')
      ]);

      if (!tasksRes.ok || !intsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const tasksData = await tasksRes.json();
      const intsData = await intsRes.json();

      setTasks(tasksData);
      setIntegrations(intsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerTask = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Create a task using a hardcoded UUID as a placeholder since we don't have real auth on frontend
      const userId = "00000000-0000-0000-0000-000000000000";
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Analysis Job ${new Date().toLocaleTimeString()}`,
          description: 'Triggered from Dashboard',
          userId
        })
      });

      if (!res.ok) {
         throw new Error('Failed to trigger task');
      }

      await fetchData();
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // Group tasks by date for the chart
  const tasksByDate = tasks.reduce((acc, task) => {
    const date = new Date(task.createdAt).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(tasksByDate).sort().map(date => ({
    date,
    count: tasksByDate[date]
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-indigo-600" />
              <span className="font-semibold text-xl text-gray-900 tracking-tight">AgentCofounder Dashboard</span>
            </div>
            <div>
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                <div>
                    <h3 className="text-sm font-medium text-red-800">Error fetching data</h3>
                    <div className="mt-1 text-sm text-red-700">
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6 transition-all hover:shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-indigo-50 rounded-lg">
                <Activity className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-bold text-gray-900">{isLoading ? '...' : tasks.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6 transition-all hover:shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-green-50 rounded-lg">
                <Plug className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Integrations</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-bold text-gray-900">{isLoading ? '...' : integrations.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>

           <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6 flex flex-col justify-center">
              <button
                onClick={triggerTask}
                disabled={isSubmitting || isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Trigger Analysis Job
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Task Activity Over Time</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center items-center min-h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center text-gray-400">
                             <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                             <p className="text-sm">Loading activity data...</p>
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12">
                            <Activity className="mx-auto h-12 w-12 text-gray-300" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No historical data available</h3>
                            <p className="mt-1 text-sm text-gray-500">Trigger an analysis job to see activity.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Tasks</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {tasks.length} total
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
                        </div>
                    ) : tasks.length > 0 ? (
                        <ul className="divide-y divide-gray-100">
                            {tasks.map(task => (
                                <li key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-indigo-600 truncate mr-4">{task.title}</p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                  task.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                  task.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                                  'bg-gray-100 text-gray-800'}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex items-center text-sm text-gray-500">
                                            <p className="truncate text-xs">{task.description || 'No description'}</p>
                                        </div>
                                        <div className="mt-2 flex items-center text-xs text-gray-400 sm:mt-0">
                                            <p>{new Date(task.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex flex-col justify-center items-center h-full text-center p-6">
                            <Users className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                            <p className="text-sm text-gray-500">No tasks created yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
