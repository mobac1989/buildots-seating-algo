
import { APP_CONFIG } from '../constants';

/**
 * Gets the current time in Israel (UTC+2 or UTC+3)
 */
export const getIsraelTime = (): Date => {
  const now = new Date();
  try {
    const israelTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
    return new Date(israelTimeStr);
  } catch (e) {
    return now;
  }
};

/**
 * Formats a date as YYYY-MM-DD using LOCAL date components
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns string like "31.2" for UI display
 */
export const formatDayMonth = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2])}.${parseInt(parts[1])}`;
  }
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};

export const isNextWeekLocked = (currentTime: Date): boolean => {
  const day = currentTime.getDay();
  const hour = currentTime.getHours();
  // Thursday (4) at 12:00
  if (day > APP_CONFIG.lockDay) return true;
  if (day === APP_CONFIG.lockDay && hour >= APP_CONFIG.lockHour) return true;
  return false;
};

/**
 * Checks if the "Current Week" booking should be visible (Sun 08:00 to Thu 12:00)
 */
export const isCurrentWeekActive = (currentTime: Date): boolean => {
  const day = currentTime.getDay();
  const hour = currentTime.getHours();
  
  // Saturday or Friday are definitely out
  if (day === 5 || day === 6) return false;
  
  // Sunday starts at 08:00
  if (day === 0 && hour < 8) return false;
  
  // Thursday ends at 12:00
    if (day === APP_CONFIG.lockDay && hour >= APP_CONFIG.lockHour) {
    return false;
  }
  
  return true;
};

/**
 * Returns an array of 5 dates (Sun-Thu) for the CURRENT work week
 */
export const getCurrentWeekRange = (currentTime: Date): string[] => {
  const d = new Date(currentTime);
  const day = d.getDay();
  const diff = d.getDate() - day; // Go back to Sunday (0)
  
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const target = new Date(d);
    target.setDate(diff + i);
    dates.push(formatDate(target));
  }
  return dates;
};

/**
 * Checks if a date (YYYY-MM-DD) is in the past relative to current time
 */
export const isDateInPast = (dateStr: string, currentTime: Date): boolean => {
  const todayStr = formatDate(currentTime);
  return dateStr < todayStr;
};

/**
 * Calculates the upcoming Sunday. 
 */
export const getNextSunday = (currentTime: Date): Date => {
  const d = new Date(currentTime);
  const day = d.getDay();
  const daysUntilNextSunday = 7 - day;
  
  const target = new Date(d);
  target.setDate(d.getDate() + daysUntilNextSunday);
  target.setHours(0, 0, 0, 0);
  return target;
};

/**
 * Returns an array of 5 dates (Sun-Thu) for the next work week
 */
export const getNextWeekRange = (currentTime: Date): string[] => {
  const dates: string[] = [];
  const start = getNextSunday(currentTime);
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
};

export const getCountdownToLock = (currentTime: Date) => {
  const target = new Date(currentTime);
  const currentDay = target.getDay();
  
  let daysToAdd = (APP_CONFIG.lockDay - currentDay + 7) % 7;
  if (daysToAdd === 0 && target.getHours() >= APP_CONFIG.lockHour) {
    daysToAdd = 7;
  }
  
  target.setDate(target.getDate() + daysToAdd);
  target.setHours(APP_CONFIG.lockHour, 0, 0, 0);
  
  const diff = target.getTime() - currentTime.getTime();
  if (diff < 0) return { d: 0, h: 0, m: 0 };

  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { d, h, m };
};
