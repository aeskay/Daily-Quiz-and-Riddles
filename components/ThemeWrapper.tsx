import React from 'react';

interface ThemeWrapperProps {
  styleHint: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children, onClick, styleHint }) => {
  return (
    <div 
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 shadow-sm hover:shadow-xl group"
      data-style-hint={styleHint}
    >
      {children}
    </div>
  );
};

export default ThemeWrapper;