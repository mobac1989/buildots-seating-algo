
import React, { useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div 
          className="absolute bottom-full mb-3 z-[9999] pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          <div className="bg-white border border-slate-200 shadow-[0_12px_45px_-10px_rgba(0,0,0,0.18)] rounded-2xl overflow-hidden min-w-[150px]">
            {content}
          </div>
          {/* Subtle triangle arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[5px] border-transparent border-t-white drop-shadow-sm"></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
