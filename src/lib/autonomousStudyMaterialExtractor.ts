/**
 * Autonomous Cognitive Study Material Extraction Engine
 * Resilient parser that guarantees complete curriculum hierarchy,
 * active recall flashcard decks, practice questions, and study tasks
 * from raw syllabus text, lecture notes, textbook chapters, or document dumps.
 */

export interface ExtractedStudySystem {
  overview: {
    title: string;
    executiveSummary: string;
    keyConceptsCovered: string[];
    recommendedWeeklyPace: string;
  };
  subjects: {
    id: string;
    name: string;
    language: 'en' | 'ur';
    icon: string;
    color: string;
    description: string;
    chapters: {
      id: string;
      name: string;
      topics: {
        id: string;
        name: string;
        status: string;
        estimatedMinutes: number;
        subtopics: { id: string; name: string; completed: boolean }[];
      }[];
    }[];
  }[];
  flashcardDecks: {
    id: string;
    title: string;
    subjectName: string;
    chapterName: string;
    topicName: string;
    description: string;
    cards: {
      id: string;
      front: string;
      back: string;
      mnemonic?: string;
      tags: string[];
    }[];
  }[];
  practiceQuestions: {
    id: string;
    type: 'mcq';
    topicName: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    hint: string;
  }[];
  studyTasks: {
    id: string;
    subjectName: string;
    chapterName: string;
    topicName: string;
    estimatedMinutes: number;
    priority: 'High' | 'Medium' | 'Low';
    reason: string;
  }[];
}

interface ExtractionOptions {
  text?: string;
  sourceTitle?: string;
  targetExamDate?: string;
  dailyHours?: number;
  generateSyllabus?: boolean;
  generateFlashcards?: boolean;
  generateQuestions?: boolean;
  generateTasks?: boolean;
}

const SUBJECT_PRESETS: { [key: string]: { icon: string; color: string } } = {
  physics: { icon: '⚛️', color: '#6366F1' },
  chemistry: { icon: '🧪', color: '#EC4899' },
  biology: { icon: '🧬', color: '#10B981' },
  math: { icon: '📐', color: '#3B82F6' },
  mathematics: { icon: '📐', color: '#3B82F6' },
  computer: { icon: '💻', color: '#8B5CF6' },
  history: { icon: '📜', color: '#F59E0B' },
  english: { icon: '📚', color: '#14B8A6' },
  urdu: { icon: '📖', color: '#059669' },
  economics: { icon: '📊', color: '#10B981' },
  psychology: { icon: '🧠', color: '#F43F5E' }
};

export function extractAutonomousStudyMaterialFallback(options: ExtractionOptions): ExtractedStudySystem {
  const {
    text = '',
    sourceTitle = 'Autonomous Study Ingestion',
    dailyHours = 3,
    generateSyllabus = true,
    generateFlashcards = true,
    generateQuestions = true,
    generateTasks = true
  } = options;

  const isUrdu = /[\u0600-\u06FF]/.test(text || sourceTitle);
  const lang = isUrdu ? 'ur' : 'en';

  // Clean raw lines
  const rawLines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('---'));

  // Detect subject
  let subjectName = sourceTitle.replace(/syllabus|notes|exam|curriculum|class|grade|\.pdf|\.docx|\.txt/gi, '').trim();
  if (!subjectName || subjectName.length < 3) {
    subjectName = isUrdu ? 'مطالعہ نصاب' : 'Core Curriculum';
  }

  // Pick appropriate icon & color
  let subjectIcon = '📚';
  let subjectColor = '#6B705C';
  const lowerSub = subjectName.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECT_PRESETS)) {
    if (lowerSub.includes(key) || text.toLowerCase().includes(key)) {
      subjectIcon = val.icon;
      subjectColor = val.color;
      break;
    }
  }

  // Parse chapters and topics
  interface ChapterTemp {
    name: string;
    topics: { name: string; subtopics: string[] }[];
  }

  const detectedChapters: ChapterTemp[] = [];
  let currentChapter: ChapterTemp | null = null;
  let currentTopic: { name: string; subtopics: string[] } | null = null;

  const chapterRegex = /^(?:chapter|unit|module|section|part|باب|حصہ)\s*([0-9ivx]+)?[:.\s-]*(.*)/i;
  const topicRegex = /^(?:topic|\d+\.\d+|\d+\)|•|-|\*)\s*(.*)/i;

  for (const line of rawLines) {
    const chapterMatch = line.match(chapterRegex);
    if (chapterMatch && line.length < 120) {
      if (currentTopic && currentChapter) {
        currentChapter.topics.push(currentTopic);
        currentTopic = null;
      }
      if (currentChapter) {
        detectedChapters.push(currentChapter);
      }
      const title = chapterMatch[2]?.trim() || line;
      currentChapter = {
        name: title.startsWith('Chapter') || title.startsWith('Unit') ? title : `Chapter: ${title}`,
        topics: []
      };
      continue;
    }

    if (line.startsWith('# ') || line.startsWith('## ')) {
      const heading = line.replace(/^#+\s*/, '').trim();
      if (currentTopic && currentChapter) {
        currentChapter.topics.push(currentTopic);
        currentTopic = null;
      }
      if (currentChapter) {
        detectedChapters.push(currentChapter);
      }
      currentChapter = {
        name: heading,
        topics: []
      };
      continue;
    }

    // Check if line looks like a topic
    if (line.length < 90 && (topicRegex.test(line) || line.includes(':') || line.endsWith('?'))) {
      const cleanName = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (cleanName.length > 2) {
        if (!currentChapter) {
          currentChapter = {
            name: isUrdu ? 'باب 1: بنیادی تصورات' : 'Chapter 1: Foundational Principles',
            topics: []
          };
        }
        if (currentTopic) {
          currentChapter.topics.push(currentTopic);
        }
        currentTopic = {
          name: cleanName,
          subtopics: []
        };
        continue;
      }
    }

    // Subtopic or sentence
    if (currentTopic && line.length < 140) {
      const subClean = line.replace(/^[-*•\s]+/, '').trim();
      if (subClean && subClean !== currentTopic.name) {
        currentTopic.subtopics.push(subClean);
      }
    }
  }

  // Push remaining
  if (currentTopic && currentChapter) {
    currentChapter.topics.push(currentTopic);
  }
  if (currentChapter) {
    detectedChapters.push(currentChapter);
  }

  // If no chapters detected, build standard structured chapters from sentences or lines
  if (detectedChapters.length === 0) {
    const candidateLines = rawLines.filter(l => l.length > 5 && l.length < 100);
    const sliceCount = Math.max(1, Math.ceil(candidateLines.length / 3));

    const ch1Topics = candidateLines.slice(0, sliceCount);
    const ch2Topics = candidateLines.slice(sliceCount, sliceCount * 2);
    const ch3Topics = candidateLines.slice(sliceCount * 2);

    detectedChapters.push({
      name: isUrdu ? 'باب 1: بنیادی اصول و تعریفات' : 'Chapter 1: Foundations & Core Concepts',
      topics: (ch1Topics.length > 0 ? ch1Topics : ['Introduction & Core Definitions', 'Key Theorems and Assumptions']).map(t => ({
        name: t,
        subtopics: ['Core Definitions', 'Historical Context & Relevance']
      }))
    });

    if (ch2Topics.length > 0) {
      detectedChapters.push({
        name: isUrdu ? 'باب 2: عملی اطلاقات و طریقہ کار' : 'Chapter 2: Methods & Mechanisms',
        topics: ch2Topics.map(t => ({
          name: t,
          subtopics: ['Mathematical / Physical Formulation', 'Experimental Verification']
        }))
      });
    }

    if (ch3Topics.length > 0) {
      detectedChapters.push({
        name: isUrdu ? 'باب 3: جدید مشق و امتحانی سوالات' : 'Chapter 3: Advanced Problems & Synthesis',
        topics: ch3Topics.map(t => ({
          name: t,
          subtopics: ['High-Yield Exam Scenarios', 'Formula Mastery']
        }))
      });
    }
  }

  // Build finalized curriculum tree
  const finalizedSubjects: ExtractedStudySystem['subjects'] = [];
  const finalizedFlashcards: ExtractedStudySystem['flashcardDecks'] = [];
  const finalizedQuestions: ExtractedStudySystem['practiceQuestions'] = [];
  const finalizedTasks: ExtractedStudySystem['studyTasks'] = [];
  const keyConcepts: string[] = [];

  let topicCounter = 1;
  let cardCounter = 1;
  let qCounter = 1;
  let taskCounter = 1;

  const subjectId = 'sub-auto-1';
  const chaptersFormatted = detectedChapters.map((ch, chIdx) => {
    const chapterId = `ch-auto-${chIdx + 1}`;
    const topicsFormatted = ch.topics.slice(0, 8).map((top, topIdx) => {
      const topicId = `top-auto-${topicCounter++}`;
      keyConcepts.push(top.name);

      // Flashcards for this topic
      if (generateFlashcards) {
        const deckId = `deck-auto-${topicCounter}`;
        const cards = [
          {
            id: `fc-${cardCounter++}`,
            front: isUrdu 
              ? `${top.name} کی بنیادی تعریف کیا ہے؟`
              : `What is the core principle behind ${top.name}?`,
            back: top.subtopics.length > 0
              ? `${top.name} encompasses: ${top.subtopics.join(', ')}.`
              : `${top.name} is a fundamental pillar of ${subjectName}, required for conceptual mastery and problem solving.`,
            mnemonic: `Recall: ${top.name.split(' ').map(w => w[0]?.toUpperCase()).join('')} Focus Hook`,
            tags: ['Core Concept', 'High-Yield']
          },
          {
            id: `fc-${cardCounter++}`,
            front: isUrdu
              ? `${top.name} کا اطلاق کیسے ہوتا ہے؟`
              : `How is ${top.name} applied or tested in exam problems?`,
            back: `Requires identifying key variables, applying the governing laws/formulas, and verifying boundary conditions.`,
            mnemonic: `Method: State Formula -> Insert Constants -> Calculate`,
            tags: ['Exam Technique', 'Application']
          }
        ];

        finalizedFlashcards.push({
          id: deckId,
          title: `${top.name} (Active Recall)`,
          subjectName: subjectName,
          chapterName: ch.name,
          topicName: top.name,
          description: `High-yield flashcard deck for ${top.name}`,
          cards
        });
      }

      // Practice Questions for this topic
      if (generateQuestions) {
        finalizedQuestions.push({
          id: `q-auto-${qCounter++}`,
          type: 'mcq',
          topicName: top.name,
          difficulty: 'Medium',
          question: isUrdu
            ? `درج ذیل میں سے کون سا بیان ${top.name} کی سب سے درست وضاحت کرتا ہے؟`
            : `Which of the following statements most accurately characterizes ${top.name}?`,
          options: [
            `It represents the primary mechanism governing system equilibrium and rate of change in ${top.name}.`,
            `It applies solely under zero temperature or static boundary conditions.`,
            `It is an empirical approximation with no underlying theoretical derivation.`,
            `It negates the fundamental conservation principles of ${subjectName}.`
          ],
          correctOptionIndex: 0,
          explanation: `Option A is correct because ${top.name} establishes the governing relationship under standard physical/academic constraints. The other options introduce factual falsehoods.`,
          hint: `Consider how ${top.name} relates to equilibrium and the primary definitions covered in ${ch.name}.`
        });
      }

      // Study Tasks for this topic
      if (generateTasks) {
        finalizedTasks.push({
          id: `task-auto-${taskCounter++}`,
          subjectName: subjectName,
          chapterName: ch.name,
          topicName: top.name,
          estimatedMinutes: 45,
          priority: topIdx === 0 ? 'High' : 'Medium',
          reason: `Foundational topic in ${ch.name}. Master core flashcards and solve practice questions.`
        });
      }

      return {
        id: topicId,
        name: top.name,
        status: 'Not Started',
        estimatedMinutes: 45,
        subtopics: (top.subtopics.length > 0 ? top.subtopics : ['Core Definition', 'Key Properties & Rules', 'Practice Drills']).map((s, sIdx) => ({
          id: `subtop-${topicId}-${sIdx + 1}`,
          name: s,
          completed: false
        }))
      };
    });

    return {
      id: chapterId,
      name: ch.name,
      topics: topicsFormatted
    };
  });

  if (generateSyllabus) {
    finalizedSubjects.push({
      id: subjectId,
      name: subjectName,
      language: lang,
      icon: subjectIcon,
      color: subjectColor,
      description: `Autonomously synthesized curriculum for ${subjectName} with structured chapters and topics.`,
      chapters: chaptersFormatted
    });
  }

  const uniqueConcepts = Array.from(new Set(keyConcepts)).slice(0, 8);

  return {
    overview: {
      title: sourceTitle || subjectName,
      executiveSummary: isUrdu
        ? `آپ کے فراہم کردہ مواد سے ${subjectName} کا مکمل خودکار مطالعہ کا نظام تیار کر لیا گیا ہے۔`
        : `Autonomously ingested study system for ${subjectName}. Includes structured curriculum, ${finalizedFlashcards.length} active-recall decks, ${finalizedQuestions.length} practice questions, and ${finalizedTasks.length} prioritized study tasks.`,
      keyConceptsCovered: uniqueConcepts.length > 0 ? uniqueConcepts : ['Core Principles', 'Methods & Frameworks', 'Exam Synthesis'],
      recommendedWeeklyPace: `${dailyHours * 5} hours / week`
    },
    subjects: finalizedSubjects,
    flashcardDecks: finalizedFlashcards,
    practiceQuestions: finalizedQuestions,
    studyTasks: finalizedTasks
  };
}
