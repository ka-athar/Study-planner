import { StorageVault } from '../types';

export const DEFAULT_STORAGE_VAULTS: StorageVault[] = [
  {
    id: 'vault-bio-mock-series',
    userId: '',
    name: 'Cell Biology & Genetics Mock Exam Series',
    description: 'Unit-by-unit comprehensive timed mock exams for AP/College Biology with mistake tracking and genetics problem breakdown.',
    subjectName: 'Biology',
    category: 'mock_series',
    color: '#059669',
    icon: '🧬',
    targetScore: 85,
    targetDate: '2026-11-15',
    maxScore: 100,
    passingScore: 70,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Genetics', 'Cell Division', 'MCQ & FRQ', 'AP Bio'],
    metadata: {
      courseCode: 'BIO-201',
      cohortOrSemester: 'Fall Semester',
      benchmarkNotes: 'Targeting >85% in Mendelian genetics and enzyme kinetics'
    }
  },
  {
    id: 'vault-phys-mechanics',
    userId: '',
    name: 'Classical Mechanics & Thermodynamics Lab Tests',
    description: 'Isolated test repository for Newtonian dynamics, work-energy calculations, and thermo cycles.',
    subjectName: 'Physics',
    category: 'project',
    color: '#2563EB',
    icon: '⚛️',
    targetScore: 90,
    targetDate: '2026-12-01',
    maxScore: 100,
    passingScore: 65,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Kinematics', 'Dynamics', 'Energy Conservation', 'Calculus-Based'],
    metadata: {
      courseCode: 'PHYS-101',
      cohortOrSemester: 'Term 1 Project',
      benchmarkNotes: 'Focus on rotational inertia derivation and free body diagrams'
    }
  },
  {
    id: 'vault-chem-organic',
    userId: '',
    name: 'Organic Chemistry Reaction & Synthesis Vault',
    description: 'Dedicated test batch for reaction mechanisms, SN1/SN2 nucleophilic substitution, and spectroscopy quizzes.',
    subjectName: 'Chemistry',
    category: 'diagnostic',
    color: '#D97706',
    icon: '🧪',
    targetScore: 80,
    targetDate: '2026-10-30',
    maxScore: 50,
    passingScore: 35,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Stereochemistry', 'Synthesis', 'Mechanisms'],
    metadata: {
      courseCode: 'CHEM-220',
      cohortOrSemester: 'Organic Chemistry I',
      benchmarkNotes: 'Eliminate stereochemistry inversion mistakes'
    }
  },
  {
    id: 'vault-math-calculus',
    userId: '',
    name: 'Calculus & Differential Equations Diagnostic Batch',
    description: 'Weekly diagnostic drill tests covering integration techniques, series convergence, and related rates.',
    subjectName: 'Mathematics',
    category: 'assignment_batch',
    color: '#7C3AED',
    icon: '📐',
    targetScore: 88,
    targetDate: '2026-11-20',
    maxScore: 100,
    passingScore: 70,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Integration', 'Taylor Series', 'Derivatives', 'Speed Drill'],
    metadata: {
      courseCode: 'MATH-152',
      cohortOrSemester: 'Calculus II',
      benchmarkNotes: 'Improve speed on trigonometric substitution'
    }
  }
];
