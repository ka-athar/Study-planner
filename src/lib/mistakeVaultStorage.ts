import { MistakeEntry, CognitiveErrorCategory } from '../types';

const STORAGE_KEY = 'study_mistake_vault_v1';
const LISTEN_EVENT = 'study_mistake_vault_updated';

export const ERROR_CATEGORY_METADATA: Record<CognitiveErrorCategory, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconText: string;
  description: string;
}> = {
  careless_calc: {
    label: 'Careless Calculation',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    iconText: '🔢',
    description: 'Arithmetic slip, missed decimal, signs inverted, or unit conversion error.'
  },
  misread_question: {
    label: 'Misread Question',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconText: '👓',
    description: 'Missed crucial conditions like "NOT", "constant pressure", or omitted second sub-question.'
  },
  formula_confusion: {
    label: 'Formula Confusion',
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    iconText: '📐',
    description: 'Applied wrong variant (e.g. series vs parallel resistance, sin instead of cos).'
  },
  concept_gap: {
    label: 'Conceptual Hole',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    iconText: '🧠',
    description: 'Did not fully grasp the underlying scientific or mathematical principles.'
  },
  time_pressure: {
    label: 'Time Pressure Rush',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    iconText: '⏱️',
    description: 'Rushed at the end of the exam, skipped checking steps or writing legible working.'
  },
  english_comprehension: {
    label: 'English / Language Comprehension Trap',
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    iconText: '📖',
    description: 'Nuance in English wording, vocabulary trap, double negatives, or idiom/grammar misunderstanding.'
  },
  missing_question: {
    label: 'Missing / Skipped Question',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    iconText: '❓',
    description: 'Question left unattempted, overlooked on paper, or skipped due to time running out.'
  }
};

const SEED_MISTAKES: MistakeEntry[] = [
  {
    id: 'seed-physics-1',
    subjectName: 'Physics',
    topicName: 'Thermodynamics & Heat Engines',
    question: 'A Carnot engine operates between temperatures of 327°C and 27°C. Calculate its ideal theoretical efficiency.',
    userAttempt: 'Efficiency = 1 - (27 / 327) = 1 - 0.0825 = 91.75%',
    correctAnswer: 'Temperatures MUST be converted to Kelvin: T1 = 327 + 273 = 600 K, T2 = 27 + 273 = 300 K. Efficiency = 1 - (300 / 600) = 50.0%.',
    errorCategory: 'careless_calc',
    notes: 'Forgot to convert Celsius to Absolute Kelvin (K = °C + 273.15). Always verify absolute temperature in thermodynamic formulas!',
    source: 'red_pen',
    cureStatus: 'curing',
    consecutiveCorrect: 1,
    history: [
      { date: new Date(Date.now() - 86400000).toISOString(), wasCorrect: true }
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'seed-chem-1',
    subjectName: 'Chemistry',
    topicName: 'Chemical Equilibrium & Le Chatelier',
    question: 'For the exothermic synthesis of ammonia: N2(g) + 3H2(g) ⇌ 2NH3(g) (ΔH < 0), state the effect of increasing temperature on the value of the equilibrium constant Kc.',
    userAttempt: 'Kc remains unchanged because temperature only changes reaction speed, not the ratio of products to reactants.',
    correctAnswer: 'Kc decreases. Since the forward reaction is exothermic, according to Le Chatelier\'s principle, adding heat shifts the equilibrium backwards, decreasing product yield and thus lowering Kc. (Only temperature changes Kc!)',
    errorCategory: 'concept_gap',
    notes: 'Remember: Catalysts and pressure do not change Kc, but TEMPERATURE DOES change Kc!',
    source: 'quiz',
    cureStatus: 'active',
    consecutiveCorrect: 0,
    history: [],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'seed-math-1',
    subjectName: 'Mathematics',
    topicName: 'Calculus: Integration by Parts',
    question: 'Evaluate the indefinite integral ∫ x · e^(2x) dx.',
    userAttempt: 'x · (1/2 e^(2x)) - ∫ (1/2 e^(2x)) dx = (1/2)x e^(2x) - (1/2) e^(2x) + C',
    correctAnswer: '(1/2)x e^(2x) - (1/4) e^(2x) + C. The integral of (1/2) e^(2x) introduces another factor of 1/2, making it 1/4.',
    errorCategory: 'formula_confusion',
    notes: 'Watch the chain rule denominator during repeated integration of e^(kx). Integrating e^(2x) gives (1/2)e^(2x), so (1/2)*(1/2) = 1/4.',
    source: 'past_paper',
    cureStatus: 'cured',
    consecutiveCorrect: 3,
    history: [
      { date: new Date(Date.now() - 86400000 * 4).toISOString(), wasCorrect: true },
      { date: new Date(Date.now() - 86400000 * 2).toISOString(), wasCorrect: true },
      { date: new Date(Date.now() - 86400000).toISOString(), wasCorrect: true }
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  }
];

export function loadMistakes(): MistakeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_MISTAKES));
      return SEED_MISTAKES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SEED_MISTAKES;
  } catch (err) {
    console.error('Error loading mistake vault:', err);
    return SEED_MISTAKES;
  }
}

export function saveMistakes(mistakes: MistakeEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mistakes));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LISTEN_EVENT, { detail: mistakes }));
    }
  } catch (err) {
    console.error('Error saving mistake vault:', err);
  }
}

export function addMistake(entry: {
  subjectName: string;
  topicName?: string;
  question: string;
  userAttempt?: string;
  correctAnswer: string;
  errorCategory: CognitiveErrorCategory;
  notes?: string;
  source?: MistakeEntry['source'];
}): MistakeEntry {
  const mistakes = loadMistakes();
  const now = new Date().toISOString();
  const newMistake: MistakeEntry = {
    id: 'mistake-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    subjectName: entry.subjectName,
    topicName: entry.topicName || 'General Concepts',
    question: entry.question,
    userAttempt: entry.userAttempt || '',
    correctAnswer: entry.correctAnswer,
    errorCategory: entry.errorCategory,
    notes: entry.notes || '',
    source: entry.source || 'manual',
    cureStatus: 'active',
    consecutiveCorrect: 0,
    history: [],
    createdAt: now,
    updatedAt: now
  };

  const updated = [newMistake, ...mistakes];
  saveMistakes(updated);
  return newMistake;
}

export function recordMistakeAttempt(
  mistakeId: string, 
  wasCorrect: boolean, 
  userResponse?: string
): { updatedMistake: MistakeEntry | null; justCured: boolean } {
  const mistakes = loadMistakes();
  let justCured = false;
  let updatedTarget: MistakeEntry | null = null;

  const updated = mistakes.map(m => {
    if (m.id !== mistakeId) return m;

    const newConsecutive = wasCorrect ? m.consecutiveCorrect + 1 : 0;
    let newStatus = m.cureStatus;

    if (newConsecutive >= 3) {
      if (m.cureStatus !== 'cured') justCured = true;
      newStatus = 'cured';
    } else if (newConsecutive > 0) {
      newStatus = 'curing';
    } else {
      newStatus = 'active';
    }

    const updatedItem: MistakeEntry = {
      ...m,
      consecutiveCorrect: newConsecutive,
      cureStatus: newStatus,
      updatedAt: new Date().toISOString(),
      history: [
        {
          date: new Date().toISOString(),
          wasCorrect,
          userResponse
        },
        ...m.history
      ].slice(0, 10)
    };

    updatedTarget = updatedItem;
    return updatedItem;
  });

  saveMistakes(updated);
  return { updatedMistake: updatedTarget, justCured };
}

export function deleteMistake(id: string): void {
  const mistakes = loadMistakes();
  saveMistakes(mistakes.filter(m => m.id !== id));
}

export function subscribeMistakes(callback: (mistakes: MistakeEntry[]) => void): () => void {
  const handler = (e: any) => {
    if (e.detail) {
      callback(e.detail);
    } else {
      callback(loadMistakes());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(LISTEN_EVENT, handler);
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        callback(loadMistakes());
      }
    });
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(LISTEN_EVENT, handler);
    }
  };
}

export interface MistakeStats {
  total: number;
  cured: number;
  curing: number;
  active: number;
  cureRate: number;
  categoryCounts: Record<CognitiveErrorCategory, number>;
  subjectCounts: Record<string, number>;
}

export function calculateMistakeStats(mistakes: MistakeEntry[]): MistakeStats {
  const total = mistakes.length;
  let cured = 0;
  let curing = 0;
  let active = 0;

  const categoryCounts: Record<CognitiveErrorCategory, number> = {
    careless_calc: 0,
    misread_question: 0,
    formula_confusion: 0,
    concept_gap: 0,
    time_pressure: 0
  };

  const subjectCounts: Record<string, number> = {};

  mistakes.forEach(m => {
    if (m.cureStatus === 'cured') cured++;
    else if (m.cureStatus === 'curing') curing++;
    else active++;

    if (categoryCounts[m.errorCategory] !== undefined) {
      categoryCounts[m.errorCategory]++;
    }

    subjectCounts[m.subjectName] = (subjectCounts[m.subjectName] || 0) + 1;
  });

  const cureRate = total > 0 ? Math.round((cured / total) * 100) : 0;

  return {
    total,
    cured,
    curing,
    active,
    cureRate,
    categoryCounts,
    subjectCounts
  };
}
