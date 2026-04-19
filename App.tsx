
import React, { useState, useEffect, useMemo } from 'react';
import { UserType, UserPreferences, MapCell, AttendanceRecord } from './types';
import { MAP_DATA } from './constants';
import { 
  getNextWeekRange, 
  getCurrentWeekRange,
  isNextWeekLocked, 
  isCurrentWeekActive,
  isDateInPast,
  getIsraelTime,
  formatDayMonth
} from './utils/dateHelpers';
import SeatMap from './components/SeatMap';
import { db } from './firebaseConfig';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Sparkles,
  Check,
  Search,
  X,
  Smile,
  User,
  ArrowRight as ArrowRightIcon,
  ChevronLeft,
  MapPin,
  ShieldCheck,
  Move,
  AlertTriangle,
  Zap,
  Lock,
  AlertCircle,
  Settings,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  ArrowLeft,
  AlertOctagon,
  UserPlus,
  UserMinus
} from 'lucide-react';

type FlowStep = 'landing' | 'identity' | 'report' | 'catcher_id' | 'catcher_map' | 'current_week_map' | 'admin_dashboard';

interface ConflictPrompt {
  ownerName: string;
  occupantName: string;
  date: string;
  seatId: string;
  prefKey: string;
}

interface BookingConflict {
  date: string;
  dayName: string;
  seatLabel: string;
}

const App: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(getIsraelTime());
  const [step, setStep] = useState<FlowStep>('landing');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; type: UserType; seatId?: string; selectedDays?: string[] } | null>(null);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);

  const [showPassModal, setShowPassModal] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);

  const [identitySearchQuery, setIdentitySearchQuery] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [catcherNameInput, setCatcherNameInput] = useState('');
  const [catcherSelectedDays, setCatcherSelectedDays] = useState<string[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingSeat, setBookingSeat] = useState<MapCell | null>(null);
  const [allPrefs, setAllPrefs] = useState<{ [key: string]: UserPreferences }>({});
  
  const [stagedPref, setStagedPref] = useState<UserPreferences | null>(null);
  const [initialStagedPrefJson, setInitialStagedPrefJson] = useState<string>('');

  const [tempBookings, setTempBookings] = useState<{ [date: string]: string }>({});

  const [adminWeekMode, setAdminWeekMode] = useState<'current' | 'next'>('next');
  const [quickBookName, setQuickBookName] = useState('');

  const [relocatingUser, setRelocatingUser] = useState<{ 
    name: string; 
    date: string; 
    currentSeatId: string;
    triggeredBy: string; 
    prefKey: string;
  } | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<ConflictPrompt | null>(null);
  const [adminErrorMessage, setAdminErrorMessage] = useState<string | null>(null);
  const [adminQuickBookSeat, setAdminQuickBookSeat] = useState<MapCell | null>(null);
  const [adminQuickBookName, setAdminQuickBookName] = useState('');
  const [adminFreeSeat, setAdminFreeSeat] = useState<MapCell | null>(null);

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

  const isLocked = useMemo(() => isNextWeekLocked(currentTime), [currentTime]);
  const isCurrentActive = useMemo(() => isCurrentWeekActive(currentTime), [currentTime]);
  
  const nextWeekDates = useMemo(() => getNextWeekRange(currentTime), [currentTime]);
  const currentWeekDates = useMemo(() => getCurrentWeekRange(currentTime), [currentTime]);
  
  const activeWeekDateRange = useMemo(() => {
    if (step === 'current_week_map') return currentWeekDates;
    if (step === 'admin_dashboard' && adminWeekMode === 'current') return currentWeekDates;
    return nextWeekDates;
  }, [step, adminWeekMode, currentWeekDates, nextWeekDates]);

  const currentSelectedDayName = useMemo(() => {
    if (!selectedDate) return '';
    const idx = activeWeekDateRange.indexOf(selectedDate);
    return idx !== -1 ? dayNames[idx] : '';
  }, [selectedDate, activeWeekDateRange, dayNames]);

  const isReportDirty = useMemo(() => {
    if (!stagedPref || !initialStagedPrefJson) return false;
    return JSON.stringify(stagedPref) !== initialStagedPrefJson;
  }, [stagedPref, initialStagedPrefJson]);

  // Real-time synchronization with Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'preferences'), (snapshot) => {
      const prefs: { [key: string]: UserPreferences } = {};
      snapshot.forEach((doc) => {
        prefs[doc.id] = doc.data() as UserPreferences;
      });
      setAllPrefs(prefs);
    }, (error) => {
      console.error("Firebase Snapshot Error:", error);
    });

    const timer = setInterval(() => setCurrentTime(getIsraelTime()), 10000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if ((step === 'catcher_map' || step === 'current_week_map' || step === 'admin_dashboard') && !selectedDate) {
      if (step === 'current_week_map' || (step === 'admin_dashboard' && adminWeekMode === 'current')) {
        const todayStr = currentWeekDates.find(d => !isDateInPast(d, currentTime));
        setSelectedDate(todayStr || currentWeekDates[0]);
      } else {
        if (currentUser?.selectedDays && currentUser.selectedDays.length > 0) {
          const firstDay = nextWeekDates.find(date => currentUser.selectedDays?.includes(date));
          setSelectedDate(firstDay || nextWeekDates[0]);
        } else {
          setSelectedDate(nextWeekDates[0]);
        }
      }
    }
  }, [step, nextWeekDates, currentWeekDates, selectedDate, currentUser, currentTime, adminWeekMode]);

  const saveSinglePref = async (key: string, pref: UserPreferences) => {
    try {
      await setDoc(doc(db, 'preferences', key), pref);
      return true;
    } catch (e) {
      console.error("Error saving pref:", e);
      return false;
    }
  };

  const handleAdminAuth = () => {
    if (passInput === 'meitar') {
      setIsAdmin(true);
      setStep('admin_dashboard');
      setAdminWeekMode('next');
      setShowPassModal(false);
      setPassInput('');
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const currentAttendance: AttendanceRecord[] = useMemo(() => {
    if (!selectedDate) return [];
    const activeDate: string = selectedDate;
    const records: AttendanceRecord[] = [];
    
    const dateObj = new Date(activeDate);
    const dayIdx = dateObj.getDay();

    MAP_DATA.filter(c => c.type === 'seat').forEach(seat => {
      const ownerName = seat.label2;
      const pref: UserPreferences | null = ownerName ? (allPrefs[ownerName] || null) : null;

      let isComing = false;
      let userName = "";
      let userType = UserType.OWNER;
      let isOriginal = false;
      let prefKey = ownerName || "";

      if (tempBookings[activeDate] === seat.id && currentUser) {
        userName = currentUser.name;
        userType = UserType.CATCHER;
        isOriginal = false;
        isComing = true;
        prefKey = 'current_user_temp';
      } 
      else {
        const bookingEntry = (Object.entries(allPrefs) as [string, UserPreferences][]).find(([_, p]) => p.bookings && p.bookings[activeDate] === seat.id);
        
        if (bookingEntry) {
          const [key, p] = bookingEntry as [string, UserPreferences];
          userName = p.name;
          userType = UserType.CATCHER;
          isOriginal = false;
          isComing = true;
          prefKey = key;
        } 
        else if (ownerName && pref) {
          const p = pref as UserPreferences;
          if (p.nextWeekOverrides && p.nextWeekOverrides[activeDate] === true) {
            isComing = true;
          } else if (p.fixedDays && p.fixedDays.includes(dayIdx) && p.nextWeekOverrides?.[activeDate] !== false) {
            isComing = true;
          }

          if (isComing) {
            userName = ownerName;
            userType = UserType.OWNER;
            isOriginal = true;
            prefKey = ownerName;
          }
        }
      }

      if (isComing) {
        records.push({ 
          seatId: seat.id, 
          date: activeDate, 
          userId: prefKey,
          userName, 
          userType, 
          isOriginalOwner: isOriginal 
        });
      }
    });

    return records;
  }, [allPrefs, selectedDate, tempBookings, currentUser]);

  const handleAdminRelocation = async (cell: MapCell) => {
    if (!relocatingUser || !selectedDate) return;
    const isTaken = currentAttendance.some(r => r.seatId === cell.id);
    if (isTaken) {
      setAdminErrorMessage("המושב תפוס! בחר מושב ירוק פנוי.");
      return;
    }
    
    const u = relocatingUser;
    setRelocatingUser(null);
    setAdminErrorMessage(null);

    const pref = { ...(allPrefs[u.prefKey] || { name: u.name, fixedDays: [], nextWeekOverrides: {}, bookings: {} }) };
    pref.bookings[selectedDate] = cell.id;
    await saveSinglePref(u.prefKey, pref);
    
    if (u.triggeredBy) {
      const ownerPref = { ...(allPrefs[u.triggeredBy] || { name: u.triggeredBy, fixedDays: [], nextWeekOverrides: {}, bookings: {} }) };
      ownerPref.nextWeekOverrides[selectedDate] = true;
      await saveSinglePref(u.triggeredBy, ownerPref);
    }
  };

  const cancelRelocation = () => {
    setRelocatingUser(null);
    setAdminErrorMessage(null);
  };

  const handleAdminQuickBook = async () => {
    if (!adminQuickBookSeat || !selectedDate || !adminQuickBookName.trim()) return;
    const name = adminQuickBookName.trim();
    const seatId = adminQuickBookSeat.id;
    const date = selectedDate;
    
    setAdminQuickBookSeat(null);
    setAdminQuickBookName('');

    const uniqueKey = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newPref = { 
      name: name, 
      fixedDays: [], 
      nextWeekOverrides: {}, 
      bookings: { [date]: seatId } 
    };
    await saveSinglePref(uniqueKey, newPref);
  };

  const handleInstantQuickBook = async () => {
    if (!bookingSeat || !selectedDate || !quickBookName.trim()) return;
    const name = quickBookName.trim();
    const seatId = bookingSeat.id;
    const date = selectedDate;

    setBookingSeat(null);
    setQuickBookName('');
    setShowSuccess(true);
    
    const uniqueKey = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newPref = { 
      name: name, 
      fixedDays: [], 
      nextWeekOverrides: {}, 
      bookings: { [date]: seatId } 
    };
    
    // Non-blocking save to ensure perceived performance
    saveSinglePref(uniqueKey, newPref);

    setTimeout(() => {
        setShowSuccess(false);
        // We stay in current_week_map as requested by the user
    }, 1500);
  };

  const handleFreeSeat = async () => {
    if (!adminFreeSeat || !selectedDate) return;
    const record = currentAttendance.find(a => a.seatId === adminFreeSeat.id);
    const date = selectedDate;
    const seatId = adminFreeSeat.id;

    setAdminFreeSeat(null);

    if (!record) return;
    
    const prefKey = record.userId;
    const pref = { ...allPrefs[prefKey] };

    if (record.isOriginalOwner) {
      pref.nextWeekOverrides[date] = false;
      await saveSinglePref(prefKey, pref);
    } else {
      if (pref && pref.bookings[date] === seatId) {
        delete pref.bookings[date];
        if (Object.keys(pref.bookings).length === 0 && prefKey.startsWith('booking_')) {
          try {
            await deleteDoc(doc(db, 'preferences', prefKey));
          } catch(e) { console.error(e); }
        } else {
          await saveSinglePref(prefKey, pref);
        }
      }
    }
  };

  const adminToggleUserAttendance = async (userName: string, date: string) => {
    if (relocatingUser) return;
    const pref = { ...(allPrefs[userName] || { name: userName, fixedDays: [], nextWeekOverrides: {}, bookings: {} }) };
    
    const isCurrentlyAttending = currentAttendance.some(a => a.userName === userName && a.isOriginalOwner);
    const becomingComing = !isCurrentlyAttending;
    const seat = MAP_DATA.find(s => s.label2 === userName);
    
    if (becomingComing) {
      const occupant = seat ? currentAttendance.find(a => a.seatId === seat.id) : null;
      if (seat && occupant && occupant.userName !== userName) {
        setConflictPrompt({ 
          ownerName: userName, 
          occupantName: occupant.userName, 
          date, 
          seatId: seat.id,
          prefKey: occupant.userId
        });
        return;
      }
      pref.nextWeekOverrides[date] = true;
    } else {
      pref.nextWeekOverrides[date] = false;
    }

    await saveSinglePref(userName, pref);
  };

  const stageBooking = () => {
    if (!bookingSeat || !selectedDate || !currentUser) return;
    setTempBookings(prev => ({
      ...prev,
      [selectedDate]: bookingSeat.id
    }));
    setBookingSeat(null);
  };

  const handleCatcherFinished = () => {
    if (!currentUser) return;
    const foundConflicts: BookingConflict[] = [];

    (Object.entries(tempBookings) as [string, string][]).forEach(([date, seatId]) => {
      const isTakenByOther = (Object.entries(allPrefs) as [string, UserPreferences][]).some(([name, otherPref]) => {
        if (name === currentUser.name) return false;
        if (otherPref.bookings[date] === seatId) return true;
        
        const seat = MAP_DATA.find(s => s.id === seatId);
        if (seat && seat.label2 === name) {
          const dayIdx = new Date(date).getDay();
          const override = otherPref.nextWeekOverrides[date];
          if (override === true) return true;
          if (override === undefined && otherPref.fixedDays.includes(dayIdx)) return true;
        }
        return false;
      });

      if (isTakenByOther) {
        const seat = MAP_DATA.find(s => s.id === seatId);
        const dayIdx = activeWeekDateRange.indexOf(date);
        foundConflicts.push({
          date,
          dayName: dayNames[dayIdx],
          seatLabel: seat?.label1 || seatId
        });
      }
    });

    if (foundConflicts.length > 0) {
      const newTemp = { ...tempBookings };
      foundConflicts.forEach(c => delete newTemp[c.date]);
      setTempBookings(newTemp);
      setConflicts(foundConflicts);
    } else {
      setShowSummary(true);
    }
  };

  const handleCatcherFinalize = async () => {
    if (!currentUser) return;
    const key = currentUser.name;
    const bookings = { ...tempBookings };

    setTempBookings({});
    setShowSummary(false);
    setShowSuccess(true);
    
    // Persistent save to Firebase in background
    const pref = { ...(allPrefs[key] || { name: key, fixedDays: [], nextWeekOverrides: {}, bookings: {} }) };
    pref.bookings = { ...pref.bookings, ...bookings };
    saveSinglePref(key, pref);

    setTimeout(() => {
      setShowSuccess(false);
      setStep('landing');
      setCurrentUser(null);
      setSelectedDate(null);
      setTempBookings({});
    }, 1800);
  };

  const forceLandingReset = () => {
      setStep('landing');
      setTempBookings({});
      setSelectedDate(null);
      setStagedPref(null);
      setInitialStagedPrefJson('');
      setCurrentUser(null);
      setShowExitWarning(false);
      setShowSuccess(false);
      setShowAdvanced(false);
  };

  const handleExitRequest = () => {
    const isMappingStep = ['catcher_map', 'current_week_map'].includes(step);
    const hasUnsavedBookings = Object.keys(tempBookings).length > 0;

    if (isMappingStep && hasUnsavedBookings) {
      setShowExitWarning(true);
    } else {
      forceLandingReset();
    }
  };

  const handleReportFinalize = async () => {
    if (!currentUser || !stagedPref) return;
    
    setShowSuccess(true);
    
    // Persistent save to Firebase in background
    saveSinglePref(currentUser.name, stagedPref);
      
    setTimeout(() => {
        forceLandingReset();
    }, 1600);
  };

  const filteredIdentityOwners = useMemo(() => {
    return MAP_DATA
      .filter(c => c.type === 'seat' && c.label2)
      .filter(c => c.label2!.toLowerCase().includes(identitySearchQuery.toLowerCase()))
      .sort((a, b) => parseInt(a.label1) - parseInt(b.label1));
  }, [identitySearchQuery]);

  const filteredAdminOwners = useMemo(() => {
    return MAP_DATA
      .filter(c => c.type === 'seat' && c.label2)
      .filter(c => c.label2!.toLowerCase().includes(adminSearchQuery.toLowerCase()))
      .sort((a, b) => parseInt(a.label1) - parseInt(b.label1));
  }, [adminSearchQuery]);

  const userSummaryBookings = useMemo(() => {
    if (!currentUser) return [];
    return activeWeekDateRange.map((date, idx) => {
      const seatId = tempBookings[date];
      if (!seatId) return null;
      const seat = MAP_DATA.find(s => s.id === seatId);
      return {
        date,
        dayName: dayNames[idx],
        seatId,
        seatLabel: seat?.label1 || seatId,
        originalOwner: seat?.label2 || 'ללא בעלים'
      };
    }).filter(b => b !== null);
  }, [tempBookings, currentUser, activeWeekDateRange, dayNames]);

  const getSelectedDaysText = (userName: string) => {
    const pref = allPrefs[userName];
    if (!pref) return "אף יום";
    
    const selectedIndices: number[] = [];
    nextWeekDates.forEach((date, idx) => {
      const dayOfWeek = new Date(date).getDay();
      let isComing = false;
      const override = pref.nextWeekOverrides[date];
      if (override !== undefined) isComing = override;
      else isComing = pref.fixedDays.includes(dayOfWeek);
      if (isComing) selectedIndices.push(idx);
    });

    if (selectedIndices.length === 0) return "אף יום";
    const names = selectedIndices.map(idx => dayNames[idx]);
    if (names.length === 1) return `ביום ${names[0]}`;
    const last = names.pop();
    return `בימים ${names.join(', ')} ו-${last}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden" dir="rtl">
      {step === 'landing' && (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
          <div className="max-w-4xl w-full bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[500px] animate-in fade-in duration-500 relative">
            <div className="md:w-5/12 bg-blue-600 p-12 text-white flex flex-col justify-center">
              <Sparkles className="w-10 h-10 mb-8" />
              <h1 className="text-4xl font-black mb-4 leading-tight">ניהול מושבים Buildots</h1>
              <p className="text-blue-100 text-lg opacity-90 text-right">סנכרון חכם של עמדות עבודה.</p>
            </div>
            
            <div className="md:w-7/12 p-12 flex flex-col">
              <div className="flex flex-col gap-5 mt-4">
                <button 
                  onClick={() => { setIdentitySearchQuery(''); setStep('identity'); }} 
                  className="w-full text-right p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div>
                    <span className="block font-black text-xl mb-1 text-slate-800">יש לי מושב קבוע</span>
                    <span className="text-sm text-slate-500">דיווח נוכחות לשבוע הבא</span>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>
                
                <button 
                  onClick={() => { 
                    if (!isLocked) {
                      setCurrentUser({ name: 'אורח', type: UserType.CATCHER, selectedDays: nextWeekDates });
                      setSelectedDate(nextWeekDates[0]);
                      setStep('catcher_map');
                    } else {
                      setCatcherNameInput(''); 
                      setCatcherSelectedDays([]);
                      setSelectedDate(null); 
                      setStep('catcher_id'); 
                    }
                  }} 
                  className="w-full text-right p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div>
                    <span className="block font-black text-xl mb-1 text-slate-800">אני מחפש/ת מושב</span>
                    <span className="text-sm text-slate-500">שריון עמדה פנויה לשבוע הבא</span>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-100">
                <button 
                  disabled={!isCurrentActive}
                  onClick={() => { setSelectedDate(null); setStep('current_week_map'); }} 
                  className={`w-full flex items-center justify-between px-6 py-6 rounded-2xl transition-all group ${
                    isCurrentActive 
                      ? 'bg-amber-50/40 hover:bg-amber-50 text-amber-700' 
                      : 'bg-slate-50 text-slate-400 grayscale cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Zap className={`w-5 h-5 ${isCurrentActive ? 'text-amber-500' : 'text-slate-300'}`} />
                    <div className="text-right flex flex-col gap-1.5">
                      <span className="block font-black text-base leading-none">שריון מהיר לשבוע הנוכחי</span>
                      <span className="text-[11px] opacity-70 leading-none">צריכ/ה עמדה להיום? בדיקת פניות בזמן אמת</span>
                    </div>
                  </div>
                  {isCurrentActive && (
                    <ChevronLeft className="w-5 h-5 opacity-50 group-hover:-translate-x-1 transition-transform" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-full max-w-4xl mt-8 flex items-center justify-between px-6">
            <div className="text-slate-400 text-[10px] tracking-wider font-normal opacity-70">
              עיצוב ופיתוח אפליקציה: מוטי בכר עבור בילדוטס, 2026
            </div>
            <button 
              onClick={() => setShowPassModal(true)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-all text-xs font-bold"
            >
              <Settings className="w-3.5 h-3.5" />
              ניהול מערכת
            </button>
          </div>
        </div>
      )}

      {showPassModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black mb-2">כניסת אדמין</h3>
            <p className="text-slate-500 text-sm mb-6">הזן סיסמה כדי להמשיך</p>
            <input 
              type="password" 
              autoFocus
              value={passInput}
              onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminAuth()}
              placeholder="סיסמה..."
              className={`w-full bg-slate-50 border-2 rounded-xl p-4 text-center font-bold focus:outline-none transition-all ${passError ? 'border-rose-500 animate-shake' : 'border-slate-100 focus:border-indigo-500'}`}
            />
            {passError && <p className="text-rose-500 text-xs font-bold mt-2">סיסמה שגויה</p>}
            <div className="flex gap-2 mt-8">
              <button onClick={handleAdminAuth} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black">כניסה</button>
              <button onClick={() => { setShowPassModal(false); setPassInput(''); setPassError(false); }} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {step === 'admin_dashboard' && (
        <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-white">
          <header className="px-10 py-6 grid grid-cols-3 items-center border-b border-indigo-100 bg-indigo-900 text-white z-10 shadow-lg shrink-0">
            <div className="flex items-center gap-6 text-right">
              <button 
                onClick={() => { if (!relocatingUser) { forceLandingReset(); } }} 
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all group"
              >
                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-indigo-300" />
                <h1 className="text-2xl font-black leading-none">אדמין</h1>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-4 bg-white/10 p-2 rounded-[2rem] border border-white/20">
                {activeWeekDateRange.map((dateStr, idx) => {
                  const isPast = adminWeekMode === 'current' && isDateInPast(dateStr, currentTime);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button 
                      key={dateStr} 
                      disabled={isPast || !!relocatingUser}
                      onClick={() => setSelectedDate(dateStr)} 
                      className={`px-7 py-3 rounded-[1.5rem] transition-all flex flex-col items-center relative min-w-[95px] ${
                        isSelected 
                          ? 'bg-white text-indigo-900 shadow-xl scale-105' 
                          : isPast 
                            ? 'opacity-30 grayscale cursor-not-allowed' 
                            : 'text-indigo-100 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base font-black mb-1">{dayNames[idx]}</span>
                      <span className="text-[10px] font-bold opacity-70">{formatDayMonth(dateStr)}</span>
                      {isPast && <div className="absolute inset-0 flex items-center justify-center"><X className="w-4 h-4 text-rose-300 opacity-40" /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/20">
                <button 
                  onClick={() => { setAdminWeekMode('next'); setSelectedDate(null); }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${adminWeekMode === 'next' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-100 hover:bg-white/5'}`}
                >
                  שבוע הבא
                </button>
                <button 
                  onClick={() => { setAdminWeekMode('current'); setSelectedDate(null); }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${adminWeekMode === 'current' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-100 hover:bg-white/5'}`}
                >
                  שבוע נוכחי
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-[380px] bg-white border-l border-slate-200 flex flex-col shadow-sm">
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="חפש עובד..." 
                    value={adminSearchQuery} 
                    onChange={(e) => setAdminSearchQuery(e.target.value)} 
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pr-10 pl-3 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-400 text-right" 
                  />
                </div>
              </div>
              <div className={`flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 ${relocatingUser ? 'grayscale-[0.5] opacity-80' : ''}`}>
                {filteredAdminOwners.map(seat => {
                  const ownerName = seat.label2!;
                  const ownerAtt = currentAttendance.find(a => a.userName === ownerName && a.isOriginalOwner);
                  const isOwnerComing = !!ownerAtt;
                  const recordForSeat = currentAttendance.find(a => a.seatId === seat.id && a.userName !== ownerName);
                  const currentCatcher = recordForSeat?.userName;
                  const hasConflict = isOwnerComing && !!currentCatcher;

                  return (
                    <div 
                      key={seat.id} 
                      className={`p-2.5 rounded-xl border transition-all ${
                        hasConflict ? 'bg-rose-50/50 border-rose-100' : 'bg-white border-slate-50 hover:border-slate-100 hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black text-sm ${
                            isOwnerComing ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {seat.label1}
                          </div>
                          <div className="text-right truncate">
                            <h3 className="font-bold text-slate-700 text-sm leading-tight truncate">{ownerName}</h3>
                          </div>
                        </div>
                        <button 
                          onClick={() => selectedDate && adminToggleUserAttendance(ownerName, selectedDate)} 
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            isOwnerComing ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isOwnerComing ? 'מגיע/ה' : 'לא'}
                        </button>
                      </div>
                      {hasConflict && (
                        <div className="mt-2 p-2 bg-white rounded-lg border border-rose-100 flex flex-col gap-2 text-right">
                          <div className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> תפוס ע"י {currentCatcher}
                          </div>
                          <button 
                            onClick={() => setRelocatingUser({ 
                              name: currentCatcher!, 
                              date: selectedDate!, 
                              currentSeatId: seat.id, 
                              triggeredBy: ownerName,
                              prefKey: recordForSeat!.userId
                            })} 
                            className="w-full bg-rose-500 text-white py-1.5 rounded-md text-[10px] font-black hover:bg-rose-600 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Move className="w-3 h-3" /> שיבוץ מחדש
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 relative bg-[#F0F2F5] flex flex-col overflow-hidden">
              {relocatingUser && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-8 animate-in slide-in-from-top-4 duration-300 border-2 border-white/20 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                      <Move className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black">שיבוץ מחדש: {relocatingUser.name}</div>
                      <div className="text-[10px] font-bold text-indigo-200">בחר מושב פנוי (ירוק) במפה</div>
                    </div>
                  </div>
                  <button onClick={cancelRelocation} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                </div>
              )}
              {adminErrorMessage && (
                <div className="absolute top-28 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-8 py-4 rounded-2xl shadow-xl animate-in slide-in-from-top-4 flex items-center gap-3">
                  <AlertCircle className="w-6 h-6" />
                  <span className="font-black text-sm">{adminErrorMessage}</span>
                </div>
              )}
              <div className="flex-1 transition-all duration-500">
                {selectedDate && (
                  <SeatMap 
                    selectedDate={selectedDate} 
                    attendance={currentAttendance} 
                    cells={MAP_DATA} 
                    canBook={true} 
                    onSeatClick={(cell) => {
                      const record = currentAttendance.find(a => a.seatId === cell.id);
                      if (relocatingUser) {
                        handleAdminRelocation(cell);
                      } else if (record) {
                        setAdminFreeSeat(cell);
                      } else {
                        setAdminQuickBookName('');
                        setAdminQuickBookSeat(cell);
                      }
                    }} 
                    currentUser={null} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {(step === 'identity' || step === 'report' || step === 'catcher_id') && !showSuccess && (
        <div className="fixed top-6 right-6 z-[100]">
          <button 
            onClick={handleExitRequest} 
            className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-2 font-black text-sm hover:bg-slate-50 transition-all pointer-events-auto cursor-pointer"
          >
            <ArrowRightIcon className="w-4 h-4" /> חזרה לדף הבית
          </button>
        </div>
      )}

      {step === 'identity' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4">
          <div className="max-w-2xl w-full bg-white rounded-[3rem] shadow-2xl p-12 flex flex-col h-[700px] animate-in slide-in-from-bottom-10 text-right">
            <h2 className="text-3xl font-black text-slate-800 mb-8">מי את/ה?</h2>
            <div className="relative mb-8">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="חפש/י את שמך..." value={identitySearchQuery} onChange={e => setIdentitySearchQuery(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pr-12 pl-6 py-5 text-xl font-bold text-right focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {filteredIdentityOwners.map(cell => (
                <button key={cell.id} onClick={() => { 
                    const storedPref = allPrefs[cell.label2!];
                    const initialPref = storedPref ? { ...storedPref } : { name: cell.label2!, fixedDays: [], nextWeekOverrides: {}, bookings: {} };
                    setCurrentUser({ name: cell.label2!, type: UserType.OWNER, seatId: cell.label1 }); 
                    setStep('report'); 
                    setShowAdvanced(false); 
                    setStagedPref(initialPref);
                    setInitialStagedPrefJson(JSON.stringify(initialPref));
                  }} className="w-full text-right p-6 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all flex justify-between items-center group">
                  <span className="font-bold text-xl group-hover:text-blue-600">{cell.label2}</span>
                  <span className="text-xs font-black opacity-30 uppercase">עמדה {cell.label1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'report' && currentUser && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          {showSuccess ? (
            <div className="max-w-lg w-full bg-white rounded-[4rem] shadow-2xl p-16 text-center animate-in zoom-in-95 border border-slate-100">
               <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <CheckCircle2 className="w-14 h-14" />
               </div>
               <h2 className="text-3xl font-black text-slate-800 mb-4">תודה! נשמר בהצלחה</h2>
               <p className="text-slate-500 font-bold whitespace-nowrap">הבחירות שלך עודכנו במערכת. נתראה במשרד!</p>
            </div>
          ) : (
            <div className="max-w-4xl w-full bg-white rounded-[4rem] shadow-2xl p-12 text-center animate-in zoom-in-95 relative overflow-hidden border border-slate-100">
              
              {isLocked ? (
                <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-full inline-flex items-center gap-2 mb-6 font-bold text-sm ring-1 ring-amber-200">
                  <Lock className="w-4 h-4" />
                  <span>הדיווח נעול לשינויים</span>
                </div>
              ) : (
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-white">
                  <Smile className="w-12 h-12" />
                </div>
              )}

              <h2 className="text-3xl font-black mb-4 text-slate-800 leading-tight">
                {isLocked ? (
                  <>היי {currentUser.name.split(' ')[0]}, בחרת להגיע למשרד בשבוע הבא {getSelectedDaysText(currentUser.name)}. <br/><span className="text-xl text-slate-500">בשאר הימים העמדה שלך פתוחה לשריון.</span></>
                ) : (
                  `היי ${currentUser.name.split(' ')[0]}, מתי תגיע/י למשרד בשבוע הבא?`
                )}
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-10 mt-10">
                {nextWeekDates.map((date, idx) => {
                  const pref = stagedPref || allPrefs[currentUser.name];
                  const dayOfWeek = new Date(date).getDay();
                  let isComing = false;
                  
                  if (pref) {
                    const override = pref.nextWeekOverrides[date];
                    if (override !== undefined) {
                      isComing = override;
                    } else {
                      isComing = pref.fixedDays.includes(dayOfWeek);
                    }
                  }

                  return (
                    <button 
                      key={date} 
                      disabled={isLocked}
                      onClick={() => {
                        if (!stagedPref) return;
                        const newPref = { ...stagedPref, nextWeekOverrides: { ...stagedPref.nextWeekOverrides } };
                        newPref.nextWeekOverrides[date] = !isComing;
                        setStagedPref(newPref);
                      }} 
                      className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 transition-all duration-300 relative group/day ${
                        isComing 
                          ? (isLocked ? 'border-slate-200 bg-slate-50 opacity-80' : 'border-emerald-400 bg-emerald-50 shadow-[0_8px_30px_rgb(16,185,129,0.12)] scale-105 z-10')
                          : (isLocked ? 'border-slate-200 bg-slate-50/50 opacity-40 cursor-not-allowed' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50')
                      }`}
                    >
                      <span className={`block font-black text-2xl mb-1 ${isComing ? (isLocked ? 'text-slate-600' : 'text-emerald-700') : 'text-slate-800'}`}>{dayNames[idx]}</span>
                      <span className={`text-sm font-bold mb-4 ${isLocked && !isComing ? 'text-slate-200' : 'text-slate-400'}`}>{formatDayMonth(date)}</span>
                      
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                        isComing 
                          ? (isLocked ? 'bg-slate-400 border-slate-400 text-white' : 'bg-emerald-500 border-emerald-500 text-white')
                          : (isLocked ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white')
                      }`}>
                        {isComing && <Check className="w-6 h-6 stroke-[3px]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isLocked && (
                <>
                  <div className="mb-10">
                    <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 mx-auto text-slate-400 hover:text-slate-600 font-bold transition-all bg-slate-50/50 px-6 py-3 rounded-full border border-slate-100 group"
                    >
                      <Settings className={`w-4 h-4 transition-transform duration-500 ${showAdvanced ? 'rotate-180' : ''}`} />
                      <span>הגדרת ימי הגעה קבועים</span>
                      {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showAdvanced && (
                    <div className="bg-slate-50/80 rounded-[3rem] p-10 mb-10 border border-slate-100 animate-in slide-in-from-top-4 duration-500">
                      <div className="max-w-2xl mx-auto">
                        <h3 className="text-xl font-black text-slate-800 mb-2">ימי הגעה קבועים</h3>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">סמנ/י את הימים בהם את/ה מגיע/ה למשרד בדרך כלל (בשבוע רגיל). הבחירות שלך יישמרו וימולאו אוטומטית בשבועות הבאים. אל דאגה - במקרה הצורך, תוכל/י לשנות את הבחירה שלך בכל שבוע מחדש.</p>
                        
                        <div className="grid grid-cols-5 gap-2 justify-center">
                          {dayNames.map((name, dayIdx) => {
                            const pref = stagedPref || allPrefs[currentUser.name];
                            const isFixed = pref?.fixedDays.includes(dayIdx);
                            
                            return (
                              <button
                                key={name}
                                onClick={() => {
                                  if (!stagedPref) return;
                                  const newPref = { ...stagedPref, fixedDays: [...stagedPref.fixedDays] };
                                  if (isFixed) {
                                    newPref.fixedDays = newPref.fixedDays.filter(d => d !== dayIdx);
                                  } else {
                                    newPref.fixedDays = [...newPref.fixedDays, dayIdx];
                                  }
                                  setStagedPref(newPref);
                                }}
                                className={`py-4 rounded-2xl font-black text-base transition-all shadow-sm ${
                                  isFixed 
                                    ? 'bg-blue-600 text-white shadow-blue-200 scale-105' 
                                    : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-400'
                                }`}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-4">
                {!isLocked && (
                  <button 
                    onClick={handleReportFinalize} 
                    disabled={!isReportDirty}
                    className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_rgba(37,99,235,0.25)] hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
                  >
                    <span>שמירת הבחירות שלי</span>
                    <Save className="w-7 h-7 group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'catcher_id' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
          <div className="max-w-2xl w-full bg-white rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-12 text-center animate-in zoom-in-95 border border-slate-100">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-8 ring-white shadow-sm">
              <User className="w-10 h-10" strokeWidth={1.5} />
            </div>

            <h2 className="text-3xl font-black mb-2 text-[#1e293b]">מי מחפש/ת מושב?</h2>
            <p className="text-slate-500 font-medium mb-12">הקלד/י את שמך ובחר את ימי ההגעה המתוכננים שלך.</p>

            <div className="text-right mb-8">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pr-4">שם מלא</label>
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="הקלד/י שם מלא..." 
                  value={catcherNameInput} 
                  onChange={(e) => setCatcherNameInput(e.target.value)} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-7 text-2xl font-bold text-right focus:outline-none focus:border-blue-400 focus:bg-white transition-all group-hover:border-slate-300"
                />
              </div>
            </div>

            <div className="text-right mb-12">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pr-4">באילו ימים תגיע/י למשרד בשבוע הבא?</label>
              <div className="grid grid-cols-5 gap-3">
                {nextWeekDates.map((date, idx) => {
                  const isSelected = catcherSelectedDays.includes(date);
                  return (
                    <button
                      key={date}
                      onClick={() => {
                        if (isSelected) {
                          setCatcherSelectedDays(prev => prev.filter(d => d !== date));
                        } else {
                          setCatcherSelectedDays(prev => [...prev, date]);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-[1.5rem] border-2 transition-all duration-300 group/day ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'border-slate-300 bg-white text-slate-900 hover:border-blue-400 hover:bg-blue-50/50 shadow-sm'
                      }`}
                    >
                      <span className="font-black text-sm mb-1">{dayNames[idx]}</span>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{formatDayMonth(date)}</span>
                      {isSelected ? (
                        <div className="mt-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={4} />
                        </div>
                      ) : (
                        <div className="mt-2 w-5 h-5 border-2 border-slate-300 rounded-full bg-slate-50 group-hover/day:border-blue-300 transition-colors"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <button 
                onClick={() => { 
                  if (catcherNameInput.trim() && catcherSelectedDays.length > 0) { 
                    setCurrentUser({ name: catcherNameInput, type: UserType.CATCHER, selectedDays: catcherSelectedDays }); 
                    const firstDay = nextWeekDates.find(date => catcherSelectedDays.includes(date));
                    if (firstDay) setSelectedDate(firstDay);
                    setStep('catcher_map'); 
                  } 
                }} 
                disabled={!catcherNameInput.trim() || catcherSelectedDays.length === 0}
                className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-[0_20px_40px_-8px_rgba(37,99,235,0.25)] hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3 group"
              >
                <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                <span>המשך למפה</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {(step === 'catcher_map' || step === 'current_week_map') && (
        <div className="min-h-screen bg-white flex flex-col h-screen overflow-hidden">
          {showSuccess ? (
            <div className="flex-1 flex items-center justify-center px-4 bg-slate-50">
              <div className="max-w-lg w-full bg-white rounded-[4rem] shadow-2xl p-16 text-center animate-in zoom-in-95 border border-slate-100">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <CheckCircle2 className="w-14 h-14" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-4">תודה! נשמר בהצלחה</h2>
                <p className="text-slate-500 font-bold whitespace-nowrap">השריון שלך עודכן במערכת. נתראה במשרד!</p>
              </div>
            </div>
          ) : (
            <>
              <header className={`px-10 py-6 grid grid-cols-3 items-center border-b border-slate-100 bg-white shadow-sm z-10 ${step === 'current_week_map' ? 'bg-amber-50/20' : ''}`}>
                <div className="flex items-center gap-4 text-right">
                  <button 
                    onClick={handleExitRequest} 
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group cursor-pointer"
                    title="חזרה לדף הבית"
                  >
                    <ArrowRightIcon className="w-5 h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-black text-slate-800 leading-none">מפת המשרד</h1>
                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none mt-2 ${step === 'current_week_map' ? 'text-amber-600' : 'text-blue-600'}`}>
                      {step === 'current_week_map' ? 'שריון מהיר לשבוע הנוכחי' : `משריין עבור: ${currentUser?.name || 'אורח'}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="flex items-center gap-4 bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200">
                      {activeWeekDateRange.map((dateStr, idx) => {
                        const isPast = step === 'current_week_map' && isDateInPast(dateStr, currentTime);
                        const isDayAllowed = !isPast && (step === 'current_week_map' || !isLocked || !currentUser?.selectedDays || currentUser.selectedDays.includes(dateStr));
                        const isSelected = selectedDate === dateStr;

                        return (
                          <button 
                            key={dateStr} 
                            disabled={!isDayAllowed}
                            onClick={() => isDayAllowed && setSelectedDate(dateStr)} 
                            className={`px-7 py-3 rounded-[1.5rem] transition-all flex flex-col items-center min-w-[95px] ${
                              isSelected 
                                ? (step === 'current_week_map' ? 'bg-amber-500 text-white shadow-md' : 'bg-blue-600 text-white shadow-md')
                                : isDayAllowed 
                                  ? 'bg-white text-slate-800 hover:bg-slate-50' 
                                  : 'bg-transparent text-slate-300 opacity-40 cursor-not-allowed'
                            }`}
                          >
                            <span className="text-base font-black mb-1">{dayNames[idx]}</span>
                            <span className="text-[10px] font-bold opacity-70">{formatDayMonth(dateStr)}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="flex justify-end">
                  {step === 'catcher_map' && isLocked && (
                    <button onClick={handleCatcherFinished} className="bg-slate-900 text-white px-10 py-3.5 rounded-2xl font-black text-lg hover:bg-blue-600 transition-all flex items-center gap-2 group">
                      <span>סיימתי</span>
                      {Object.keys(tempBookings).length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                          {Object.keys(tempBookings).length}
                        </span>
                      )}
                    </button>
                  )}
                  {step === 'current_week_map' && (
                    <div className="bg-amber-100 text-amber-700 px-6 py-2 rounded-2xl flex items-center gap-2 font-black text-xs">
                      <Zap className="w-4 h-4" />
                      שריון מיידי
                    </div>
                  )}
                </div>
              </header>
              
              <div className="flex-1 relative bg-[#F0F2F5]">
                {step === 'catcher_map' && !isLocked && (
                  <div className="absolute inset-x-0 top-0 z-50 flex justify-center p-6 pointer-events-none">
                     <div className="bg-white/90 backdrop-blur-md px-8 py-4 rounded-3xl shadow-2xl border border-blue-100 flex items-center gap-4 animate-in slide-in-from-top-2 pointer-events-auto">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                          <Info className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                           <p className="font-black text-slate-800">השריון סגור כעת</p>
                           <p className="text-xs font-bold text-slate-500">המערכת תיפתח לשריון ביום חמישי בשעה 12:00</p>
                        </div>
                     </div>
                  </div>
                )}

                {selectedDate && (
                  <SeatMap 
                    selectedDate={selectedDate} 
                    attendance={currentAttendance} 
                    cells={MAP_DATA} 
                    canBook={step === 'current_week_map' || (step === 'catcher_map' && isLocked)}
                    onSeatClick={(cell) => {
                      if (step === 'catcher_map' && !isLocked) return;
                      
                      if (step === 'catcher_map') {
                        if (tempBookings[selectedDate] === cell.id) {
                          const newTemp = { ...tempBookings };
                          delete newTemp[selectedDate];
                          setTempBookings(newTemp);
                        } else {
                          const isTaken = currentAttendance.some(a => a.seatId === cell.id);
                          if (!isTaken) setBookingSeat(cell);
                        }
                      } 
                      else {
                        const isTaken = currentAttendance.some(a => a.seatId === cell.id);
                        if (!isTaken) {
                          setQuickBookName('');
                          setBookingSeat(cell);
                        }
                      }
                    }} 
                    currentUser={currentUser} 
                  />
                )}
              </div>
            </>
          )}
          
          {bookingSeat && selectedDate && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-xl p-8 max-w-2xl w-full text-center relative animate-in zoom-in-95 border border-slate-100">
                <button onClick={() => setBookingSeat(null)} className="absolute top-5 right-5 p-1.5 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-slate-500">
                  <X className="w-4 h-4" />
                </button>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-white shadow-sm ${step === 'current_week_map' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-6 text-slate-800">{step === 'current_week_map' ? 'שריון מהיר' : 'אישור שריון'}</h3>
                
                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-6 text-right flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="text-lg font-bold text-slate-800 leading-tight">מושב {bookingSeat.label1}, {currentSelectedDayName} {formatDayMonth(selectedDate)}</div>
                    <div className="mt-4 flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">בעלים מקורי</span>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-600 truncate">{bookingSeat.label2 || 'ללא בעלים'}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-14 h-14 text-white rounded-xl flex items-center justify-center text-xl font-black shadow-lg shrink-0 ${step === 'current_week_map' ? 'bg-amber-500 shadow-amber-100' : 'bg-blue-600 shadow-blue-100'}`}>
                    {bookingSeat.label1}
                  </div>
                </div>

                {step === 'current_week_map' && (
                  <div className="mb-6 text-right">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-1">הקלד/י שמך המלא</label>
                    <input type="text" autoFocus placeholder="שם מלא..." value={quickBookName} onChange={e => setQuickBookName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInstantQuickBook()} className="w-full bg-white border-2 border-slate-100 rounded-xl p-4 text-center font-bold focus:outline-none focus:border-amber-500 transition-all" />
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button onClick={step === 'current_week_map' ? handleInstantQuickBook : stageBooking} disabled={step === 'current_week_map' && !quickBookName.trim()} className={`w-full text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group disabled:opacity-50 ${step === 'current_week_map' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>{step === 'current_week_map' ? 'אשר שריון עכשיו' : 'שריין עמדה'}</span>
                  </button>
                  <button onClick={() => setBookingSeat(null)} className="text-slate-400 font-semibold text-xs hover:text-slate-600 transition-colors">חזרה למפה</button>
                </div>
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative animate-in zoom-in-95 border border-rose-100">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-white shadow-sm">
                  <AlertOctagon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-slate-800">אופס, קונפליקט!</h3>
                <p className="text-slate-500 font-semibold mb-6 text-sm">חלק מהמושבים שבחרת נתפסו על ידי מישהו אחר בדקות האחרונות:</p>
                <div className="space-y-2 mb-8 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {conflicts.map((conflict, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-right">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-rose-600">יום {conflict.dayName}</span>
                        <span className="text-[10px] text-slate-400">{formatDayMonth(conflict.date)}</span>
                      </div>
                      <span className="font-black text-slate-800">מושב {conflict.seatLabel}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { const firstConflictDate = conflicts[0].date; setConflicts([]); setSelectedDate(firstConflictDate); }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                  <ArrowRightIcon className="w-4 h-4" />
                  <span>חזור למפה לבחירה מחדש</span>
                </button>
              </div>
            </div>
          )}

          {showSummary && currentUser && conflicts.length === 0 && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full text-center relative animate-in zoom-in-95 border border-slate-100 flex flex-col items-center mx-auto">
                <button onClick={() => setShowSummary(false)} className="absolute top-5 right-5 p-1.5 hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-slate-500">
                  <X className="w-4 h-4" />
                </button>
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 ring-4 ring-white shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-slate-800 leading-tight">{currentUser.name.split(' ')[0]}, הנה הסיכום שלך</h3>
                <p className="text-slate-500 font-semibold mb-6 text-sm">אלו המקומות בהם תשב/י בשבוע הקרוב:</p>
                <div className="w-full max-h-[380px] overflow-y-auto space-y-3 mb-8 custom-scrollbar px-1">
                  {userSummaryBookings.length > 0 ? (
                    userSummaryBookings.map((booking, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between text-right hover:border-blue-100 transition-all shadow-sm">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-bold text-slate-800">יום {booking.dayName}</span>
                            <span className="text-[10px] font-bold text-slate-400">{formatDayMonth(booking.date)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">במקור של {booking.originalOwner}</span>
                            <span className="text-sm font-bold text-slate-700">מושב {booking.seatLabel}</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg font-black shadow-md shadow-blue-50 shrink-0">
                          {booking.seatLabel}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-slate-400 font-semibold text-sm italic">לא שריינת אף מושב עדיין...</div>
                  )}
                </div>
                <div className="w-full flex flex-col gap-3">
                  <button onClick={handleCatcherFinalize} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-slate-800 transition-all">אישור וסיום</button>
                  <button onClick={() => setShowSummary(false)} className="text-slate-400 font-semibold text-xs hover:text-slate-600 transition-colors">חזרה למפה</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Modals */}
      {showExitWarning && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-rose-100">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-slate-800">לצאת בלי לשמור?</h3>
              <p className="text-slate-500 font-bold mb-8">יש לך שריונים במפה או שינויי דיווח שטרם נשמרו. אם תצא/י עכשיו, הבחירות שלך יאבדו.</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => forceLandingReset()} className="w-full bg-rose-600 text-white py-4 rounded-xl font-black shadow-lg">כן, צא בלי לשמור</button>
                <button onClick={() => setShowExitWarning(false)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-black">הישאר במפה</button>
              </div>
           </div>
        </div>
      )}

      {adminQuickBookSeat && selectedDate && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserPlus className="w-6 h-6" /></div>
            <h3 className="text-xl font-bold mb-1">שריון מהיר (אדמין)</h3>
            <p className="text-slate-500 text-xs mb-6">עבור מושב {adminQuickBookSeat.label1} ביום {currentSelectedDayName}</p>
            <input type="text" autoFocus value={adminQuickBookName} onChange={(e) => setAdminQuickBookName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminQuickBook()} placeholder="שם העובד..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-center font-bold focus:outline-none focus:border-indigo-500 mb-6" />
            <div className="flex gap-2">
              <button onClick={handleAdminQuickBook} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm">שריין עמדה</button>
              <button onClick={() => setAdminQuickBookSeat(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {adminFreeSeat && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserMinus className="w-6 h-6" /></div>
            <h3 className="text-xl font-bold mb-1">פינוי עמדה</h3>
            <p className="text-slate-500 text-xs mb-6">האם אתה בטוח שברצונך לפנות את מושב {adminFreeSeat.label1}?<br /><span className="font-bold text-slate-800">יושב/ת כעת: {currentAttendance.find(a => a.seatId === adminFreeSeat.id)?.userName || 'לא ידוע'}</span></p>
            <div className="flex gap-2">
              <button onClick={handleFreeSeat} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold text-sm">פנה עמדה</button>
              <button onClick={() => setAdminFreeSeat(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {conflictPrompt && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center animate-in zoom-in-95 border-2 border-amber-100">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6" /></div>
            <h3 className="text-xl font-bold mb-2">קונפליקט בעמדה</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">המושב של <strong>{conflictPrompt.ownerName}</strong> תפוס כרגע על ידי <strong>{conflictPrompt.occupantName}</strong>. כדי להחזיר את הבעלים לעמדה, יש לשבץ מחדש את האורח.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setRelocatingUser({ name: conflictPrompt.occupantName, date: conflictPrompt.date, currentSeatId: conflictPrompt.seatId, triggeredBy: conflictPrompt.ownerName, prefKey: conflictPrompt.prefKey }); setConflictPrompt(null); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Move className="w-4 h-4" />שיבוץ מחדש לאורח</button>
              <button onClick={() => setConflictPrompt(null)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
