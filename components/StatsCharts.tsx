import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    AreaChart, Area, CartesianGrid 
} from 'recharts';
import { Attendance } from '../types';

interface Props {
    history: Attendance[];
}

const StatsCharts: React.FC<Props> = ({ history }) => {
    // Process data: Take last 14 days, sort ascending
    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];
        
        // Clone and sort descending by timestamp (API usually returns this but safe to ensure)
        // Then take slice
        const recent = [...history]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 14)
            .reverse(); // Make it ascending for chart

        return recent.map(item => ({
            date: item.date.split('-').slice(1).reverse().join('/'), // MM-DD -> DD/MM
            workHours: item.work_hours || 0,
            lateMinutes: item.late_minutes || 0,
            fullDate: item.date
        }));
    }, [history]);

    if (chartData.length < 2) return null;

    // Custom Tooltip for Work Hours
    const CustomTooltipWork = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {payload[0].value} giờ
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom Tooltip for Late Minutes
    const CustomTooltipLate = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
                    <p className="text-orange-500 dark:text-orange-400 font-extrabold">
                        Trễ {payload[0].value} phút
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-slide-up" style={{animationDelay: '0.2s'}}>
            
            {/* Work Hours Chart */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-chart-simple text-emerald-500"></i> Xu hướng công
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">14 ngày</span>
                </div>
                
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                                dy={10}
                                interval="preserveStartEnd"
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                            />
                            <Tooltip content={<CustomTooltipWork />} cursor={{ fill: 'transparent' }} />
                            <Bar 
                                dataKey="workHours" 
                                fill="#10b981" 
                                radius={[4, 4, 4, 4]} 
                                barSize={12}
                                activeBar={{ fill: '#059669' }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Late Minutes Chart (Only if there is late data) */}
            {chartData.some(d => d.lateMinutes > 0) && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-stopwatch text-orange-500"></i> Biểu đồ đi trễ
                        </h4>
                    </div>
                    
                    <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                                    dy={10}
                                    interval="preserveStartEnd"
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                />
                                <Tooltip content={<CustomTooltipLate />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="lateMinutes" 
                                    stroke="#f97316" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorLate)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsCharts;