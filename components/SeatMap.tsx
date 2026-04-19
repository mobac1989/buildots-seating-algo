
import React, { useState, useRef } from 'react';
import { MapCell, AttendanceRecord, UserType } from '../types';
import Tooltip from './Tooltip';
import { Grip, Lock, MousePointer2, User, MapPin, CheckCircle2, Check, Sparkles, UserCheck, Clock } from 'lucide-react';

interface SeatMapProps {
  selectedDate: string;
  attendance: AttendanceRecord[];
  onSeatClick?: (cell: MapCell) => void;
  currentUser?: { name: string } | null;
  canBook: boolean;
  cells: MapCell[];
}

const GRID_SIZE = 40; 

const SeatMap: React.FC<SeatMapProps> = ({ selectedDate, attendance, onSeatClick, currentUser, canBook, cells }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const getAttendanceForSeat = (seatId: string) => {
    return attendance.find(a => a.seatId === seatId && a.date === selectedDate);
  };

  const canvasMeta = cells.find(c => c.type === 'meta');
  const maxCol = canvasMeta?.w || 40;
  const maxRow = canvasMeta?.h || 60;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      setIsDragging(true);
      setStartX(e.pageX - containerRef.current.offsetLeft);
      setStartY(e.pageY - containerRef.current.offsetTop);
      setScrollLeft(containerRef.current.scrollLeft);
      setScrollTop(containerRef.current.scrollTop);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div className="relative w-full h-full bg-[#F0F2F5] overflow-hidden group" dir="ltr">


      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={() => setIsDragging(false)}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        className={`w-full h-full overflow-auto cursor-${isDragging ? 'grabbing' : 'grab'} select-none p-16 custom-scrollbar flex items-start justify-center`}
      >
        <div 
          className="relative bg-white border border-slate-200 shadow-2xl rounded-[1rem]"
          style={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${maxCol}, ${GRID_SIZE}px)`,
            gridTemplateRows: `repeat(${maxRow}, ${GRID_SIZE}px)`,
            width: `${maxCol * GRID_SIZE}px`,
            height: `${maxRow * GRID_SIZE}px`,
            backgroundImage: 'radial-gradient(#e2e8f0 0.8px, transparent 0)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            backgroundPosition: '0.4px 0.4px'
          }}
        >
          {cells.filter(c => c.type !== 'meta').map(cell => {
            const isSeat = cell.type === 'seat';
            const record = isSeat ? getAttendanceForSeat(cell.id) : null;
            const isTaken = !!record;
            const isMine = currentUser && (record?.userName === currentUser.name || record?.userId === 'current_user_temp');
            const isTemp = record?.userId === 'current_user_temp';
            
            const isClickable = !isSeat ? false : (currentUser === null ? true : (!isTaken || isMine));

            const cellStyle: React.CSSProperties = {
              gridColumn: `${cell.x} / span ${cell.w}`,
              gridRow: `${cell.y} / span ${cell.h}`,
              backgroundColor: isTaken ? (isMine ? '#2563eb' : '#fb7185') : cell.fill,
              border: isTemp ? '2px dashed rgba(255,255,255,0.6)' : '0.5px solid rgba(0,0,0,0.03)',
              zIndex: cell.type === 'zone' ? (isSeat ? 10 : 1) : 10,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            };

            const ownerName = cell.label2 || 'ללא בעלים';

            return (
              <div 
                key={cell.id} 
                style={cellStyle} 
                className={`flex items-stretch justify-stretch group/seat ${
                  isMine ? 'ring-2 ring-blue-500 ring-inset z-30' : ''
                } ${isSeat && isClickable ? 'hover:z-50 cursor-pointer' : ''} ${
                  isTemp ? 'animate-pulse' : ''
                }`}
              >
                {isSeat ? (
                  <Tooltip content={
                    <div className="flex flex-col text-right px-3 py-3" dir="rtl">
                      {/* Status Header */}
                      <div className="flex items-center gap-2 mb-2">
                        {isMine ? (
                          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ring-1 ring-blue-100">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[11px] font-black">{isTemp ? 'שוריין עבורך' : 'המושב שלך'}</span>
                          </div>
                        ) : isTaken ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full ring-1 ring-rose-100">
                            <Lock className="w-3 h-3" />
                            <span className="text-[11px] font-black">תפוס</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full ring-1 ring-emerald-100">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-[11px] font-black">פנוי</span>
                          </div>
                        )}
                      </div>

                      {/* Details Area */}
                      <div className="flex flex-col gap-0.5 px-0.5">
                      <span className="text-sm font-black text-slate-800 leading-tight">עמדה {cell.label1}</span>

                      <span className="text-[9px] text-slate-400 font-bold">
                      {cell.monitorsCount === 2 ? 'שני מסכים' : 'מסך אחד'}
                      </span>

                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                      <User className="w-2.5 h-2.5" />
                      <span className="truncate max-w-[100px]">{ownerName}</span>
                    </div>
                    </div>

                      {/* CTA Section */}
                      {!isTaken && canBook && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-2 text-blue-600">
                            <MousePointer2 className="w-3.5 h-3.5 animate-bounce" />
                            <span className="text-[11px] font-black text-blue-600">שריין עמדה</span>
                          </div>
                        </div>
                      )}

                      {isTaken && (
                        <div className="mt-2 text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg flex items-center gap-1.5">
                          <UserCheck className="w-2.5 h-2.5 text-slate-400" />
                          <span>יושב/ת: {record.userName.split(' ')[0]} {record.isOriginalOwner ? '(קבוע)' : '(שוריין)'}</span>
                        </div>
                      )}
                    </div>
                  }>
                    <button
                      onClick={() => isClickable && canBook && onSeatClick?.(cell)}
                      disabled={!canBook || !isClickable}
                      className={`w-full h-full flex flex-col items-center justify-center text-[10px] font-black transition-all duration-300 ${
                        isClickable ? 'group-hover/seat:brightness-90 group-hover/seat:saturate-150 group-hover/seat:ring-2 group-hover/seat:ring-black/10 group-hover/seat:ring-inset' : 'cursor-default'
                      } ${
                        isTaken ? 'text-white' : 'text-slate-800'
                      } ${isClickable && canBook ? 'active:scale-90' : ''}`}
                    >
                      <span className={`leading-none drop-shadow-sm transition-all duration-300 ${isClickable ? 'group-hover/seat:scale-[1.8] group-hover/seat:font-black group-hover/seat:drop-shadow-md' : ''}`}>
                        {cell.label1}
                      </span>
                      {isTaken && (
                         isMine ? (isTemp ? <Clock className="w-3 h-3 mt-0.5 text-white/80" /> : <Check className="w-3 h-3 mt-0.5 text-white opacity-90 stroke-[3px]" />) : <Lock className="w-2.5 h-2.5 opacity-60 mt-0.5" />
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-0.5 text-center overflow-hidden">
                    <span className={`font-black text-slate-600/60 uppercase tracking-tighter leading-none pointer-events-none select-none ${
                      cell.label1.length > 5 ? 'text-[6px]' : 'text-[8px]'
                    }`}>
                      {cell.label1}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SeatMap;
