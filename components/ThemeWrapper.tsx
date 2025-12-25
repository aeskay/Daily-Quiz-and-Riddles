
import React from 'react';

interface ThemeWrapperProps {
  styleHint: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children, onClick }) => {
  // Always white background as requested
  return (
    <div 
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 shadow-sm hover:shadow-xl group"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </div>
  );
};

export default ThemeWrapper;
