const fs = require('fs');

// --- 1. Dashboard AbortController ---
let dashCode = fs.readFileSync('app-template/src/Dashboard.tsx', 'utf8');

const fetchBlock = \`  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity");\`;
const updatedFetchBlock = \`  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity", { signal: abortController.signal });\`;
dashCode = dashCode.replace(fetchBlock, updatedFetchBlock);

const syntheticBlock = \`        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
        setData(syntheticData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);\`;
const updatedSyntheticBlock = \`        if (abortController.signal.aborted) return;
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 800);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            resolve(null);
          });
        }); // Simulate delay

        if (abortController.signal.aborted) return;
        setData(syntheticData);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);\`;
dashCode = dashCode.replace(syntheticBlock, updatedSyntheticBlock);

// --- 2. Dashboard Memoize ---
if (dashCode.includes('ResponsiveContainer width="100%" height="100%">')) {
  dashCode = dashCode.replace('import React, { useState, useEffect, useMemo, useCallback } from "react";',
                              'import React, { useState, useEffect, useMemo, useCallback, memo } from "react";');

  const chartComponentCode = \`
const DashboardChart = memo(({ config, data, CustomTooltip }: { config: ChartConfig, data: ActivityData[], CustomTooltip: any }) => {
  return (
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
              tickFormatter={(value: number) => \\\`\\\${value}\\\`}
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
        ) : config.chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
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
              tickFormatter={(value: number) => \\\`\\\${value}\\\`}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar
              dataKey="activity"
              fill={config.strokeColor}
              radius={[4, 4, 0, 0]}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
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
              tickFormatter={(value: number) => \\\`\\\${value}\\\`}
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
  );
});
\`;

  const startIndex = dashCode.indexOf('<div className="h-[400px] w-full relative z-10">');
  const endIndex = dashCode.indexOf('</ResponsiveContainer>') + '</ResponsiveContainer>'.length + '\\n        </div>'.length;
  if (startIndex !== -1 && endIndex !== -1) {
    const origChartBlock = dashCode.substring(startIndex, endIndex);
    dashCode = dashCode.replace(origChartBlock, '<DashboardChart config={config} data={data} CustomTooltip={CustomTooltip} />');
  }
  const dashboardIndex = dashCode.indexOf('export function Dashboard() {');
  dashCode = dashCode.substring(0, dashboardIndex) + chartComponentCode + '\\n' + dashCode.substring(dashboardIndex);
  dashCode = dashCode.replace('tickFormatter={(value) => `${value}`}', 'tickFormatter={(value: number) => `${value}`}');
}

fs.writeFileSync('app-template/src/Dashboard.tsx', dashCode);

// --- 3. useLocalStorage Sync ---
const lsCode = \`import { useState, useCallback, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(\\\`Error reading localStorage key "\\\${key}":\\\`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      if (JSON.stringify(storedValue) === JSON.stringify(valueToStore)) return;

      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(\\\`Error setting localStorage key "\\\${key}":\\\`, error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          if (JSON.stringify(storedValue) !== JSON.stringify(newValue)) {
            setStoredValue(newValue);
          }
        } catch (error) {
          console.warn(\\\`Error parsing storage change for key "\\\${key}":\\\`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}
\`;
fs.writeFileSync('app-template/src/useLocalStorage.ts', lsCode);

// --- 4. index.html CSP ---
let indexCode = fs.readFileSync('app-template/index.html', 'utf8');
const headBlock = \`<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#111827" />\`;
const newHeadBlock = \`<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#111827" />
    <meta name="description" content="AgentCofounder Control Panel for monitoring and execution tracking of autonomous systems." />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;" />\`;
indexCode = indexCode.replace(headBlock, newHeadBlock);
const bodyBlock = \`<body>
    <div id="root"></div>\`;
const newBodyBlock = \`<body>
    <noscript>
      <div style="padding: 20px; text-align: center; font-family: sans-serif; background: #fee2e2; color: #991b1b;">
        <strong>JavaScript is disabled.</strong> Please enable JavaScript to run this application.
      </div>
    </noscript>
    <div id="root"></div>\`;
indexCode = indexCode.replace(bodyBlock, newBodyBlock);
fs.writeFileSync('app-template/index.html', indexCode);

// --- 5. Aria Attributes ---
let appCode = fs.readFileSync('app-template/src/App.tsx', 'utf8');
appCode = appCode.replace(/<Sun size=\\{16\\} \\/>/g, '<Sun size={16} aria-hidden="true" />');
appCode = appCode.replace(/<Monitor size=\\{16\\} \\/>/g, '<Monitor size={16} aria-hidden="true" />');
appCode = appCode.replace(/<Moon size=\\{16\\} \\/>/g, '<Moon size={16} aria-hidden="true" />');
appCode = appCode.replace(/<Menu size=\\{20\\} \\/>/g, '<Menu size={20} aria-hidden="true" />');
appCode = appCode.replace(/<Sun size=\\{18\\} \\/>/g, '<Sun size={18} aria-hidden="true" />');
appCode = appCode.replace(/<Monitor size=\\{18\\} \\/>/g, '<Monitor size={18} aria-hidden="true" />');
appCode = appCode.replace(/<Moon size=\\{18\\} \\/>/g, '<Moon size={18} aria-hidden="true" />');
fs.writeFileSync('app-template/src/App.tsx', appCode);

let dCode = fs.readFileSync('app-template/src/Dashboard.tsx', 'utf8');
dCode = dCode.replace(/<Icon size=\\{20\\} className="opacity-80" \\/>/g, '<Icon size={20} className="opacity-80" aria-hidden="true" />');
dCode = dCode.replace(/<ArrowUpRight size=\\{14\\} \\/>/g, '<ArrowUpRight size={14} aria-hidden="true" />');
dCode = dCode.replace(/<ArrowDownRight size=\\{14\\} \\/>/g, '<ArrowDownRight size={14} aria-hidden="true" />');
dCode = dCode.replace(/<X size=\\{18\\} \\/>/g, '<X size={18} aria-hidden="true" />');
dCode = dCode.replace(/<Settings size=\\{18\\} \\/>/g, '<Settings size={18} aria-hidden="true" />');
dCode = dCode.replace(/<Activity className="w-12 h-12 mb-4 opacity-50" \\/>/g, '<Activity className="w-12 h-12 mb-4 opacity-50" aria-hidden="true" />');
dCode = dCode.replace(/<Clock className="w-12 h-12 mb-4 opacity-30" \\/>/g, '<Clock className="w-12 h-12 mb-4 opacity-30" aria-hidden="true" />');
fs.writeFileSync('app-template/src/Dashboard.tsx', dCode);

let errorCode = fs.readFileSync('app-template/src/ErrorBoundary.tsx', 'utf8');
errorCode = errorCode.replace(/<AlertTriangle className="w-12 h-12 text-red-500 mb-4" \\/>/g, '<AlertTriangle className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />');
errorCode = errorCode.replace(/<RefreshCcw className="w-4 h-4" \\/>/g, '<RefreshCcw className="w-4 h-4" aria-hidden="true" />');
fs.writeFileSync('app-template/src/ErrorBoundary.tsx', errorCode);
