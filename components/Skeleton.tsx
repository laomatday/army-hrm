
import React from 'react';

const SkeletonItem = ({ className }: { className: string }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 animate-pulse ${className}`}></div>
);

export const DashboardSkeleton = () => {
  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-hidden font-sans">
      
      {/* Header Skeleton */}
      <div className="pt-safe pt-2 px-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
               <SkeletonItem className="w-12 h-12 rounded-full" />
               <SkeletonItem className="w-24 h-6 rounded-lg" />
          </div>
          <SkeletonItem className="w-10 h-10 rounded-full" />
      </div>

      <div className="flex-1 px-4 pt-10 flex flex-col items-center">
          
          {/* Clock Area */}
          <div className="flex flex-col items-center mb-8 w-full">
              <SkeletonItem className="w-48 h-20 mb-2 rounded-2xl" /> {/* Time */}
              <SkeletonItem className="w-32 h-4 mb-6 rounded-md" /> {/* Date */}
              <SkeletonItem className="w-40 h-10 rounded-full" /> {/* Status Pill */}
          </div>

          {/* Main Button */}
          <div className="mb-10">
              <SkeletonItem className="w-44 h-44 rounded-full shadow-sm" />
          </div>

          {/* Stats Grid */}
          <div className="w-full grid grid-cols-2 gap-3 mb-8">
              <SkeletonItem className="h-28 rounded-[24px]" />
              <SkeletonItem className="h-28 rounded-[24px]" />
              <SkeletonItem className="h-28 rounded-[24px]" />
              <SkeletonItem className="h-28 rounded-[24px]" />
          </div>
      </div>

      {/* Bottom Nav Skeleton */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-between px-2 py-2 border border-slate-100 dark:border-slate-700 gap-1.5 w-[300px] h-[64px]">
             <SkeletonItem className="w-12 h-12 rounded-full" />
             <SkeletonItem className="w-12 h-12 rounded-full" />
             <SkeletonItem className="w-12 h-12 rounded-full" />
             <SkeletonItem className="w-12 h-12 rounded-full" />
             <SkeletonItem className="w-12 h-12 rounded-full" />
          </div>
      </div>
    </div>
  );
};
