
export enum UserType {
  OWNER = 'OWNER',
  CATCHER = 'CATCHER'
}

export type CellType = 'seat' | 'zone' | 'meta';

export interface MapCell {
  type: CellType;
  id: string;
  x: number; // 1-based column
  y: number; // 1-based row
  w: number; // width in grid units
  h: number; // height in grid units
  fill: string; // hex color
  label1: string; // Seat number or Zone name
  label2?: string; // Person name (optional)
  monitorsCount?: 1 | 2;
}

// Added isOriginalOwner and completed the interface
export interface AttendanceRecord {
  seatId: string;
  date: string; // ISO string (YYYY-MM-DD)
  userId: string;
  userType: UserType;
  userName: string;
  isOriginalOwner: boolean;
}

// Added AppConfig interface used in constants.ts and dateHelpers.ts
export interface AppConfig {
  lockDay: number;
  lockHour: number;
  workingDays: number[];
}

// Added UserPreferences interface used in App.tsx
export interface UserPreferences {
  name: string;
  fixedDays: number[];
  nextWeekOverrides: { [date: string]: boolean };
  bookings: { [date: string]: string };
}
