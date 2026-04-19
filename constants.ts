
import { MapCell, AppConfig } from './types';

export const APP_CONFIG: AppConfig = {
  lockDay: 4, // Thursday
  lockHour: 12, // 12:00
  workingDays: [0, 1, 2, 3, 4], // Sun to Thu
};

const SEAT_NAMES: Record<string, string> = {
  "1": "Carmel",
  "2": "Revital",
  "3": "Alon",
  "4": "Ariel",
  "5": "Jenia",
  "6": "Oded",
  "7": "Ohad",
  "8": "Michal",
  "9": "Adler",
  "10": "Daniel",
  "11": "Moshe",
  "12": "Shahar"
};

const SEAT_MONITORS: Record<string, 1 | 2> = {
  "1": 1,
  "2": 2,
  "3": 1,
  "4": 2,
  "5": 1,
  "6": 2,
  "7": 2,
  "8": 2,
  "9": 2,
  "10": 2,
  "11": 2,
  "12": 1
};

const MAP_CSV = `
F,F,F,F,F,F,F,F
F,12,F,8,5,F,F,F
F,11,F,7,4,F,2,F
F,10,F,6,3,F,1,F
F,9,F,F,F,F,Door,F
F,F,F,F,F,F,F,F
`.trim();

const generateMapData = (): MapCell[] => {
  const rows = MAP_CSV.split('\n');
  const cells: MapCell[] = [];
  
  const height = rows.length;
  const width = rows[0].split(',').length;
  
  cells.push({ 
    type: 'meta', 
    id: 'canvas', 
    x: 1, y: 1, 
    w: width, h: height, 
    fill: 'transparent', 
    label1: 'Office' 
  });

  const SPECIAL_ROOMS = ["Wall", "Phone Booths", "Aberfeldy"];

  rows.forEach((rowStr, yIdx) => {
    const cols = rowStr.split(',');
    cols.forEach((val, xIdx) => {
      const x = xIdx + 1;
      const y = yIdx + 1;
      const id = `cell-${x}-${y}`;
      
      if (val === 'F') {
        cells.push({
          type: 'zone',
          id,
          x, y, w: 1, h: 1,
          fill: '#f1f5f9', // Light Grey Floor
          label1: ''
        });
      } else if (val === 'R' || SPECIAL_ROOMS.includes(val)) {
        cells.push({
          type: 'zone',
          id,
          x, y, w: 1, h: 1,
          fill: '#e2e8f0', // Neutral Gray Room/Wall
          label1: val === 'R' ? '' : val
        });
      } else if (!isNaN(Number(val)) && val.trim() !== '') {
        cells.push({
          type: 'seat',
          id: val,
          x, y, w: 1, h: 1,
          fill: '#C6E0B4', // Original Green
          label1: val,
          label2: SEAT_NAMES[val] || '',
          monitorsCount: SEAT_MONITORS[val] || 1
        });
      }
    });
  });

  return cells;
};

export const MAP_DATA: MapCell[] = generateMapData();
