import { Subject } from '../types';

export interface ExamPresetTemplate {
  id: string;
  name: string;
  category: 'Medical' | 'Engineering & STEM' | 'College Board & High School' | 'Law & Bar' | 'Finance & Business' | 'Civil Services' | 'Computer Science';
  description: string;
  badge: string;
  icon: string;
  targetExamDurationMonths: number;
  subjects: Subject[];
}

export const EXAM_PRESET_TEMPLATES: ExamPresetTemplate[] = [
  {
    id: 'usmle-mcat-premed',
    name: 'USMLE Step 1 / MCAT Pre-Med Master',
    category: 'Medical',
    description: 'High-yield curriculum covering Biochemistry, Human Physiology, Pathology, Pharmacology, and Microbiology.',
    badge: 'Medical Board',
    icon: '🩺',
    targetExamDurationMonths: 6,
    subjects: [
      {
        id: 'tmpl-med-biochem',
        name: 'Biochemistry & Genetics',
        color: '#059669',
        icon: '🧬',
        description: 'Enzyme kinetics, metabolic pathways, molecular genetics, and cellular signaling.',
        chapters: [
          {
            id: 'tmpl-med-bio-ch1',
            name: 'Metabolic Pathways & Bioenergetics',
            topics: [
              { id: 't-mb-1', topicNumber: '1.1', name: 'Glycolysis & Gluconeogenesis Regulation', status: 'Not Started', subtopics: [{ id: 'st-1', name: 'PFK-1 & F2,6BP Kinetics', completed: false }] },
              { id: 't-mb-2', topicNumber: '1.2', name: 'Krebs Cycle & Oxidative Phosphorylation', status: 'Not Started', subtopics: [{ id: 'st-2', name: 'Electron Transport Chain Complexes I-IV', completed: false }] },
              { id: 't-mb-3', topicNumber: '1.3', name: 'Glycogen Storage & Fatty Acid Oxidation', status: 'Not Started', subtopics: [{ id: 'st-3', name: 'Carnitine Shuttle & Ketogenesis', completed: false }] }
            ]
          },
          {
            id: 'tmpl-med-bio-ch2',
            name: 'Molecular Genetics & DNA Repair',
            topics: [
              { id: 't-mb-4', topicNumber: '2.1', name: 'DNA Replication & Mismatch Repair', status: 'Not Started', subtopics: [{ id: 'st-4', name: 'BRCA & Lynch Syndrome Mechanisms', completed: false }] },
              { id: 't-mb-5', topicNumber: '2.2', name: 'Transcription Factors & Epigenetics', status: 'Not Started', subtopics: [{ id: 'st-5', name: 'Histone Acetylation & DNA Methylation', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-med-physio',
        name: 'Human Physiology',
        color: '#2563EB',
        icon: '🫀',
        description: 'Cardiovascular, Renal, Respiratory, and Endocrine organ system mechanics.',
        chapters: [
          {
            id: 'tmpl-med-phy-ch1',
            name: 'Cardiovascular Dynamics',
            topics: [
              { id: 't-mp-1', topicNumber: '1.1', name: 'Cardiac Cycle & Pressure-Volume Loops', status: 'Not Started', subtopics: [{ id: 'st-6', name: 'Inotropy, Preload & Afterload Curves', completed: false }] },
              { id: 't-mp-2', topicNumber: '1.2', name: 'Hemodynamics & Baroreceptor Reflex', status: 'Not Started', subtopics: [{ id: 'st-7', name: 'Autonomic Regulation of BP', completed: false }] }
            ]
          },
          {
            id: 'tmpl-med-phy-ch2',
            name: 'Renal & Acid-Base Balance',
            topics: [
              { id: 't-mp-3', topicNumber: '2.1', name: 'Glomerular Filtration Rate & Clearance', status: 'Not Started', subtopics: [{ id: 'st-8', name: 'Afferent/Efferent Arteriolar Resistances', completed: false }] },
              { id: 't-mp-4', topicNumber: '2.2', name: 'Tubular Electrolyte Handling & RAAS', status: 'Not Started', subtopics: [{ id: 'st-9', name: 'Loop of Henle & Countercurrent Multiplier', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-med-pharm',
        name: 'Pharmacology & Therapeutics',
        color: '#D97706',
        icon: '💊',
        description: 'Pharmacokinetics, autonomic drugs, antimicrobial mechanisms, and cardiovascular pharmacology.',
        chapters: [
          {
            id: 'tmpl-med-phm-ch1',
            name: 'Autonomic & Cardiovascular Drugs',
            topics: [
              { id: 't-mph-1', topicNumber: '1.1', name: 'Adrenergic Agonists & Beta Blockers', status: 'Not Started', subtopics: [{ id: 'st-10', name: 'Receptor Specificity & Hemodynamic Effects', completed: false }] },
              { id: 't-mph-2', topicNumber: '1.2', name: 'Antiarrhythmics Classes I to IV', status: 'Not Started', subtopics: [{ id: 'st-11', name: 'Vaughan Williams Classification', completed: false }] }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'jee-neet-stem',
    name: 'JEE Advanced / NEET (STEM Master)',
    category: 'Engineering & STEM',
    description: 'Calculus-based Physics, Physical & Organic Chemistry, and Advanced Mathematics/Biology.',
    badge: 'STEM Entrance',
    icon: '⚛️',
    targetExamDurationMonths: 8,
    subjects: [
      {
        id: 'tmpl-jee-phys',
        name: 'Physics (Mechanics & Electrodynamics)',
        color: '#2563EB',
        icon: '⚡',
        description: 'Rotational dynamics, electrostatics, electromagnetism, and optics.',
        chapters: [
          {
            id: 'tmpl-jp-ch1',
            name: 'Rotational Dynamics & Gravitation',
            topics: [
              { id: 't-jp-1', topicNumber: '1.1', name: 'Moment of Inertia & Parallel Axis Theorem', status: 'Not Started', subtopics: [{ id: 'st-12', name: 'Continuous Mass Distributions', completed: false }] },
              { id: 't-jp-2', topicNumber: '1.2', name: 'Rolling Motion & Angular Momentum Conservation', status: 'Not Started', subtopics: [{ id: 'st-13', name: 'Pure Rolling on Incline', completed: false }] }
            ]
          },
          {
            id: 'tmpl-jp-ch2',
            name: 'Electromagnetism & Wave Optics',
            topics: [
              { id: 't-jp-3', topicNumber: '2.1', name: 'Gauss Law & Electric Potential Integrals', status: 'Not Started', subtopics: [{ id: 'st-14', name: 'Concentric Spherical Shells', completed: false }] },
              { id: 't-jp-4', topicNumber: '2.2', name: 'Faraday Law & Inductance RL/RC Circuits', status: 'Not Started', subtopics: [{ id: 'st-15', name: 'Lenz Law & Eddy Currents', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-jee-chem',
        name: 'Chemistry (Physical & Organic)',
        color: '#059669',
        icon: '🧪',
        description: 'Thermodynamics, chemical equilibrium, reaction mechanisms, and coordination compounds.',
        chapters: [
          {
            id: 'tmpl-jc-ch1',
            name: 'Chemical Thermodynamics & Kinetics',
            topics: [
              { id: 't-jc-1', topicNumber: '1.1', name: 'Gibbs Free Energy & Spontaneity', status: 'Not Started', subtopics: [{ id: 'st-16', name: 'Van\'t Hoff Equation & Entropy', completed: false }] },
              { id: 't-jc-2', topicNumber: '1.2', name: 'Arrhenius Equation & Reaction Orders', status: 'Not Started', subtopics: [{ id: 'st-17', name: 'First & Second Order Integrated Rate Laws', completed: false }] }
            ]
          },
          {
            id: 'tmpl-jc-ch2',
            name: 'Organic Reaction Mechanisms',
            topics: [
              { id: 't-jc-3', topicNumber: '2.1', name: 'Nucleophilic Substitution SN1 vs SN2', status: 'Not Started', subtopics: [{ id: 'st-18', name: 'Stereochemical Inversion & Solvent Effects', completed: false }] },
              { id: 't-jc-4', topicNumber: '2.2', name: 'Electrophilic Aromatic Substitution (EAS)', status: 'Not Started', subtopics: [{ id: 'st-19', name: 'Ortho/Para vs Meta Directing Groups', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-jee-math',
        name: 'Mathematics (Calculus & Vectors)',
        color: '#7C3AED',
        icon: '📐',
        description: 'Differential calculus, integral calculus, differential equations, and 3D coordinate geometry.',
        chapters: [
          {
            id: 'tmpl-jm-ch1',
            name: 'Integral Calculus & Differential Equations',
            topics: [
              { id: 't-jm-1', topicNumber: '1.1', name: 'Definite Integrals & Properties', status: 'Not Started', subtopics: [{ id: 'st-20', name: 'Leibniz Rule of Differentiation under Integral', completed: false }] },
              { id: 't-jm-2', topicNumber: '1.2', name: 'Linear Differential Equations & Integrating Factor', status: 'Not Started', subtopics: [{ id: 'st-21', name: 'Bernoulli Form Reductions', completed: false }] }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sat-ap-college',
    name: 'College Board AP & SAT Honors',
    category: 'College Board & High School',
    description: 'Comprehensive AP Calculus BC, AP Physics C, and AP Biology curriculum breakdown.',
    badge: 'AP Honors',
    icon: '🎓',
    targetExamDurationMonths: 4,
    subjects: [
      {
        id: 'tmpl-ap-calc',
        name: 'AP Calculus BC',
        color: '#7C3AED',
        icon: '📐',
        description: 'Limits, derivatives, integrals, series, and parametric/polar equations.',
        chapters: [
          {
            id: 'tmpl-apc-ch1',
            name: 'Infinite Sequences & Series',
            topics: [
              { id: 't-apc-1', topicNumber: '1.1', name: 'Convergence Tests (Ratio, Integral, Comparison)', status: 'Not Started', subtopics: [{ id: 'st-22', name: 'Alternating Series Error Bound', completed: false }] },
              { id: 't-apc-2', topicNumber: '1.2', name: 'Taylor & Maclaurin Polynomials', status: 'Not Started', subtopics: [{ id: 'st-23', name: 'Lagrange Error Bound', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-ap-bio',
        name: 'AP Biology',
        color: '#059669',
        icon: '🧬',
        description: 'Cell structure, cellular energetics, heredity, and gene expression.',
        chapters: [
          {
            id: 'tmpl-apb-ch1',
            name: 'Cellular Energetics & Photosynthesis',
            topics: [
              { id: 't-apb-1', topicNumber: '1.1', name: 'Light Reactions & Calvin Cycle', status: 'Not Started', subtopics: [{ id: 'st-24', name: 'Chemiosmosis in Chloroplasts', completed: false }] },
              { id: 't-apb-2', topicNumber: '1.2', name: 'Cellular Respiration & Fermentation', status: 'Not Started', subtopics: [{ id: 'st-25', name: 'ATP Yield Calculations', completed: false }] }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'law-bar-lsat',
    name: 'Law, LSAT & Bar Exam Master',
    category: 'Law & Bar',
    description: 'MBE Bar topics including Constitutional Law, Contracts, Torts, Criminal Law & Evidence.',
    badge: 'Bar Prep',
    icon: '⚖️',
    targetExamDurationMonths: 5,
    subjects: [
      {
        id: 'tmpl-law-conlaw',
        name: 'Constitutional Law',
        color: '#DC2626',
        icon: '🏛️',
        description: 'Judicial review, federalism, equal protection, due process, and First Amendment speech.',
        chapters: [
          {
            id: 'tmpl-lc-ch1',
            name: 'Individual Rights & First Amendment',
            topics: [
              { id: 't-lc-1', topicNumber: '1.1', name: 'Strict Scrutiny vs Rational Basis Standards', status: 'Not Started', subtopics: [{ id: 'st-26', name: 'Suspect Classifications under 14th Amendment', completed: false }] },
              { id: 't-lc-2', topicNumber: '1.2', name: 'Commercial Speech & Time-Place-Manner Regulations', status: 'Not Started', subtopics: [{ id: 'st-27', name: 'Central Hudson 4-Part Test', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-law-contracts',
        name: 'Contracts & UCC Article 2',
        color: '#D97706',
        icon: '📜',
        description: 'Offer and acceptance, consideration, Statute of Frauds, parol evidence rule, and remedies.',
        chapters: [
          {
            id: 'tmpl-lcnt-ch1',
            name: 'Formation, Breach & Remedies',
            topics: [
              { id: 't-lcnt-1', topicNumber: '1.1', name: 'Battle of the Forms (UCC 2-207)', status: 'Not Started', subtopics: [{ id: 'st-28', name: 'Additional vs Different Terms', completed: false }] },
              { id: 't-lcnt-2', topicNumber: '1.2', name: 'Expectation, Reliance & Restitution Damages', status: 'Not Started', subtopics: [{ id: 'st-29', name: 'Hadley v Baxendale Foreseeability', completed: false }] }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'cfa-finance',
    name: 'CFA Level 1 / Financial Analyst',
    category: 'Finance & Business',
    description: 'Financial Statement Analysis, Corporate Issuers, Equity Valuation, Fixed Income, and Ethics.',
    badge: 'Finance Charter',
    icon: '📊',
    targetExamDurationMonths: 6,
    subjects: [
      {
        id: 'tmpl-cfa-fsa',
        name: 'Financial Statement Analysis',
        color: '#0891B2',
        icon: '📈',
        description: 'Income statements, balance sheets, cash flow reconciliation, and financial ratios.',
        chapters: [
          {
            id: 'tmpl-cfsa-ch1',
            name: 'Cash Flow & Inventory Accounting',
            topics: [
              { id: 't-cf-1', topicNumber: '1.1', name: 'CFO, CFI, and CFF Direct vs Indirect Methods', status: 'Not Started', subtopics: [{ id: 'st-30', name: 'Working Capital Adjustments', completed: false }] },
              { id: 't-cf-2', topicNumber: '1.2', name: 'FIFO vs LIFO Inventory Valuations & LIFO Reserve', status: 'Not Started', subtopics: [{ id: 'st-31', name: 'COGS & Tax Impact Conversions', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-cfa-fixed',
        name: 'Fixed Income & Bond Valuation',
        color: '#4F46E5',
        icon: '🪙',
        description: 'Yield curves, duration, convexity, and credit analysis.',
        chapters: [
          {
            id: 'tmpl-cfi-ch1',
            name: 'Yield Measures & Risk Analysis',
            topics: [
              { id: 't-cfi-1', topicNumber: '1.1', name: 'Macaulay & Modified Duration Calculations', status: 'Not Started', subtopics: [{ id: 'st-32', name: 'Price Sensitivity to Interest Rate Shifts', completed: false }] },
              { id: 't-cfi-2', topicNumber: '1.2', name: 'Convexity Adjustment & Spot Rate Yield Curves', status: 'Not Started', subtopics: [{ id: 'st-33', name: 'Par Rates vs Forward Rates', completed: false }] }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'cs-software',
    name: 'Computer Science & System Architecture',
    category: 'Computer Science',
    description: 'Data Structures, Advanced Algorithms, Distributed Systems, Databases, and Operating Systems.',
    badge: 'Software Engineering',
    icon: '💻',
    targetExamDurationMonths: 4,
    subjects: [
      {
        id: 'tmpl-cs-dsa',
        name: 'Data Structures & Algorithms',
        color: '#7C3AED',
        icon: '🧠',
        description: 'Trees, graphs, dynamic programming, sorting, and complexity analysis.',
        chapters: [
          {
            id: 'tmpl-cd-ch1',
            name: 'Graph Theory & Dynamic Programming',
            topics: [
              { id: 't-cd-1', topicNumber: '1.1', name: 'Dijkstra & A* Shortest Path Algorithms', status: 'Not Started', subtopics: [{ id: 'st-34', name: 'Priority Queue Optimization O(E log V)', completed: false }] },
              { id: 't-cd-2', topicNumber: '1.2', name: 'Dynamic Programming 2D Memoization & Tabulation', status: 'Not Started', subtopics: [{ id: 'st-35', name: 'Knapsack 0/1 & Longest Common Subsequence', completed: false }] }
            ]
          }
        ]
      },
      {
        id: 'tmpl-cs-systems',
        name: 'Operating Systems & System Design',
        color: '#059669',
        icon: '🖥️',
        description: 'Processes, concurrency, virtual memory paging, distributed caching, and microservices.',
        chapters: [
          {
            id: 'tmpl-csy-ch1',
            name: 'Concurrency & Distributed Architecture',
            topics: [
              { id: 't-csy-1', topicNumber: '1.1', name: 'Mutexes, Semaphores & Deadlock Prevention (Bankers Alg)', status: 'Not Started', subtopics: [{ id: 'st-36', name: 'Race Condition Safeguards', completed: false }] },
              { id: 't-csy-2', topicNumber: '1.2', name: 'Distributed Caching & Sharding Strategies', status: 'Not Started', subtopics: [{ id: 'st-37', name: 'Consistent Hashing & Cache-Aside Pattern', completed: false }] }
            ]
          }
        ]
      }
    ]
  }
];
