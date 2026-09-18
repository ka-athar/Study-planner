/**
 * Study Kit & PDF Cheat Sheet Export Service
 * Formats high-yield printable study kits, cram sheets, formula references, and wall planners.
 */

import { Subject, FlashcardDeck, StudyPlan, UserProfile, RevisionItem } from '../types';

export type StudyKitFormat = 'cram_sheet' | 'wall_planner' | 'formula_sheet' | 'flashcard_cutouts';

export interface StudyKitExportOptions {
  format: StudyKitFormat;
  selectedSubjectNames: string[];
  includeFormulas: boolean;
  includeMnemonics: boolean;
  includeFlashcards: boolean;
  includeExams: boolean;
  columns: 1 | 2 | 3;
  fontSize: 'compact' | 'standard' | 'large';
  title?: string;
  notes?: string;
}

/**
 * Builds printable HTML document styled specifically for A4/Letter printer output & PDF export.
 */
export function generatePrintableStudyKitHtml(
  options: StudyKitExportOptions,
  data: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    plans: StudyPlan[];
    userProfile: UserProfile | null;
    revisions: RevisionItem[];
  }
): string {
  const {
    format,
    selectedSubjectNames,
    includeFormulas,
    includeMnemonics,
    includeFlashcards,
    includeExams,
    columns = 2,
    fontSize = 'standard',
    title,
    notes
  } = options;

  const { subjects, flashcardDecks, plans, userProfile } = data;
  const filteredSubjects = selectedSubjectNames.length > 0
    ? subjects.filter(s => selectedSubjectNames.includes(s.name))
    : subjects;

  const filteredDecks = selectedSubjectNames.length > 0
    ? flashcardDecks.filter(d => selectedSubjectNames.includes(d.subjectName))
    : flashcardDecks;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const studentName = userProfile?.displayName || 'Student';
  const academicYear = userProfile?.academicYear || '2026-2027';

  let bodyContent = '';

  if (format === 'cram_sheet') {
    bodyContent = `
      <div class="header-band">
        <div class="badge">ACADEMIC CRAM SHEET & REVISION CHEAT SHEET</div>
        <h1>${title || 'High-Yield Exam Cram Sheet'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Academic Year:</strong> ${academicYear}</span>
          <span><strong>Generated:</strong> ${todayFormatted}</span>
          <span><strong>Subjects:</strong> ${filteredSubjects.map(s => s.name).join(', ') || 'All'}</span>
        </div>
      </div>

      ${notes ? `<div class="focus-callout"><strong>Focus Directive:</strong> ${notes}</div>` : ''}

      ${includeExams && userProfile?.examDates && userProfile.examDates.length > 0 ? `
        <div class="section">
          <h2 class="section-title">🎯 Upcoming Target Exams & Milestones</h2>
          <div class="exam-grid">
            ${userProfile.examDates.map(ex => `
              <div class="exam-card">
                <strong>${ex.examName}</strong> (${ex.subjectName})
                <div class="exam-date">Date: ${ex.date}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="masonry-grid cols-${columns}">
        ${filteredSubjects.map(sub => `
          <div class="subject-card">
            <div class="subject-header">
              <h3>${sub.name}</h3>
              <span class="sub-badge">${sub.chapters.length} Chapters</span>
            </div>
            
            ${sub.chapters.map(ch => `
              <div class="chapter-block">
                <div class="chapter-name">📖 ${ch.name}</div>
                <ul class="topic-list">
                  ${ch.topics.map(t => `
                    <li class="topic-item">
                      <span class="checkbox-box"></span>
                      <span class="topic-title"><strong>${t.name}</strong></span>
                      ${t.status ? `<span class="confidence-tag">${t.status}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        `).join('')}

        ${includeFlashcards && filteredDecks.length > 0 ? `
          <div class="subject-card flashcard-summary">
            <div class="subject-header">
              <h3>⚡ Quick Flashcard Recall Matrix</h3>
              <span class="sub-badge">${filteredDecks.reduce((acc, d) => acc + d.cards.length, 0)} Total Cards</span>
            </div>
            <div class="flashcard-rows">
              ${filteredDecks.flatMap(d => d.cards.map(c => ({ ...c, deckTitle: d.title, subject: d.subjectName }))).slice(0, 16).map(c => `
                <div class="qa-item">
                  <div class="q-text"><strong>Q:</strong> ${c.front}</div>
                  <div class="a-text"><strong>A:</strong> ${c.back}</div>
                  ${includeMnemonics && c.mnemonic ? `<div class="m-text">💡 <em>${c.mnemonic}</em></div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (format === 'wall_planner') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const activePlan = plans[0];

    bodyContent = `
      <div class="header-band">
        <div class="badge">STUDYOS WEEKLY WALL PLANNER</div>
        <h1>${title || 'Weekly Master Study & Focus Schedule'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Target:</strong> ${userProfile?.targetHoursPerDay || 3} hrs/day</span>
          <span><strong>Week of:</strong> ${todayFormatted}</span>
        </div>
      </div>

      ${notes ? `<div class="focus-callout"><strong>Weekly Target:</strong> ${notes}</div>` : ''}

      <div class="wall-grid">
        ${days.map((day, idx) => `
          <div class="day-column">
            <div class="day-header">
              <h4>${day}</h4>
              <span class="day-sub">Day ${idx + 1}</span>
            </div>
            <div class="day-body">
              <div class="slot-block">
                <div class="slot-label">🌅 Morning Core Block</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
              </div>
              <div class="slot-block">
                <div class="slot-label">☀️ Afternoon Problem Sprints</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
              </div>
              <div class="slot-block">
                <div class="slot-label">🌙 Evening Flashcard Review</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> Active Recall & Spaced Rep</div>
              </div>
              <div class="day-footer">
                <span>Target: 3.0h</span>
                <span>Actual: ___h</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="wall-footer">
        <div class="checklist-box-group">
          <strong>Weekly Habit Checklist:</strong>
          <span class="checkbox-row"><span class="checkbox-box"></span> 7:30 AM Briefing Reviewed</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Daily Test Diagnostics Checked</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Google Drive Vault Synced</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Mock Exam Completed</span>
        </div>
        <div class="signature-box">
          <div>Parent / Advisor / Self Verification: _________________________</div>
        </div>
      </div>
    `;
  } else if (format === 'formula_sheet') {
    bodyContent = `
      <div class="header-band">
        <div class="badge">QUICK-REFERENCE CHEAT SHEET</div>
        <h1>${title || 'Key Formulas, Definitions & Mnemonics'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Date:</strong> ${todayFormatted}</span>
        </div>
      </div>

      <div class="masonry-grid cols-${columns}">
        ${filteredSubjects.map(s => `
          <div class="subject-card">
            <div class="subject-header">
              <h3>${s.name} Reference Sheet</h3>
            </div>
            <div class="formula-list">
              ${s.chapters.map(c => `
                <div class="formula-group">
                  <div class="formula-group-title">${c.name}</div>
                  <div class="formula-row">
                    <strong>Core Law / Principle:</strong> Fundamental definitions for ${c.topics.map(t => t.name).slice(0, 3).join(', ')}
                  </div>
                  <div class="formula-row">
                    <strong>Key Equations:</strong> ΔE = mc² • F = ma • PV = nRT • V = IR
                  </div>
                  <div class="formula-row">
                    <strong>Common Trap:</strong> Check unit conversions (SI units: kg, m, s, A, K, mol).
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Flashcard Cutouts
    bodyContent = `
      <div class="header-band">
        <div class="badge">PRINTABLE POCKET FLASHCARDS</div>
        <h1>${title || 'Pocket Revision Flashcard Cutouts'}</h1>
        <div class="meta-row">
          <span>Cut along dashed lines to make portable flashcards</span>
        </div>
      </div>

      <div class="cutout-grid">
        ${filteredDecks.flatMap(d => d.cards.map(c => ({ ...c, subject: d.subjectName }))).map((c, i) => `
          <div class="cutout-card">
            <div class="card-side front">
              <span class="card-tag">CARD #${i + 1} • ${c.subject}</span>
              <div class="card-main">${c.front}</div>
            </div>
            <div class="card-side back">
              <span class="card-tag">ANSWER / RECALL</span>
              <div class="card-main">${c.back}</div>
              ${c.mnemonic ? `<div class="card-mnemonic">💡 ${c.mnemonic}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || 'StudyOS Printable Study Kit'}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 12mm 12mm 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1F2937;
      background-color: #FFFFFF;
      margin: 0;
      padding: 16px;
      font-size: ${fontSize === 'compact' ? '11px' : fontSize === 'large' ? '14px' : '12px'};
      line-height: 1.45;
    }
    .header-band {
      border-bottom: 2px solid #374151;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background-color: #4B5563;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    h1 {
      margin: 2px 0 6px 0;
      font-size: 20px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.5px;
    }
    h2, h3, h4 {
      margin: 0;
      color: #1F2937;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 11px;
      color: #4B5563;
    }
    .focus-callout {
      background-color: #F3F4F6;
      border-left: 4px solid #4B5563;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .masonry-grid {
      display: grid;
      gap: 12px;
    }
    .masonry-grid.cols-1 { grid-template-columns: 1fr; }
    .masonry-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .masonry-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }

    .subject-card {
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 10px 12px;
      background: #FFFFFF;
      break-inside: avoid;
    }
    .subject-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .subject-header h3 {
      font-size: 14px;
      font-weight: 700;
    }
    .sub-badge {
      font-size: 9px;
      background: #E5E7EB;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .chapter-block {
      margin-bottom: 8px;
    }
    .chapter-name {
      font-weight: 700;
      font-size: 11px;
      color: #374151;
      margin-bottom: 4px;
    }
    .topic-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .topic-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
      font-size: 11px;
    }
    .checkbox-box {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.5px solid #6B7280;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .confidence-tag {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: #F3F4F6;
      color: #4B5563;
    }
    .exam-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .exam-card {
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 8px;
      background: #F9FAFB;
      font-size: 11px;
    }
    .exam-date {
      color: #B91C1C;
      font-weight: 700;
      margin-top: 2px;
    }
    .qa-item {
      border-bottom: 1px dashed #E5E7EB;
      padding: 4px 0;
      font-size: 11px;
    }
    .q-text { color: #111827; }
    .a-text { color: #047857; margin-top: 2px; }
    .m-text { color: #B45309; font-size: 10px; margin-top: 2px; }

    /* Wall planner */
    .wall-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .day-column {
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 380px;
    }
    .day-header {
      background: #F3F4F6;
      border-bottom: 1px solid #D1D5DB;
      padding: 6px 4px;
      text-align: center;
    }
    .day-header h4 { font-size: 11px; }
    .day-sub { font-size: 9px; color: #6B7280; }
    .day-body {
      padding: 6px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 10px;
    }
    .slot-block { margin-bottom: 8px; }
    .slot-label { font-weight: 700; color: #4B5563; font-size: 9px; margin-bottom: 2px; }
    .checkbox-row { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
    .day-footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: bold;
    }
    .wall-footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #D1D5DB;
      padding-top: 8px;
      font-size: 10px;
    }
    .checklist-box-group { display: flex; flex-direction: column; gap: 4px; }
    .signature-box { align-self: flex-end; }

    /* Cutouts */
    .cutout-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .cutout-card {
      border: 1.5px dashed #9CA3AF;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      break-inside: avoid;
    }
    .card-side { padding: 6px; border-radius: 4px; background: #F9FAFB; }
    .card-tag { font-size: 8px; font-weight: 800; color: #6B7280; }
    .card-main { font-size: 12px; font-weight: 700; margin: 4px 0; }
    .card-mnemonic { font-size: 10px; color: #B45309; }

    /* No-print controls when viewed in browser */
    @media screen {
      body {
        max-width: 900px;
        margin: 20px auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        border-radius: 12px;
      }
      .screen-controls {
        position: sticky;
        top: 0;
        background: #111827;
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 100;
      }
      .print-btn {
        background: #10B981;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      }
    }
    @media print {
      .screen-controls { display: none !important; }
      body { padding: 0; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="screen-controls">
    <div><strong>StudyOS Printable Study Kit Preview</strong> (Press button or Ctrl+P / ⌘+P to Print / Save as PDF)</div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save to PDF</button>
  </div>
  ${bodyContent}
</body>
</html>
  `.trim();
}

/**
 * Opens printable document directly in a new window and triggers print dialog.
 */
export function openStudyKitPrintWindow(
  options: StudyKitExportOptions,
  data: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    plans: StudyPlan[];
    userProfile: UserProfile | null;
    revisions: RevisionItem[];
  }
) {
  const html = generatePrintableStudyKitHtml(options, data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
