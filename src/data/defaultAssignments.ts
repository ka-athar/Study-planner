import { Assignment } from '../types';

export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg_1_bio_lab',
    userId: 'default_user',
    title: 'Cellular Respiration & Krebs Cycle Lab Report',
    description: 'Complete formal lab analysis on mitochondria oxygen consumption curves, error margins, and submit the scientific writeup.',
    subjectName: 'Biology',
    chapterName: 'Cell Biology',
    topicName: 'Cellular Respiration',
    type: 'Lab work',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
    dueTime: '23:59',
    priority: 'High',
    status: 'In Progress',
    estimatedMinutes: 90,
    timeSpentMinutes: 35,
    notes: 'Remember to attach graph data from Vaults/Biology Lab experiments and cross-verify ATP yield calculations.',
    attachments: [
      {
        id: 'att_1',
        name: 'Lab Protocol & Spectrophotometer Data.pdf',
        type: 'file',
        fileSize: '1.4 MB',
        addedAt: new Date().toISOString()
      }
    ],
    subtasks: [
      {
        id: 'sub_1',
        title: 'Review Raw Data & Plot Oxygen Depletion Rate',
        phase: 'research',
        estimatedMinutes: 25,
        completed: true,
        completedAt: new Date().toISOString(),
        scheduledDate: new Date().toISOString().split('T')[0],
        timeslot: 'morning'
      },
      {
        id: 'sub_2',
        title: 'Draft Discussion on Krebs Cycle Enzyme Inhibitors',
        phase: 'drafting',
        estimatedMinutes: 40,
        completed: false,
        scheduledDate: new Date().toISOString().split('T')[0],
        timeslot: 'afternoon'
      },
      {
        id: 'sub_3',
        title: 'Final Proofread & Check Rubric Checklist',
        phase: 'review',
        estimatedMinutes: 25,
        completed: false,
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timeslot: 'evening'
      }
    ],
    hasPrepPlan: true,
    reminderEnabled: true,
    reminderDaysBefore: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'asg_2_chem_quiz',
    userId: 'default_user',
    title: 'Thermodynamics & Enthalpy Diagnostic Quiz',
    description: 'Timed assessment covering Gibbs free energy, Hess’s Law calculations, and spontaneous reaction thresholds.',
    subjectName: 'Chemistry',
    chapterName: 'Chemical Thermodynamics',
    topicName: 'Gibbs Free Energy',
    type: 'Quiz',
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now
    dueTime: '10:00',
    priority: 'Urgent',
    status: 'Not Started',
    estimatedMinutes: 60,
    timeSpentMinutes: 0,
    notes: 'Focus heavily on sign conventions (ΔH, ΔS, ΔG) and temperature dependency of spontaneity.',
    attachments: [
      {
        id: 'att_2',
        name: 'Thermodynamics Formula Sheet & Constants',
        type: 'link',
        url: 'https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps',
        addedAt: new Date().toISOString()
      }
    ],
    subtasks: [
      {
        id: 'sub_4',
        title: 'Flashcard Drill on Thermodynamic Formulas',
        phase: 'practice',
        estimatedMinutes: 20,
        completed: false,
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timeslot: 'morning'
      },
      {
        id: 'sub_5',
        title: 'Solve 10 Hess Law & Calorimetry Numerical Problems',
        phase: 'practice',
        estimatedMinutes: 40,
        completed: false,
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        timeslot: 'afternoon'
      }
    ],
    hasPrepPlan: true,
    reminderEnabled: true,
    reminderDaysBefore: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'asg_3_math_pset',
    userId: 'default_user',
    title: 'Differential Calculus & Optimization Problem Set',
    description: 'Weekly assigned problem set: 12 problem variations covering related rates, local extrema, and concavity tests.',
    subjectName: 'Mathematics',
    chapterName: 'Calculus & Applications',
    topicName: 'Applications of Derivatives',
    type: 'Homework',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    dueTime: '17:00',
    priority: 'High',
    status: 'In Progress',
    estimatedMinutes: 75,
    timeSpentMinutes: 30,
    notes: 'Check problem 8 with AI Tutor if step derivation becomes unclear.',
    subtasks: [
      {
        id: 'sub_6',
        title: 'Problems 1 to 6 (Related Rates & Critical Points)',
        phase: 'drafting',
        estimatedMinutes: 35,
        completed: true,
        completedAt: new Date().toISOString(),
        scheduledDate: new Date().toISOString().split('T')[0],
        timeslot: 'morning'
      },
      {
        id: 'sub_7',
        title: 'Problems 7 to 12 (Optimization Word Problems)',
        phase: 'drafting',
        estimatedMinutes: 40,
        completed: false,
        scheduledDate: new Date().toISOString().split('T')[0],
        timeslot: 'evening'
      }
    ],
    hasPrepPlan: true,
    reminderEnabled: true,
    reminderDaysBefore: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
