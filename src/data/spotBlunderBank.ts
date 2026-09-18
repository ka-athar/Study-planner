import { SpotBlunderChallenge } from '../types';

export const DEFAULT_BLUNDER_CHALLENGES: SpotBlunderChallenge[] = [
  {
    id: 'blunder-phys-01',
    title: 'Faraday & Lenz’s Law: Electromagnetic Induction Trap',
    subjectName: 'Physics',
    chapterName: 'Electromagnetism',
    topicName: 'Faraday’s Law & Lenz’s Law',
    examBoard: 'Cambridge A-Level & Federal Board (FBISE)',
    pastPaperYear: 'May/June 2023 Paper 42 Q4(b)',
    examFrequency: '🔥 Guaranteed Core (Appears in 88% of past 10 years)',
    trapCasualtyRate: 71, // 71% of candidates dropped marks here
    isHotTopic: true,
    totalMarks: 5,
    fictionalStudentName: 'Hamza K.',
    fictionalStudentTargetGrade: 'Targeting Grade A*',
    studentActualScore: 2,
    questionText: `A flat search coil having 250 tightly wound turns of cross-sectional area 4.0 × 10⁻⁴ m² is placed perpendicular to a uniform magnetic field of flux density 0.18 T.
In a time interval of 15 ms, the magnetic flux density is uniformly reduced to zero.
(i) State Faraday's law of electromagnetic induction. [2]
(ii) Calculate the magnitude of the induced electromotive force (e.m.f.) in the coil. [3]`,
    answerLines: [
      {
        id: 'line-1',
        lineIndex: 0,
        text: 'Faraday’s Law states that when magnetic flux changes, an EMF is created in the circuit.',
        hasBlunder: true,
        blunderId: 'blunder-p1-1'
      },
      {
        id: 'line-2',
        lineIndex: 1,
        text: 'The induced EMF opposes the change causing it as per Lenz law.',
        hasBlunder: false
      },
      {
        id: 'line-3',
        lineIndex: 2,
        text: 'Flux = B × A = 0.18 × (4.0 × 10⁻⁴) = 7.2 × 10⁻⁵ Wb.',
        hasBlunder: false
      },
      {
        id: 'line-4',
        lineIndex: 3,
        text: 'Change in flux linkage = 7.2 × 10⁻⁵ Wb. Time taken = 15 ms.',
        hasBlunder: true,
        blunderId: 'blunder-p1-2'
      },
      {
        id: 'line-5',
        lineIndex: 4,
        text: 'EMF = ΔΦ / Δt = 7.2 × 10⁻⁵ / 15 = 4.8 × 10⁻⁶.',
        hasBlunder: true,
        blunderId: 'blunder-p1-3'
      }
    ],
    blunders: [
      {
        id: 'blunder-p1-1',
        lineIndex: 0,
        title: 'Omission of "Rate of Change" & "Magnetic Flux Linkage"',
        category: 'vague_keyword',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"when magnetic flux changes, an EMF is created"',
        whyStudentMadeIt: 'Student gave a colloquial, everyday definition rather than statutory examiner keywords.',
        examinerTrapAnalysis: 'Chief Examiner Report specifies: "Merely stating that flux changes gains zero credit. Candidates MUST explicitly state: directly proportional to the RATE of change of magnetic flux linkage."',
        howToPrevent: 'Always memorize board definitions verbatim. The word "RATE" and "FLUX LINKAGE" (not just flux) are compulsory for [B1] & [B1].',
        correctCorrection: 'Induced e.m.f. is directly proportional to the RATE of change of magnetic flux linkage.'
      },
      {
        id: 'blunder-p1-2',
        lineIndex: 3,
        title: 'Forgot to Multiply by Number of Turns (N = 250)',
        category: 'formula_confusion',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"Change in flux linkage = 7.2 × 10⁻⁵ Wb"',
        whyStudentMadeIt: 'Calculated single-loop flux Φ instead of total coil flux linkage NΦ.',
        examinerTrapAnalysis: 'The question stated a coil of 250 turns. Over 45% of students calculate single turn flux Φ and forget N, losing the method mark [M1].',
        howToPrevent: 'Circle the number of turns "N = 250" in the question stem with your pencil immediately upon reading.',
        correctCorrection: 'Total flux linkage Δ(NΦ) = 250 × 7.2 × 10⁻⁵ = 0.018 Wb-turns.'
      },
      {
        id: 'blunder-p1-3',
        lineIndex: 4,
        title: 'Unit Conversion Failure (ms → s) & Missing SI Unit (V)',
        category: 'missing_unit',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"7.2 × 10⁻⁵ / 15 = 4.8 × 10⁻⁶"',
        whyStudentMadeIt: 'Divided directly by 15 without converting milliseconds (15 × 10⁻³ s) and omitted the unit V.',
        examinerTrapAnalysis: 'Time was given in milliseconds (15 ms) to trap fast workers. A naked number without "V" or "volts" forfeits the accuracy mark [A1].',
        howToPrevent: 'Always write SI prefixes in standard form before calculating (15 ms = 15 × 10⁻³ s) and box your final answer with its unit.',
        correctCorrection: 'EMF = 0.018 / (15 × 10⁻³) = 1.20 V (Volts).'
      }
    ],
    deconstructedRubric: [
      {
        id: 'rub-p1',
        code: 'B1',
        title: 'Statement of proportionality to rate of change',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Student omitted "rate of change", stating only that flux changes. Zero credit.',
        mandatoryKeywords: ['rate of change', 'directly proportional']
      },
      {
        id: 'rub-p2',
        code: 'B1',
        title: 'Magnetic flux linkage specified (not just flux)',
        marksAllocated: 1,
        awardedToStudent: true,
        examinerRationale: 'Student mentioned flux linkage in line 4 and referenced magnetic interaction.',
        mandatoryKeywords: ['magnetic flux linkage']
      },
      {
        id: 'rub-p3',
        code: 'M1',
        title: 'Calculation of total flux linkage change Δ(NΦ)',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Did not include N = 250 in the linkage equation.',
        mandatoryKeywords: ['N = 250', 'ΔNΦ']
      },
      {
        id: 'rub-p4',
        code: 'M1',
        title: 'Correct division by time in seconds (15 × 10⁻³ s)',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Divided by 15 rather than 15 × 10⁻³, giving an order-of-magnitude error of 1000×.',
        mandatoryKeywords: ['15 × 10⁻³', '0.015 s']
      },
      {
        id: 'rub-p5',
        code: 'A1',
        title: 'Final correct value of 1.2 V with correct SI unit',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Final answer incorrect and lacks unit V.',
        mandatoryKeywords: ['1.2 V', '1.2 Volts']
      }
    ],
    modelAnswer: `(i) Faraday's Law states that the magnitude of an induced electromotive force (e.m.f.) is directly proportional to the rate of change of magnetic flux linkage. [2 Marks]

(ii) Working:
Magnetic flux through one turn:
Φ = B × A = 0.18 T × (4.0 × 10⁻⁴ m²) = 7.2 × 10⁻⁵ Wb
Total initial magnetic flux linkage:
NΦ₁ = 250 × (7.2 × 10⁻⁵ Wb) = 1.8 × 10⁻² Wb (or 0.018 Wb-turns)
Final flux linkage NΦ₂ = 0
Change in flux linkage Δ(NΦ) = 1.8 × 10⁻² Wb

Time interval Δt = 15 ms = 15 × 10⁻³ s = 0.015 s
Induced e.m.f. E = Δ(NΦ) / Δt
E = 0.018 / 0.015 = 1.20 V

Final Answer: E = 1.2 V (or 1.20 V) [3 Marks]`,
    chiefExaminerSecretTip: 'When writing definitions, imagine an invisible checklist: (1) Directly proportional, (2) Rate of change, (3) Magnetic flux linkage. If any one of those three components is missing, the mark scheme awards 0 out of 2 immediately.'
  },
  {
    id: 'blunder-chem-02',
    title: 'Gibbs Free Energy & Spontaneity: The J vs kJ Classic Trap',
    subjectName: 'Chemistry',
    chapterName: 'Chemical Energetics & Thermodynamics',
    topicName: 'Gibbs Free Energy (ΔG = ΔH - TΔS)',
    examBoard: 'AQA / Edexcel & CBSE Senior Secondary',
    pastPaperYear: 'May/June 2022 Paper 1 Q5(c)',
    examFrequency: '🔥 Guaranteed Core (Appears in 92% of board exams)',
    trapCasualtyRate: 64, // 64% dropped marks
    isHotTopic: true,
    totalMarks: 4,
    fictionalStudentName: 'Zainab M.',
    fictionalStudentTargetGrade: 'Aiming for A*',
    studentActualScore: 1,
    questionText: `For the thermal decomposition of calcium carbonate:
CaCO₃(s) → CaO(s) + CO₂(g)
Given:
ΔH° = +178 kJ mol⁻¹
ΔS° = +161 J K⁻¹ mol⁻¹
(i) Calculate the value of ΔG° at 298 K. [3]
(ii) State whether the reaction is spontaneous at 298 K and justify your answer. [1]`,
    answerLines: [
      {
        id: 'line-chem-1',
        lineIndex: 0,
        text: 'Equation: ΔG = ΔH - TΔS',
        hasBlunder: false
      },
      {
        id: 'line-chem-2',
        lineIndex: 1,
        text: 'T = 298 K, ΔH = 178, ΔS = 161',
        hasBlunder: false
      },
      {
        id: 'line-chem-3',
        lineIndex: 2,
        text: 'ΔG = 178 - (298 × 161) = 178 - 47978 = -47800 kJ mol⁻¹',
        hasBlunder: true,
        blunderId: 'blunder-c1-1'
      },
      {
        id: 'line-chem-4',
        lineIndex: 3,
        text: 'Since ΔG is negative, the reaction is spontaneous at 298 K.',
        hasBlunder: true,
        blunderId: 'blunder-c1-2'
      }
    ],
    blunders: [
      {
        id: 'blunder-c1-1',
        lineIndex: 2,
        title: 'Mismatched Energy Units: Added kJ directly to J',
        category: 'careless_calc',
        severity: 'fatal',
        marksDeducted: 2,
        studentMistakeQuote: '"178 - (298 × 161) = -47800 kJ mol⁻¹"',
        whyStudentMadeIt: 'Substituted ΔH (+178 kJ) and ΔS (+161 J) without converting ΔS to kJ (÷ 1000).',
        examinerTrapAnalysis: 'This is the #1 most frequent trap in high school energetics. Examiners intentionally provide ΔH in kJ and ΔS in J to filter candidates who blindly plug numbers into calculators.',
        howToPrevent: 'Rule of Thumb: ALWAYS divide ΔS by 1000 before plugging into ΔG = ΔH - TΔS. Write: ΔS = 161 / 1000 = 0.161 kJ K⁻¹ mol⁻¹.',
        correctCorrection: 'ΔG = +178 - (298 × 0.161) = +178 - 47.98 = +130.0 kJ mol⁻¹.'
      },
      {
        id: 'blunder-c1-2',
        lineIndex: 3,
        title: 'Wrong Physical Conclusion on Spontaneity',
        category: 'concept_gap',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"Since ΔG is negative, the reaction is spontaneous at 298 K"',
        whyStudentMadeIt: 'Because their calculation incorrectly yielded -47,800, they concluded spontaneous, contradicting reality (limestone does NOT spontaneously decompose at room temperature!).',
        examinerTrapAnalysis: 'Even if the student applied follow-through logic, limestone decomposition requires a kiln (>800°C). A positive ΔG (+130 kJ/mol) means non-spontaneous at room temperature.',
        howToPrevent: 'Sanity check your answer: Does limestone turn to dust on the shelf at 25°C? No! So ΔG must be positive at 298 K.',
        correctCorrection: 'Non-spontaneous (or not feasible) at 298 K because ΔG° is POSITIVE (+130 kJ mol⁻¹).'
      }
    ],
    deconstructedRubric: [
      {
        id: 'rub-c1',
        code: 'M1',
        title: 'Conversion of ΔS to kJ K⁻¹ mol⁻¹ or ΔH to J mol⁻¹',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Did not divide ΔS by 1000. Forfeits M1.',
        mandatoryKeywords: ['divide by 1000', '0.161 kJ']
      },
      {
        id: 'rub-c2',
        code: 'M1',
        title: 'Correct substitution into ΔG = ΔH - TΔS at 298 K',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Incompatible unit substitution.',
        mandatoryKeywords: ['298 × 0.161']
      },
      {
        id: 'rub-c3',
        code: 'A1',
        title: 'Accurate value: +130 kJ mol⁻¹ (allow +130.0 to +130.2)',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Answer incorrect by 3 orders of magnitude.',
        mandatoryKeywords: ['+130 kJ mol⁻¹']
      },
      {
        id: 'rub-c4',
        code: 'B1',
        title: 'Non-spontaneous conclusion based on positive ΔG',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Stated spontaneous. Lost mark.',
        mandatoryKeywords: ['non-spontaneous', 'not feasible', 'ΔG > 0']
      }
    ],
    modelAnswer: `(i) Convert ΔS° to kJ K⁻¹ mol⁻¹:
ΔS° = 161 J K⁻¹ mol⁻¹ = 161 / 1000 = 0.161 kJ K⁻¹ mol⁻¹
Using ΔG° = ΔH° - TΔS° at T = 298 K:
ΔG° = +178 kJ mol⁻¹ - (298 K × 0.161 kJ K⁻¹ mol⁻¹)
ΔG° = +178 - 47.978
ΔG° = +130.0 kJ mol⁻¹ (or +130 kJ mol⁻¹) [3 Marks]

(ii) Spontaneity:
The reaction is NOT spontaneous (not feasible) at 298 K because ΔG° is positive (> 0). [1 Mark]`,
    chiefExaminerSecretTip: 'Always check the units of ΔH and ΔS before picking up your calculator. ΔH is almost always given in kJ, while ΔS is given in J. If you do not divide ΔS by 1000, you are mixing grams with kilograms.'
  },
  {
    id: 'blunder-math-03',
    title: 'Integration by Parts: The Missing Constant & Sign Flip',
    subjectName: 'Mathematics',
    chapterName: 'Calculus & Integration',
    topicName: 'Integration by Parts (∫ u v\' dx)',
    examBoard: 'Edexcel Pure Mathematics & CBSE Senior Secondary',
    pastPaperYear: 'Oct/Nov 2023 Paper 3 Q2',
    examFrequency: '🔥 Guaranteed Core (Appears in 95% of past papers)',
    trapCasualtyRate: 58,
    isHotTopic: true,
    totalMarks: 4,
    fictionalStudentName: 'Ali Raza',
    fictionalStudentTargetGrade: 'Aiming for Grade A',
    studentActualScore: 2,
    questionText: `Find the indefinite integral:
∫ x · e^(-2x) dx. [4 Marks]`,
    answerLines: [
      {
        id: 'line-m-1',
        lineIndex: 0,
        text: 'Let u = x  =>  du/dx = 1',
        hasBlunder: false
      },
      {
        id: 'line-m-2',
        lineIndex: 1,
        text: 'Let dv/dx = e^(-2x)  =>  v = -1/2 e^(-2x)',
        hasBlunder: false
      },
      {
        id: 'line-m-3',
        lineIndex: 2,
        text: 'Formula: ∫ u v\' dx = uv - ∫ v u\' dx',
        hasBlunder: false
      },
      {
        id: 'line-m-4',
        lineIndex: 3,
        text: '= -1/2 x e^(-2x) - ∫ (-1/2 e^(-2x)) dx',
        hasBlunder: false
      },
      {
        id: 'line-m-5',
        lineIndex: 4,
        text: '= -1/2 x e^(-2x) + 1/2 ∫ e^(-2x) dx = -1/2 x e^(-2x) + 1/4 e^(-2x)',
        hasBlunder: true,
        blunderId: 'blunder-m1-1'
      },
      {
        id: 'line-m-6',
        lineIndex: 5,
        text: 'Final Answer = -1/2 x e^(-2x) + 1/4 e^(-2x)',
        hasBlunder: true,
        blunderId: 'blunder-m1-2'
      }
    ],
    blunders: [
      {
        id: 'blunder-m1-1',
        lineIndex: 4,
        title: 'Sign Error when Integrating e^(-2x)',
        category: 'sign_error',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"+ 1/2 ∫ e^(-2x) dx = -1/2 x e^(-2x) + 1/4 e^(-2x)"',
        whyStudentMadeIt: 'Integrating e^(-2x) produces ANOTHER negative factor (-1/2), turning (+1/2) × (-1/2) into -1/4, but student wrote +1/4.',
        examinerTrapAnalysis: 'Double negative integration signs trip up 40% of candidates. A minus times a minus times another minus must result in a negative sign.',
        howToPrevent: 'Write the intermediate step explicitly: + 1/2 [ -1/2 e^(-2x) ] = - 1/4 e^(-2x). Never do sign arithmetic mentally.',
        correctCorrection: '-1/2 x e^(-2x) - 1/4 e^(-2x).'
      },
      {
        id: 'blunder-m1-2',
        lineIndex: 5,
        title: 'Omission of Constant of Integration (+ C)',
        category: 'careless_calc',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"Final Answer = -1/2 x e^(-2x) + 1/4 e^(-2x)"',
        whyStudentMadeIt: 'Focused on the algebra and forgot that indefinite integrals require + C.',
        examinerTrapAnalysis: 'In pure math papers, omitting "+ c" on an indefinite integral is an immediate deduction of the final accuracy mark [A1].',
        howToPrevent: 'As soon as the integral symbol ∫ disappears from your paper, write "+ C" in bold ink.',
        correctCorrection: '-1/2 x e^(-2x) - 1/4 e^(-2x) + C.'
      }
    ],
    deconstructedRubric: [
      {
        id: 'rub-m1',
        code: 'M1',
        title: 'Correct choice of u = x and v = -1/2 e^(-2x)',
        marksAllocated: 1,
        awardedToStudent: true,
        examinerRationale: 'Correctly assigned parts and calculated derivatives/integrals.',
        mandatoryKeywords: ['u = x', 'v = -1/2 e^(-2x)']
      },
      {
        id: 'rub-m2',
        code: 'M1',
        title: 'Correct integration by parts formula application',
        marksAllocated: 1,
        awardedToStudent: true,
        examinerRationale: 'Applied uv - ∫ v u\' dx accurately up to line 4.',
        mandatoryKeywords: ['uv - ∫ v du']
      },
      {
        id: 'rub-m3',
        code: 'A1',
        title: 'Correct integration of second term with proper negative sign (-1/4 e^(-2x))',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Sign flip error (+1/4 instead of -1/4).',
        mandatoryKeywords: ['-1/4 e^(-2x)']
      },
      {
        id: 'rub-m4',
        code: 'A1',
        title: 'Final simplified expression including constant of integration + C',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Missing "+ C" and wrong sign. Forfeits final accuracy mark.',
        mandatoryKeywords: ['+ C', '+ c']
      }
    ],
    modelAnswer: `Let u = x       =>   du/dx = 1
Let v' = e^(-2x) =>   v = ∫ e^(-2x) dx = -1/2 e^(-2x)

Using the Integration by Parts formula:
∫ u v' dx = u v - ∫ v u' dx

∫ x e^(-2x) dx = x · (-1/2 e^(-2x)) - ∫ (-1/2 e^(-2x)) · 1 dx
= -1/2 x e^(-2x) + 1/2 ∫ e^(-2x) dx
= -1/2 x e^(-2x) + 1/2 · (-1/2 e^(-2x)) + C
= -1/2 x e^(-2x) - 1/4 e^(-2x) + C  [or -1/4 e^(-2x) (2x + 1) + C]

Final Answer: -1/4 e^(-2x) (2x + 1) + C [4 Marks]`,
    chiefExaminerSecretTip: 'A common examiner rubric note states: "Accept any equivalent factorization, but deduct 1 mark immediately if the constant of integration (+ C) is missing on indefinite integrals."'
  },
  {
    id: 'blunder-bio-04',
    title: 'Osmosis & Water Potential: The "Concentration" Trap',
    subjectName: 'Biology',
    chapterName: 'Cell Structure & Transport',
    topicName: 'Osmosis & Water Potential (Ψ)',
    examBoard: 'Cambridge 9700 & Edexcel Biology',
    pastPaperYear: 'May/June 2023 Paper 21 Q2(a)',
    examFrequency: '🔥 Guaranteed Core (Appears in 84% of papers)',
    trapCasualtyRate: 74,
    isHotTopic: true,
    totalMarks: 4,
    fictionalStudentName: 'Sana Tariq',
    fictionalStudentTargetGrade: 'Aiming for Grade A*',
    studentActualScore: 1,
    questionText: `A cylinder of potato tissue is immersed in a concentrated sucrose solution (1.0 mol dm⁻³) for 2 hours.
Explain the change in mass and turgor of the potato cylinder using the concept of water potential. [4 Marks]`,
    answerLines: [
      {
        id: 'line-b-1',
        lineIndex: 0,
        text: 'Water moves from where there is high water concentration to where there is low water concentration.',
        hasBlunder: true,
        blunderId: 'blunder-b1-1'
      },
      {
        id: 'line-b-2',
        lineIndex: 1,
        text: 'The sucrose solution is hypertonic, so water goes into the solution by diffusion.',
        hasBlunder: false
      },
      {
        id: 'line-b-3',
        lineIndex: 2,
        text: 'The potato cells lose water and shrink.',
        hasBlunder: false
      },
      {
        id: 'line-b-4',
        lineIndex: 3,
        text: 'The cells become flaccid and eventually burst because of the water loss, so mass decreases.',
        hasBlunder: true,
        blunderId: 'blunder-b1-2'
      }
    ],
    blunders: [
      {
        id: 'blunder-b1-1',
        lineIndex: 0,
        title: 'Banned Phrasing: Used "Water Concentration" Instead of Water Potential (Ψ)',
        category: 'vague_keyword',
        severity: 'fatal',
        marksDeducted: 1,
        studentMistakeQuote: '"Water moves from where there is high water concentration"',
        whyStudentMadeIt: 'Used middle-school science vocabulary instead of senior secondary syllabus terminology.',
        examinerTrapAnalysis: 'The question explicitly prompted: "using the concept of water potential". Cambridge mark schemes explicitly state: "Reject \'water concentration\'. Must refer to water moving down a water potential gradient (from higher/less negative Ψ to lower/more negative Ψ)."',
        howToPrevent: 'NEVER use the phrase "water concentration". Always write: "from a higher (less negative) water potential to a lower (more negative) water potential across a partially permeable membrane".',
        correctCorrection: 'Water moves out of the potato cells down a water potential gradient, from a higher (less negative) water potential in the cells to a lower (more negative) water potential in the sucrose solution.'
      },
      {
        id: 'blunder-b1-2',
        lineIndex: 3,
        title: 'Biological Impossibility: Claimed Plant Cells "Burst" Upon Water Loss',
        category: 'concept_gap',
        severity: 'fatal',
        marksDeducted: 2,
        studentMistakeQuote: '"eventually burst because of the water loss"',
        whyStudentMadeIt: 'Confused animal cell lysis with plant cell plasmolysis.',
        examinerTrapAnalysis: 'Cells burst (lyse) when water ENTERS an animal cell with no cell wall. Losing water causes plant cells to become flaccid and PLASMOLYSED (protoplast pulls away from cell wall). Claiming plant cells burst from losing water forfeits both marks.',
        howToPrevent: 'Remember: Plant cells have a rigid cellulose cell wall. They NEVER burst from losing water; they plasmolyse.',
        correctCorrection: 'The cytoplasm shrinks away from the cell wall causing plasmolysis; the cells become flaccid, resulting in decreased mass and loss of turgor.'
      }
    ],
    deconstructedRubric: [
      {
        id: 'rub-b1',
        code: 'B1',
        title: 'Correct identification of water potential gradient (higher Ψ in cells than solution)',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Student wrote "water concentration". Reject.',
        mandatoryKeywords: ['higher water potential', 'less negative Ψ', 'down water potential gradient']
      },
      {
        id: 'rub-b2',
        code: 'B1',
        title: 'Reference to osmosis across a partially permeable cell surface membrane',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Wrote "by diffusion", failed to mention partially permeable membrane or osmosis.',
        mandatoryKeywords: ['partially permeable membrane', 'osmosis']
      },
      {
        id: 'rub-b3',
        code: 'B1',
        title: 'Description of water leaving cells leading to mass loss',
        marksAllocated: 1,
        awardedToStudent: true,
        examinerRationale: 'Identified water loss and mass reduction.',
        mandatoryKeywords: ['water leaves cells', 'loss of mass']
      },
      {
        id: 'rub-b4',
        code: 'B1',
        title: 'Correct state of cells: flaccid / plasmolysed (protoplast pulls away from wall)',
        marksAllocated: 1,
        awardedToStudent: false,
        examinerRationale: 'Claimed cells "burst", which is biologically incorrect for water-losing plant cells.',
        mandatoryKeywords: ['plasmolysed', 'flaccid', 'protoplast pulls away from cell wall']
      }
    ],
    modelAnswer: `1. The water potential (Ψ) inside the potato cells is higher (less negative) than the water potential of the concentrated 1.0 mol dm⁻³ sucrose solution. [1 Mark]

2. Water moves out of the potato cells down the water potential gradient by osmosis across the partially permeable cell surface membranes. [1 Mark]

3. As water is lost, volume decreases, causing a reduction in the mass of the potato cylinder. [1 Mark]

4. The vacuole shrinks and the protoplast pulls away from the cell wall; the cells become flaccid and plasmolysed, resulting in total loss of turgor pressure. [1 Mark]`,
    chiefExaminerSecretTip: 'Biology mark schemes contain strict "Do Not Accept" clauses: Reject "water concentration", reject "diffusion of water" (use osmosis), and reject "bursting" when water leaves a cell.'
  }
];
