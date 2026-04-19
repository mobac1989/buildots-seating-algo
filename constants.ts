
import { MapCell, AppConfig } from './types';

export const APP_CONFIG: AppConfig = {
  lockDay: 4, // Thursday
  lockHour: 12, // 12:00
  workingDays: [0, 1, 2, 3, 4], // Sun to Thu
};

const SEAT_NAMES: Record<string, string> = {
  "1": "Bar Ziony",
  "2": "Yahav Sofer",
  "3": "Ido Bar-Lev",
  "4": "Yarden Messika",
  "5": "Amit Cohen",
  "6": "Alex Hefetz",
  "7": "Jonathan Rozenblat",
  "8": "Jonathan Levanon",
  "9": "Shir Goldfarb",
  "10": "Gil Shelef",
  "11": "Ofer Lazmi",
  "12": "Itay Issashar",
  "13": "Tomer Mardan",
  "14": "Daniel Ammar",
  "15": "Dor Shtainman",
  "16": "Avinoam Kugler",
  "17": "Eliel Hojman",
  "18": "Eran Levav",
  "19": "Benel Tayar",
  "20": "Avishai Hendel",
  "21": "Mika Kost",
  "22": "Yohai Ido",
  "23": "Tom Melloul",
  "24": "Matan Georgi",
  "25": "Yaniv Fleischer",
  "26": "Tomer Marx",
  "27": "Alisa Utkin",
  "28": "Ofir Cooper",
  "29": "Nadav Gover",
  "30": "Bar Nagauker",
  "31": "Asaf Shoshany",
  "32": "Eldar Bakerman",
  "33": "Haleli Amiad Steinberg",
  "34": "Elias Cohenca",
  "35": "Ronen Reshef",
  "36": "Moral Segal",
  "37": "Aaron Wilson",
  "38": "Amir Puri",
  "39": "Tamar Zanger",
  "40": "Aviad Shlaien",
  "41": "Yuval Fritz",
  "42": "Itamar Wilf",
  "43": "Yoav Wolfson",
  "44": "Amir Cohen",
  "45": "Nitzan Friedman",
  "46": "Itai Bardan",
  "47": "Joseph Tenenbaum",
  "48": "Moti Bachar",
  "49": "Sarah Belson",
  "50": "Aviv Aharonovich",
  "51": "Jaymie Isaacs",
  "52": "Gleb Zhelezniak"
};

const SEAT_MONITORS: Record<string, 1 | 2> = {
  "1": 2,
  "2": 2,
  "3": 2,
  "4": 2,
  "5": 1,
  "6": 2,
  "7": 2,
  "8": 2,
  "9": 1,
  "10": 1,
  "11": 1,
  "12": 2,
  "13": 2,
  "14": 1,
  "15": 1,
  "16": 1,
  "17": 1,
  "18": 2,
  "19": 2,
  "20": 2,
  "21": 1,
  "22": 1,
  "23": 1,
  "24": 2,
  "25": 1,
  "26": 2,
  "27": 1,
  "28": 2,
  "29": 1,
  "30": 1,
  "31": 2,
  "32": 1,
  "33": 1,
  "34": 1,
  "35": 2,
  "36": 1,
  "37": 2,
  "38": 1,
  "39": 1,
  "40": 1,
  "41": 1,
  "42": 1,
  "43": 1,
  "44": 1,
  "45": 1,
  "46": 2,
  "47": 1,
  "48": 1,
  "49": 1,
  "50": 2,
  "51": 2,
  "52": 2
};

const MAP_CSV = `
F,F,F,F,F,F,F,F,F,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F
F,F,F,F,F,F,F,F,F,R,F,F,F,F,F,F,F,F,F,F,F,19,21,F,23,F,F,F,F
F,35,F,38,40,F,43,F,F,R,F,1,5,F,9,12,F,52,F,F,F,20,22,F,24,F,F,F,F
F,36,F,39,41,F,44,48,F,Wall,F,2,6,F,10,13,F,15,17,F,F,F,F,F,25,F,F,F,F
F,37,F,F,F,F,45,49,F,R,F,3,7,F,11,14,F,16,18,F,R,R,R,F,F,F,F,F,F
F,F,F,F,F,F,46,50,F,R,F,4,8,F,F,F,F,F,F,F,R,R,R,F,26,28,F,31,F
F,F,F,F,42,F,47,51,F,R,F,F,F,F,R,R,Phone Booths,R,R,F,R,Aberfeldy,R,F,27,29,F,32,F
F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,F,F,F,F,33,F
F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,30,34,F,F
F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F
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
