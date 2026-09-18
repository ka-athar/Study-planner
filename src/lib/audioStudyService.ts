/**
 * Audio Study & Voice Flashcard Service
 * Powers hands-free audio quizzing, speech recognition answer evaluations,
 * and audio podcast study reviews using Web Speech APIs.
 */

// Speech Synthesis (Text to Speech)
export function speakText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    voice?: SpeechSynthesisVoice | null;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): { cancel: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this browser.');
    options?.onError?.(new Error('Speech synthesis not supported'));
    return { cancel: () => {} };
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate || 1.0;
  utterance.pitch = options?.pitch || 1.0;

  if (options?.voice) {
    utterance.voice = options.voice;
  } else {
    // Attempt to pick a natural sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')))) || voices.find(v => v.lang.startsWith('en'));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }
  }

  utterance.onend = () => {
    if (options?.onEnd) options.onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis utterance error:', e);
    if (options?.onError) options.onError(e);
  };

  window.speechSynthesis.speak(utterance);

  return {
    cancel: () => {
      window.speechSynthesis.cancel();
    }
  };
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Speech Recognition (Voice Input / Hands-Free)
export interface VoiceRecognitionOptions {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
  continuous?: boolean;
}

export function startVoiceRecognition(options: VoiceRecognitionOptions): { stop: () => void; isSupported: boolean } {
  if (typeof window === 'undefined') {
    return { stop: () => {}, isSupported: false };
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Speech recognition is not supported in this browser.');
    options.onError?.(new Error('Speech recognition not supported in this browser. Please use Chrome/Edge or manual controls.'));
    return { stop: () => {}, isSupported: false };
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      options.onResult(text, Boolean(finalTranscript));
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (options.onError) options.onError(event);
    };

    recognition.onend = () => {
      if (options.onEnd) options.onEnd();
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
      },
      isSupported: true
    };
  } catch (err) {
    console.error('Failed to initialize speech recognition:', err);
    options.onError?.(err);
    return { stop: () => {}, isSupported: false };
  }
}

/**
 * Compares a student's spoken voice answer to the flashcard answer.
 * Calculates similarity and returns structured verdict and spoken feedback.
 */
export function evaluateSpokenAnswer(spoken: string, expectedAnswer: string): {
  isCorrect: boolean;
  score: number; // 0 to 100
  feedbackSpoken: string;
  matchedKeywords: string[];
  missingKeywords: string[];
} {
  const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanSpoken = normalize(spoken);
  const cleanExpected = normalize(expectedAnswer);

  if (!cleanSpoken) {
    return {
      isCorrect: false,
      score: 0,
      feedbackSpoken: "I didn't hear an answer. Here is the correct answer: " + expectedAnswer,
      matchedKeywords: [],
      missingKeywords: []
    };
  }

  // Tokenize expected answer into meaningful keywords (excluding stop words)
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'that', 'it', 'with', 'for', 'by', 'as', 'are', 'be', 'this']);
  const expectedWords = cleanExpected.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  const spokenWords = new Set(cleanSpoken.split(' '));

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  expectedWords.forEach(word => {
    if (spokenWords.has(word) || cleanSpoken.includes(word)) {
      matchedKeywords.push(word);
    } else {
      missingKeywords.push(word);
    }
  });

  const matchRatio = expectedWords.length > 0 ? (matchedKeywords.length / expectedWords.length) : (cleanSpoken.length > 0 ? 1 : 0);
  const score = Math.round(matchRatio * 100);
  const isCorrect = score >= 50 || cleanSpoken.includes(cleanExpected) || cleanExpected.includes(cleanSpoken);

  let feedbackSpoken = '';
  if (score >= 80) {
    feedbackSpoken = "Spot on! That's correct.";
  } else if (score >= 50) {
    feedbackSpoken = "Good job! You got the core concept. The full answer is: " + expectedAnswer;
  } else {
    feedbackSpoken = "Nice try! The correct answer is: " + expectedAnswer;
  }

  return {
    isCorrect,
    score,
    feedbackSpoken,
    matchedKeywords,
    missingKeywords
  };
}

export interface AudioPodcastSection {
  title: string;
  durationSec: number;
  script: string;
}

export interface AudioPodcast {
  id: string;
  title: string;
  subjectName: string;
  chapterName: string;
  overview: string;
  totalDurationSec: number;
  sections: AudioPodcastSection[];
}

/**
 * Generates an audio review podcast script for a syllabus topic.
 */
export function generateTopicPodcastScript(subjectName: string, chapterName: string, topics: string[]): AudioPodcast {
  const topicsListStr = topics.slice(0, 4).join(', ');
  
  const sections: AudioPodcastSection[] = [
    {
      title: 'Introduction & Core Foundations',
      durationSec: 45,
      script: `Welcome to your StudyOS audio review for ${subjectName}, focusing on ${chapterName}. In this sprint, we are synthesizing the essential principles of ${topicsListStr}. Let's begin with the big picture and foundational rules.`
    },
    {
      title: 'Deep Dive: Key Mechanisms & Formulas',
      durationSec: 60,
      script: `Now diving into core mechanisms. When approaching exam questions on ${chapterName}, remember to first isolate the known variables. Watch out for classic traps like unit mismatches or sign errors in formulas. Always verify the physical or logical intuition behind your answer.`
    },
    {
      title: 'Active Recall Challenge',
      durationSec: 45,
      script: `Here is a quick mental check. In your head, define the primary rule governing ${topics[0] || chapterName}. If you can explain it simply to a peer in thirty seconds without consulting notes, you've achieved genuine mastery.`
    },
    {
      title: 'Summary & Next Steps',
      durationSec: 30,
      script: `That concludes our quick audio recap for ${chapterName}. For your next active step, open your Flashcard Arena or complete three practice problem sets to lock these concepts into long-term memory. Keep up the high focus!`
    }
  ];

  return {
    id: `podcast-${Date.now()}`,
    title: `${chapterName} Audio Masterclass`,
    subjectName,
    chapterName,
    overview: `High-yield audio review synthesizing ${topics.length} topics in ${chapterName}.`,
    totalDurationSec: sections.reduce((acc, s) => acc + s.durationSec, 0),
    sections
  };
}
