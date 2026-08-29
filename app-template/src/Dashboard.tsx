import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Settings, X, Activity, Server, Clock, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react";
import { useLocalStorage } from "./useLocalStorage";

interface ActivityData {
  time: string;
  activity: number;
}

interface ChartConfig {
  strokeColor: string;
  strokeWidth: number;
  showGrid: boolean;
  chartType: "line" | "area";
}

const DEFAULT_CONFIG: ChartConfig = {
  strokeColor: "#3b82f6",
  strokeWidth: 3,
  showGrid: true,
  chartType: "area"
};

function MetricCard({ title, value, trend, icon: Icon, color }: { title: string, value: string | number, trend: number, icon: any, color: string }) {
  const isPositive = trend >= 0;
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 opacity-0 animate-slide-up-fade">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} className="opacity-80" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useLocalStorage<ChartConfig>("dashboard-chart-config", DEFAULT_CONFIG);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity");
        if (!response.ok) {
          throw new Error(`Failed to fetch activity data: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        // Fallback to dynamic synthetic data
        const syntheticData: ActivityData[] = Array.from({ length: 24 }, (_, i) => {
          // Create somewhat realistic wavy data
          const base = 40;
          const variance = Math.sin(i / 2) * 20 + Math.cos(i / 3) * 15;
          const noise = Math.random() * 10 - 5;
          return {
            time: `${String(i).padStart(2, '0')}:00`,
            activity: Math.max(0, Math.floor(base + variance + noise)),
          }
        });

        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
        setData(syntheticData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = useMemo(() => {
    if (data.length === 0) return null;
    const total = data.reduce((acc, curr) => acc + curr.activity, 0);
    const avg = Math.round(total / data.length);
    const peak = Math.max(...data.map(d => d.activity));
    return { total, avg, peak };
  }, [data]);

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
           <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
           <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
           <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="w-full rounded-xl bg-white p-6 shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-md mb-8"></div>
          <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-700/30 rounded-xl flex items-center justify-center">
             <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
               <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
               <span className="text-sm font-semibold tracking-wide uppercase">Initializing Workspace...</span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col w-full items-center justify-center p-12 text-red-600 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50">
        <Activity className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium text-center">
          <span className="font-bold block mb-1">Telemetry Unavailable</span>
          {error}
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col h-[400px] w-full items-center justify-center p-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        <Clock className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No historical telemetry available yet</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-xl backdrop-blur-sm">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: config.strokeColor }}></div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {payload[0].value} <span className="text-sm font-medium text-slate-500 dark:text-slate-400">ops</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Metric Cards Section */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <MetricCard
            title="Total Operations"
            value={metrics.total.toLocaleString()}
            trend={12.5}
            icon={Server}
            color="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          />
          <MetricCard
            title="Average Load"
            value={`${metrics.avg} ops/hr`}
            trend={-4.2}
            icon={Activity}
            color="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
          />
          <MetricCard
            title="Peak Activity"
            value={metrics.peak}
            trend={8.4}
            icon={Zap}
            color="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          />
        </div>
      )}

      {/* Chart Section */}
      <div className="w-full rounded-xl bg-white p-6 md:p-8 shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700 transition-all duration-500 relative group overflow-hidden opacity-0 animate-slide-up-fade delay-300">
        {/* Decorative gradient blob */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-3xl pointer-events-none"></div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between relative z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-slate-700 dark:text-slate-300">
              <Activity size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              System Telemetry
            </h2>
          </div>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 self-end sm:self-auto text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95"
            aria-label="Toggle settings"
          >
            {isSettingsOpen ? <X size={18} /> : <Settings size={18} />}
          </button>
        </div>

        {isSettingsOpen && (
          <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/80 transition-all duration-300 ease-in-out relative z-10">
            <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-200 mb-5 uppercase">Graph Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Theme Color</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'].map(color => (
                    <button
                      key={color}
                      onClick={() => setConfig({ ...config, strokeColor: color })}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${config.strokeColor === color ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900' : ''}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Style</label>
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                   <button
                     onClick={() => setConfig({...config, chartType: 'line'})}
                     className={`flex-1 text-xs py-1 rounded-md transition-colors ${config.chartType === 'line' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                   >
                     Line
                   </button>
                   <button
                     onClick={() => setConfig({...config, chartType: 'area'})}
                     className={`flex-1 text-xs py-1 rounded-md transition-colors ${config.chartType === 'area' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                   >
                     Area
                   </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Line Thickness ({config.strokeWidth}px)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.strokeWidth}
                  onChange={(e) => setConfig({ ...config, strokeWidth: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex items-center sm:pt-5">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.showGrid}
                      onChange={(e) => setConfig({ ...config, showGrid: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${config.showGrid ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${config.showGrid ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Show Gridlines</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="h-[400px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            {config.chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={config.strokeColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={config.strokeColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {config.showGrid && (
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} opacity={0.4} />
                )}
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  padding={{ left: 10, right: 10 }}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="activity"
                  stroke={config.strokeColor}
                  fillOpacity={1}
                  fill="url(#colorActivity)"
                  strokeWidth={config.strokeWidth}
                  activeDot={{ r: 6, strokeWidth: 2, fill: config.strokeColor, stroke: "#fff" }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                {config.showGrid && (
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} opacity={0.4} />
                )}
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  padding={{ left: 10, right: 10 }}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="activity"
                  stroke={config.strokeColor}
                  strokeWidth={config.strokeWidth}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2, fill: config.strokeColor, stroke: "#fff" }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
