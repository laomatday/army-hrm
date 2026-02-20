
import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

const Spinner: React.FC<Props> = ({ size = 'md', color = 'border-t-emerald-600', className = '' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
    xl: 'h-16 w-16 border-4',
  };

  return (
    <div className={`animate-spin rounded-full border-slate-200 ${sizeClasses[size]} ${color} ${className}`}></div>
  );
};

export default Spinner;
