/**
 * Google Keep Integration & Study Note Bridge
 * Generates Keep-ready study checklists, active recall decks, formula cards,
 * and handles direct export and seamless web linking to Google Keep.
 */

import { StudyPlan, Subject, RevisionItem, FlashcardDeck } from '../types';

export interface KeepStudyNoteDraft {
  id: string;
  title: string;
  category: 'checklist' | 'formula' | 'summary' | 'recall' | 'daily_agenda';
  content: string;
  color?: string; // Yellow, Blue, Green, Red, Purple, etc.
  createdAt: string;
}

/**
 * Formats a Study Plan into a clean Google Keep checklist.
 */
export function formatPlanForGoogleKeep(plan: StudyPlan): { title: string; content: string } {
  const dateStr = plan.date ? new Date(plan.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today';
  const title = `📚 Study Plan: ${plan.title || 'Today'} · ${dateStr}`;
  
  const lines: string[] = [
    `🎯 Daily Goal: ${plan.title}`,
    `⏱️ Allocated Target: ${plan.availableHours || 2} hrs`,
    `💡 Focus Reasoning: ${plan.reasoning || 'Academic schedule focus'}`,
    '',
    'Checklist Tasks:'
  ];

  (plan.topics || []).forEach(t => {
    const box = t.completed ? '[x]' : '[ ]';
    lines.push(`${box} [${t.subjectName}] ${t.topicName} (~${t.estimatedMinutes}m) - Priority: ${t.priority}`);
  });

  return {
    title,
    content: lines.join('\n')
  };
}

/**
 * Formats a Subject Chapter/Topic list into a Google Keep Syllabus Checklist.
 */
export function formatSyllabusForGoogleKeep(subject: Subject): { title: string; content: string } {
  const title = `📑 Syllabus Tracker: ${subject.name}`;
  const lines: string[] = [
    `🎓 Subject: ${subject.name}`,
    subject.description ? `📝 Description: ${subject.description}` : '',
    '',
    'Chapters & Topics:'
  ];

  subject.chapters.forEach(ch => {
    lines.push(`\n📌 ${ch.name}:`);
    ch.topics.forEach(tp => {
      const mark = tp.status === 'Completed' || tp.status === 'Mastered' ? '☑' : '☐';
      lines.push(`  ${mark} ${tp.name} (Status: ${tp.status})`);
    });
  });

  return {
    title,
    content: lines.join('\n')
  };
}

/**
 * Formats a Flashcard Deck for Google Keep.
 */
export function formatFlashcardDeckForGoogleKeep(deck: FlashcardDeck): { title: string; content: string } {
  const title = `📇 Flashcards: ${deck.title} (${deck.subjectName})`;
  const lines: string[] = [
    `🏷️ Subject: ${deck.subjectName} · Total Cards: ${deck.cards.length}`,
    deck.description ? `📝 ${deck.description}` : '',
    '',
    '--- FLASHCARD DECK ---'
  ];

  deck.cards.forEach((card, idx) => {
    lines.push(`\nQ${idx + 1}: ${card.front}`);
    lines.push(`A${idx + 1}: ${card.back}`);
    if (card.mnemonic) {
      lines.push(`💡 Memory Aid: ${card.mnemonic}`);
    }
  });

  return {
    title,
    content: lines.join('\n')
  };
}

/**
 * Formats Spaced Revisions due today into a Google Keep checklist.
 */
export function formatRevisionsForGoogleKeep(revisions: RevisionItem[]): { title: string; content: string } {
  const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const title = `🔄 Spaced Revisions Queue: ${todayStr}`;
  const lines: string[] = [
    'Spaced Repetition Review Tasks:',
    ''
  ];

  revisions.forEach(rev => {
    const box = rev.status === 'Completed' ? '[x]' : '[ ]';
    lines.push(`${box} ${rev.topicName} (${rev.subjectName}) - Priority: ${rev.priority} (Due: ${rev.dueDate})`);
  });

  return {
    title,
    content: lines.join('\n')
  };
}

/**
 * Copies note content to clipboard and triggers opening Google Keep in a new tab.
 */
export async function copyAndOpenGoogleKeep(note: { title: string; content: string }): Promise<boolean> {
  try {
    const fullText = `${note.title}\n\n${note.content}`;
    await navigator.clipboard.writeText(fullText);
    
    // Open Google Keep
    window.open('https://keep.google.com/', '_blank');
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    window.open('https://keep.google.com/', '_blank');
    return false;
  }
}
