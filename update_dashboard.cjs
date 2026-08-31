const fs = require('fs');
let code = fs.readFileSync('app-template/src/Dashboard.tsx', 'utf8');

// Add Bar chart support
code = code.replace(
    /import \{ LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart \} from "recharts";/,
    'import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from "recharts";'
);

code = code.replace(
    /chartType: "line" \| "area";/,
    'chartType: "line" | "area" | "bar";'
);

code = code.replace(
    /<button\n                     onClick=\{\(\) => setConfig\(\{...config, chartType: 'area'\}\)\}\n                     className=\{`flex-1 text-xs py-1 rounded-md transition-colors \$\{config.chartType === 'area' \? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'\}\`\}\n                   >\n                     Area\n                   <\/button>/,
    '<button\n                     onClick={() => setConfig({...config, chartType: \'area\'})}\n                     className={`flex-1 text-xs py-1 rounded-md transition-colors ${config.chartType === \'area\' ? \'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-medium\' : \'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200\'}`}\n                   >\n                     Area\n                   </button>\n                   <button\n                     onClick={() => setConfig({...config, chartType: \'bar\'})}\n                     className={`flex-1 text-xs py-1 rounded-md transition-colors ${config.chartType === \'bar\' ? \'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-medium\' : \'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200\'}`}\n                   >\n                     Bar\n                   </button>'
);

let chartSection = `            {config.chartType === 'area' ? (
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
                  tickFormatter={(value) => \`\${value}\`}
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
                  tickFormatter={(value) => \`\${value}\`}
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
            ) : (`;

code = code.replace(
    /            \{config\.chartType === 'area' \? \([\s\S]*?              <\/AreaChart>\n            \) : \(/,
    chartSection
);

fs.writeFileSync('app-template/src/Dashboard.tsx', code);
