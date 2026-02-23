import React from 'react';

export const DashboardSkeleton = () => {
  return (
    <div className="h-full w-full bg-slate-50 dark:bg-neutral-black flex flex-col relative overflow-hidden transition-colors">
        {/* HEADER SKELETON */}
        <div className="h-16 px-4 flex items-center justify-between mt-2 pt-safe">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
        </div>

        {/* CONTENT SKELETON */}
        <div className="flex-1 px-4 pt-10 pb-32 flex flex-col items-center">
            
            {/* CLOCK AREA */}
            <div className="flex flex-col items-center mb-8 w-full">
                <div className="h-20 w-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse mb-3"></div>
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse mb-6"></div>
                <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
            </div>

            {/* ACTION BUTTON */}
            <div className="mb-10">
                <div className="w-44 h-44 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse ring-4 ring-white dark:ring-neutral-black"></div>
            </div>

            {/* STATS HEADER */}
            <div className="w-full flex justify-between items-center mb-3 px-1">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
            </div>

            {/* STATS GRID */}
            <div className="w-full grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-[24px] animate-pulse"></div>
                ))}
            </div>
        </div>

        {/* BOTTOM NAV SKELETON */}
        <div className="fixed bottom-6 left-4 right-4 h-[72px] bg-white/50 dark:bg-neutral-black/50 backdrop-blur-xl rounded-[24px] flex justify-around items-center px-2">
             {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-700/50 animate-pulse"></div>
             ))}
        </div>
    </div>
  );
};