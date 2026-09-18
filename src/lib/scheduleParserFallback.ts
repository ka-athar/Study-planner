export interface FallbackScheduleItem {
  date: string;
  dayLabel: string;
  timeSlot: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  estimatedMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  itemType: 'study_session' | 'exam' | 'revision' | 'class_lecture' | 'deadline';
  notes: string;
  monthKey: string;
  weekLabel: string;
}

export interface FallbackScheduleResult {
  scheduleName: string;
  analysisSummary: string;
  totalEstimatedHours: number;
  monthsCovered: string[];
  scheduledItems: FallbackScheduleItem[];
}

const MONTH_NAMES: { [key: string]: number } = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fallbackParseCalendarSchedule(
  rawText: string,
  referenceDateStr?: string,
  knownSubjects: string[] = []
): FallbackScheduleResult {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const validRefDate = isNaN(refDate.getTime()) ? new Date() : refDate;

  const lines = rawText
    .split(/\r?\n|;/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('#---'));

  const items: FallbackScheduleItem[] = [];
  let currentDate = new Date(validRefDate);
  let dayOffset = 0;

  const commonSubjects = [
    'Physics', 'Chemistry', 'Mathematics', 'Math', 'Biology', 'History',
    'English', 'Computer Science', 'Economics', 'Psychology', 'Geography',
    'Literature', 'Organic Chemistry', 'Calculus', 'Algebra', 'Mechanics'
  ];
  const allSubjects = Array.from(new Set([...knownSubjects, ...commonSubjects])).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Strip markdown bullets or numbers
    const cleanLine = rawLine.replace(/^[-*•\d.)\]\s]+/, '').trim();
    if (!cleanLine || cleanLine.length < 3) continue;

    let lineDate: Date | null = null;
    let timeSlot = '09:00 - 10:30';
    let estimatedMinutes = 90;
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    let itemType: 'study_session' | 'exam' | 'revision' | 'class_lecture' | 'deadline' = 'study_session';

    // 1. Check for explicit ISO dates: 2026-08-31 or 2026/08/31
    const isoMatch = cleanLine.match(/\b(202\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      lineDate = new Date(year, month, day);
    }

    // 2. Check for Month Day: e.g. Aug 25, August 25, 25 Aug
    if (!lineDate) {
      const monthDayMatch = cleanLine.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/i) ||
                            cleanLine.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|Nov|Dec)[a-z]*\b/i);
      if (monthDayMatch) {
        const monthWord = (isNaN(Number(monthDayMatch[1])) ? monthDayMatch[1] : monthDayMatch[2]).toLowerCase().slice(0, 3);
        const dayNum = parseInt(isNaN(Number(monthDayMatch[1])) ? monthDayMatch[2] : monthDayMatch[1], 10);
        const monthIdx = MONTH_NAMES[monthWord] ?? validRefDate.getMonth();
        const year = validRefDate.getFullYear();
        lineDate = new Date(year, monthIdx, dayNum);
      }
    }

    // 3. Check for Day of Week (e.g. Monday, Tue, Tomorrow, Day 1)
    if (!lineDate) {
      const lower = cleanLine.toLowerCase();
      if (lower.includes('tomorrow')) {
        const d = new Date(validRefDate);
        d.setDate(d.getDate() + 1);
        lineDate = d;
      } else if (lower.includes('today')) {
        lineDate = new Date(validRefDate);
      } else {
        for (let dIdx = 0; dIdx < DAY_NAMES.length; dIdx++) {
          const dayName = DAY_NAMES[dIdx];
          if (lower.includes(dayName) || lower.startsWith(dayName.slice(0, 3))) {
            const currentDayOfWeek = validRefDate.getDay();
            let diff = dIdx - currentDayOfWeek;
            if (diff < 0) diff += 7;
            const targetD = new Date(validRefDate);
            targetD.setDate(targetD.getDate() + diff);
            lineDate = targetD;
            break;
          }
        }
      }
    }

    // 4. If no date found on this line, advance sequentially
    if (!lineDate) {
      const d = new Date(validRefDate);
      d.setDate(d.getDate() + dayOffset);
      lineDate = d;
      dayOffset++;
    } else {
      currentDate = lineDate;
    }

    // 5. Extract Time Slot (e.g. 09:00 - 11:00, 2pm - 4pm, 2 hours, 60m)
    const timeMatch = cleanLine.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
    if (timeMatch) {
      timeSlot = `${timeMatch[1].trim()} - ${timeMatch[2].trim()}`;
    }

    const durationMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|mins|min|m)\b/i);
    if (durationMatch) {
      const val = parseFloat(durationMatch[1]);
      if (cleanLine.toLowerCase().includes('min')) {
        estimatedMinutes = Math.round(val);
      } else {
        estimatedMinutes = Math.round(val * 60);
      }
    }

    // 6. Extract Subject
    let detectedSubject = 'General Study';
    for (const sub of allSubjects) {
      const reg = new RegExp(`\\b${sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (reg.test(cleanLine)) {
        detectedSubject = sub;
        break;
      }
    }

    // 7. Extract Item Type and Priority
    const lowerLine = cleanLine.toLowerCase();
    if (lowerLine.includes('exam') || lowerLine.includes('test') || lowerLine.includes('mock') || lowerLine.includes('paper')) {
      itemType = 'exam';
      priority = 'High';
    } else if (lowerLine.includes('revision') || lowerLine.includes('revise') || lowerLine.includes('review') || lowerLine.includes('recap')) {
      itemType = 'revision';
      priority = 'Medium';
    } else if (lowerLine.includes('deadline') || lowerLine.includes('due') || lowerLine.includes('submission')) {
      itemType = 'deadline';
      priority = 'High';
    } else if (lowerLine.includes('lecture') || lowerLine.includes('class') || lowerLine.includes('session')) {
      itemType = 'class_lecture';
      priority = 'Medium';
    }

    if (lowerLine.includes('urgent') || lowerLine.includes('critical') || lowerLine.includes('priority: high') || lowerLine.includes('hard')) {
      priority = 'High';
    }

    // 8. Extract Topic and Chapter
    let topicName = cleanLine
      .replace(timeMatch ? timeMatch[0] : '', '')
      .replace(durationMatch ? durationMatch[0] : '', '')
      .replace(new RegExp(`\\b${detectedSubject}\\b`, 'i'), '')
      .replace(/^(on|at|for|study|revise|session|chapter|ch\.?|topic)\s*/i, '')
      .replace(/[:,|-]+$/, '')
      .trim();

    if (!topicName || topicName.length < 2) {
      topicName = `${detectedSubject} Study Session`;
    }

    let chapterName = 'Core Curriculum';
    const chMatch = cleanLine.match(/(?:Chapter|Ch\.?|Unit|Module)\s*(\d+|[A-Za-z0-9\s]+)/i);
    if (chMatch) {
      chapterName = chMatch[0].trim();
    }

    const isoDateStr = formatDateISO(lineDate);
    const monthKey = isoDateStr.slice(0, 7);
    const dayLabel = lineDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    items.push({
      date: isoDateStr,
      dayLabel,
      timeSlot,
      subjectName: detectedSubject,
      chapterName,
      topicName,
      estimatedMinutes,
      priority,
      itemType,
      notes: `Extracted from schedule: "${cleanLine.slice(0, 80)}"`,
      monthKey,
      weekLabel: `Week ${Math.ceil(lineDate.getDate() / 7)}`
    });
  }

  // If no items were parsed, generate at least one clean starter item
  if (items.length === 0) {
    const todayStr = formatDateISO(validRefDate);
    items.push({
      date: todayStr,
      dayLabel: validRefDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      timeSlot: '09:00 - 10:30',
      subjectName: knownSubjects[0] || 'General Studies',
      chapterName: 'Core Review',
      topicName: rawText.slice(0, 50).trim() || 'Scheduled Study Session',
      estimatedMinutes: 90,
      priority: 'Medium',
      itemType: 'study_session',
      notes: 'Imported schedule plan',
      monthKey: todayStr.slice(0, 7),
      weekLabel: 'Week 1'
    });
  }

  const totalEstimatedHours = Math.round(
    items.reduce((acc, it) => acc + (it.estimatedMinutes || 60), 0) / 60 * 10
  ) / 10;

  const monthsCovered = Array.from(new Set(items.map(i => i.monthKey))).filter(Boolean);
  const subjectsCovered = Array.from(new Set(items.map(i => i.subjectName))).filter(Boolean);

  const analysisSummary = `Structured schedule with ${items.length} study events across ${subjectsCovered.length} subject(s) (${subjectsCovered.join(', ')}), totaling approximately ${totalEstimatedHours} hours across ${monthsCovered.join(', ')}.`;

  return {
    scheduleName: `${subjectsCovered[0] || 'Academic'} Study Schedule`,
    analysisSummary,
    totalEstimatedHours,
    monthsCovered,
    scheduledItems: items
  };
}
