
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 pt-6 pb-6 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg shadow-blue-200">
            B
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">SeatManager</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] -mt-1">Buildots R&D HQ</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-500">
            <span className="text-emerald-500 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live 2026
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
