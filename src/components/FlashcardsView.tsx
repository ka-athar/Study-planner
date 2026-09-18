import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Sparkles, 
  Plus, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Volume2, 
  VolumeX, 
  Award, 
  BookOpen, 
  Trash2, 
  Edit3, 
  Play, 
  Filter, 
  ArrowLeft, 
  Layers, 
  Flame, 
  ChevronRight, 
  HelpCircle,
  Maximize2,
  Minimize2,
  Check,
  X,
  Headphones,
  Printer,
  Mic
} from 'lucide-react';
import { FlashcardDeck, Flashcard, Subject } from '../types';
import { apiGenerateFlashcards } from '../lib/aiApi';

interface FlashcardsViewProps {
  subjects: Subject[];
  decks: FlashcardDeck[];
  onSaveDeck: (deck: FlashcardDeck) => void;
  onDeleteDeck: (deckId: string) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onOpenAudioStudy?: (deckId?: string) => void;
  onOpenPrintKit?: () => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  subjects,
  decks,
  onSaveDeck,
  onDeleteDeck,
  onStartTimerForTopic,
  onOpenAudioStudy,
  onOpenPrintKit
}) => {
  // Navigation & Mode
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Review Arena State
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [reviewSessionStats, setReviewSessionStats] = useState<{
    reviewedCount: number;
    againCount: number;
    hardCount: number;
    goodCount: number;
    masteredCount: number;
  }>({ reviewedCount: 0, againCount: 0, hardCount: 0, goodCount: 0, masteredCount: 0 });
  const [reviewCompleted, setReviewCompleted] = useState<boolean>(false);

  // AI Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiSubject, setAiSubject] = useState<string>(subjects[0]?.name || 'Physics');
  const [aiChapter, setAiChapter] = useState<string>('');
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(8);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Mixed'>('Mixed');
  const [aiWeakFocus, setAiWeakFocus] = useState<boolean>(false);
  const [aiNotes, setAiNotes] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiGenError, setAiGenError] = useState<string>('');

  // Manual Deck / Card Creation Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualSubject, setManualSubject] = useState<string>(subjects[0]?.name || '');
  const [manualChapter, setManualChapter] = useState<string>('');
  const [manualTopic, setManualTopic] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualCards, setManualCards] = useState<{ front: string; back: string; mnemonic?: string }[]>([
    { front: '', back: '', mnemonic: '' }
  ]);

  // Audio / Speech State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Setup AI modal chapter/topic default updates
  useEffect(() => {
    const subObj = subjects.find(s => s.name === aiSubject);
    if (subObj && subObj.chapters.length > 0) {
      setAiChapter(subObj.chapters[0].name);
      if (subObj.chapters[0].topics.length > 0) {
        setAiTopic(subObj.chapters[0].topics[0].name);
      }
    }
  }, [aiSubject, subjects]);

  useEffect(() => {
    const subObj = subjects.find(s => s.name === aiSubject);
    const chObj = subObj?.chapters.find(c => c.name === aiChapter);
    if (chObj && chObj.topics.length > 0) {
      setAiTopic(chObj.topics[0].name);
    }
  }, [aiChapter]);

  // Keyboard navigation for review mode (Space to flip, 1-4 for ratings)
  useEffect(() => {
    if (!isReviewing || !selectedDeck || reviewCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRateCard('again');
        else if (e.key === '2') handleRateCard('hard');
        else if (e.key === '3') handleRateCard('good');
        else if (e.key === '4') handleRateCard('mastered');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewing, isFlipped, selectedDeck, currentCardIndex, reviewCompleted]);

  // Text to speech function
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Start Reviewing a Deck
  const handleStartReview = (deck: FlashcardDeck) => {
    setSelectedDeck(deck);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setReviewCompleted(false);
    setReviewSessionStats({
      reviewedCount: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      masteredCount: 0
    });
    setIsReviewing(true);
  };

  // Rate card with SM-2 Spaced Repetition logic
  const handleRateCard = (rating: 'again' | 'hard' | 'good' | 'mastered') => {
    if (!selectedDeck || currentCardIndex >= selectedDeck.cards.length) return;

    const currentCard = selectedDeck.cards[currentCardIndex];
    let newInterval = currentCard.intervalDays || 1;
    let newEase = currentCard.easeFactor || 2.5;
    let newRepetitions = (currentCard.repetitions || 0) + 1;
    let isMastered = currentCard.mastered || false;

    if (rating === 'again') {
      newInterval = 1;
      newEase = Math.max(1.3, newEase - 0.2);
      newRepetitions = 0;
      isMastered = false;
      setReviewSessionStats(p => ({ ...p, againCount: p.againCount + 1, reviewedCount: p.reviewedCount + 1 }));
    } else if (rating === 'hard') {
      newInterval = Math.max(2, Math.round(newInterval * 1.2));
      newEase = Math.max(1.3, newEase - 0.15);
      setReviewSessionStats(p => ({ ...p, hardCount: p.hardCount + 1, reviewedCount: p.reviewedCount + 1 }));
    } else if (rating === 'good') {
      newInterval = Math.max(4, Math.round(newInterval * newEase));
      setReviewSessionStats(p => ({ ...p, goodCount: p.goodCount + 1, reviewedCount: p.reviewedCount + 1 }));
    } else if (rating === 'mastered') {
      newInterval = Math.max(14, Math.round(newInterval * newEase * 1.5));
      newEase = newEase + 0.15;
      isMastered = true;
      setReviewSessionStats(p => ({ ...p, masteredCount: p.masteredCount + 1, reviewedCount: p.reviewedCount + 1 }));
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);

    const updatedCards = [...selectedDeck.cards];
    updatedCards[currentCardIndex] = {
      ...currentCard,
      intervalDays: newInterval,
      easeFactor: newEase,
      repetitions: newRepetitions,
      mastered: isMastered,
      nextReviewDate: nextDate.toISOString().split('T')[0],
      lastReviewedAt: new Date().toISOString()
    };

    const updatedDeck = { ...selectedDeck, cards: updatedCards, updatedAt: new Date().toISOString() };
    setSelectedDeck(updatedDeck);
    onSaveDeck(updatedDeck);

    // Transition to next card or complete
    if (currentCardIndex + 1 < selectedDeck.cards.length) {
      setIsFlipped(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setReviewCompleted(true);
    }
  };

  // Generate AI Flashcards
  const handleGenerateAiDeck = async () => {
    setIsGeneratingAi(true);
    setAiGenError('');
    try {
      const response = await apiGenerateFlashcards({
        subjectName: aiSubject,
        chapterName: aiChapter,
        topicName: aiTopic,
        notesOrContext: aiNotes,
        count: aiCount,
        difficulty: aiDifficulty,
        isWeakTopicFocus: aiWeakFocus
      });

      if (response.cards && response.cards.length > 0) {
        const newDeck: FlashcardDeck = {
          id: `deck-${Date.now()}`,
          title: response.deckTitle || `${aiTopic || aiChapter || aiSubject} High-Yield Deck`,
          subjectName: aiSubject,
          chapterName: aiChapter,
          topicName: aiTopic,
          description: response.description || `AI generated ${response.cards.length} active recall cards.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isWeakTopicDeck: aiWeakFocus,
          cards: response.cards.map((c: any, idx: number) => ({
            id: `fc-${Date.now()}-${idx}`,
            front: c.front,
            back: c.back,
            mnemonic: c.mnemonic,
            tags: c.tags || ['High-Yield'],
            easeFactor: 2.5,
            intervalDays: 1,
            repetitions: 0,
            nextReviewDate: new Date().toISOString().split('T')[0]
          }))
        };

        onSaveDeck(newDeck);
        setIsAiModalOpen(false);
        setAiNotes('');
        handleStartReview(newDeck);
      } else {
        setAiGenError('No flashcards were generated. Please try adjusting your topic or prompt.');
      }
    } catch (err: any) {
      setAiGenError(err?.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Save manual deck
  const handleSaveManualDeck = () => {
    if (!manualTitle.trim()) {
      alert('Please provide a title for your flashcard deck.');
      return;
    }
    const validCards = manualCards.filter(c => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      alert('Please add at least 1 card with both a front and back.');
      return;
    }

    const newDeck: FlashcardDeck = {
      id: `deck-man-${Date.now()}`,
      title: manualTitle.trim(),
      subjectName: manualSubject,
      chapterName: manualChapter,
      topicName: manualTopic,
      description: manualDescription.trim() || `${validCards.length} custom active recall cards.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cards: validCards.map((c, idx) => ({
        id: `fc-m-${Date.now()}-${idx}`,
        front: c.front.trim(),
        back: c.back.trim(),
        mnemonic: c.mnemonic?.trim(),
        tags: ['Custom'],
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 0,
        nextReviewDate: new Date().toISOString().split('T')[0]
      }))
    };

    onSaveDeck(newDeck);
    setIsManualModalOpen(false);
    setManualTitle('');
    setManualDescription('');
    setManualCards([{ front: '', back: '', mnemonic: '' }]);
  };

  // Collect weak topics from syllabus for 1-click generation
  const weakTopicsList: { subject: string; chapter: string; topic: string }[] = [];
  subjects.forEach(s => {
    s.chapters.forEach(c => {
      c.topics.forEach(t => {
        if (t.status === 'Weak' || t.status === 'Needs Revision') {
          weakTopicsList.push({ subject: s.name, chapter: c.name, topic: t.name });
        }
      });
    });
  });

  // Filtered decks
  const filteredDecks = subjectFilter === 'ALL'
    ? decks
    : decks.filter(d => d.subjectName === subjectFilter);

  // Global flashcard stats
  const totalCards = decks.reduce((acc, d) => acc + d.cards.length, 0);
  const masteredCards = decks.reduce((acc, d) => acc + d.cards.filter(c => c.mastered).length, 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const dueCards = decks.reduce((acc, d) => acc + d.cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= todayStr).length, 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-[#6B705C]/10 text-[#6B705C]">
              <Brain className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-serif italic font-bold text-[#6B705C]">
              Active Recall & Flashcard Deck Arena
            </h2>
          </div>
          <p className="text-xs text-[#A5A58D]">
            Master high-yield concepts, formulas, and weak topics with AI-crafted active recall flashcards and SM-2 spaced repetition.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenAudioStudy && (
            <button
              onClick={() => onOpenAudioStudy()}
              className="px-3.5 py-2 bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold rounded-full flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-2xs"
              title="Hands-Free Voice Flashcards & Spoken Answer Evaluations"
            >
              <Mic className="w-3.5 h-3.5 text-primary" />
              <span>Voice Arena</span>
            </button>
          )}

          {onOpenPrintKit && (
            <button
              onClick={onOpenPrintKit}
              className="px-3.5 py-2 bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold rounded-full flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-2xs"
              title="Export Printable Pocket Flashcards & Cheat Sheets"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span>Print Cards</span>
            </button>
          )}

          <button
            onClick={() => {
              setAiWeakFocus(false);
              setIsAiModalOpen(true);
            }}
            className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate AI Deck</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2 bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold rounded-full flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Custom Deck</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Active Decks</div>
          <div className="text-2xl font-bold font-serif text-[#4A4E4D] mt-1">{decks.length}</div>
          <div className="text-[11px] text-[#6B705C] font-medium">{subjects.length} subjects covered</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Total Flashcards</div>
          <div className="text-2xl font-bold font-serif text-[#4A4E4D] mt-1">{totalCards}</div>
          <div className="text-[11px] text-[#6B705C] font-medium">{Math.round(totalCards > 0 ? (masteredCards / totalCards) * 100 : 0)}% retention</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Due for Recall Today</div>
          <div className="text-2xl font-bold font-serif text-amber-800 mt-1">{dueCards}</div>
          <div className="text-[11px] text-amber-800 font-medium">Spaced review queue</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#E0DBD0] shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-[#A5A58D]">Mastered Concepts</div>
          <div className="text-2xl font-bold font-serif text-emerald-800 mt-1">{masteredCards}</div>
          <div className="text-[11px] text-emerald-800 font-medium">Long-term storage</div>
        </div>
      </div>

      {/* 1-Click AI Deck Generator from Weak Topics Strip */}
      {weakTopicsList.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-50/70 border border-amber-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-100 text-amber-800 rounded-2xl">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Weak Topic Flashcard Accelerator
              </h4>
              <p className="text-[11px] text-amber-900 mt-0.5">
                You have {weakTopicsList.length} weak topics in your syllabus. Generate targeted recall cards to turn weak spots into strengths.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (weakTopicsList[0]) {
                setAiSubject(weakTopicsList[0].subject);
                setAiChapter(weakTopicsList[0].chapter);
                setAiTopic(weakTopicsList[0].topic);
                setAiWeakFocus(true);
                setIsAiModalOpen(true);
              }
            }}
            className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-medium text-xs rounded-full shadow-xs shrink-0 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Weak Area Deck</span>
          </button>
        </div>
      )}

      {/* REVIEW ARENA MODAL / FULL SCREEN OVERLAY */}
      <AnimatePresence>
        {isReviewing && selectedDeck && (
          <div className="fixed inset-0 bg-[#2D312E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-[#FAF8F5] border border-[#E0DBD0] rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col justify-between">
              {/* Review Header */}
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                      {selectedDeck.subjectName}
                    </span>
                    {selectedDeck.topicName && (
                      <span className="text-xs font-mono text-[#A5A58D]">
                        {selectedDeck.topicName}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                    {selectedDeck.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono font-bold text-[#6B705C] bg-[#EAE7DF] px-3 py-1 rounded-full">
                    {currentCardIndex + 1} / {selectedDeck.cards.length}
                  </div>
                  <button
                    onClick={() => {
                      setIsReviewing(false);
                      window.speechSynthesis?.cancel();
                    }}
                    className="p-1.5 rounded-full hover:bg-[#EAE7DF] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#EAE7DF] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#6B705C] h-full transition-all duration-300"
                  style={{ width: `${((currentCardIndex + (reviewCompleted ? 1 : 0)) / selectedDeck.cards.length) * 100}%` }}
                ></div>
              </div>

              {!reviewCompleted ? (
                <>
                  {/* 3D Flip Card Container */}
                  <div className="perspective-1000 min-h-[260px] flex items-center justify-center">
                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      className={`w-full min-h-[260px] rounded-3xl p-6 sm:p-8 cursor-pointer transition-all duration-500 transform-style-3d border shadow-md flex flex-col justify-between relative select-none ${
                        isFlipped
                          ? 'bg-[#FFFFFF] border-[#6B705C]/40 text-[#4A4E4D]'
                          : 'bg-gradient-to-br from-[#FFFFFF] to-[#F9F7F2] border-[#E0DBD0] text-[#2D312E] hover:border-[#6B705C]/30'
                      }`}
                    >
                      {/* Top status indicator inside card */}
                      <div className="flex items-center justify-between text-xs text-[#A5A58D]">
                        <span className="font-mono uppercase text-[10px] tracking-widest font-bold text-[#6B705C]">
                          {isFlipped ? 'Answer / Solution' : 'Active Recall Prompt'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(isFlipped ? selectedDeck.cards[currentCardIndex].back : selectedDeck.cards[currentCardIndex].front);
                            }}
                            className="p-1 rounded-full hover:bg-[#EAE7DF] text-[#6B705C] transition"
                            title="Listen to audio pronunciation"
                          >
                            {isSpeaking ? <VolumeX className="w-4 h-4 text-rose-800" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <span className="text-[10px] font-mono bg-[#F0EDE4] px-2 py-0.5 rounded-md text-[#6B705C]">
                            {isFlipped ? 'Tap to see prompt' : 'Tap or Space to reveal'}
                          </span>
                        </div>
                      </div>

                      {/* Main Card Content */}
                      <div className="my-auto py-4 text-center">
                        {!isFlipped ? (
                          <p className="text-lg sm:text-xl font-serif text-[#2D312E] leading-relaxed font-medium">
                            {selectedDeck.cards[currentCardIndex].front}
                          </p>
                        ) : (
                          <div className="space-y-4 text-left">
                            <p className="text-base sm:text-lg text-[#2D312E] leading-relaxed whitespace-pre-line font-normal">
                              {selectedDeck.cards[currentCardIndex].back}
                            </p>
                            {selectedDeck.cards[currentCardIndex].mnemonic && (
                              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-950 flex items-start gap-2">
                                <span className="font-bold uppercase tracking-wider shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-200/80 rounded text-amber-950">
                                  Mnemonic
                                </span>
                                <span>{selectedDeck.cards[currentCardIndex].mnemonic}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom tags */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E0DBD0]/60 text-[11px] text-[#A5A58D]">
                        <div className="flex items-center gap-1.5">
                          {selectedDeck.cards[currentCardIndex].tags?.map((tag, tIdx) => (
                            <span key={tIdx} className="px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] font-mono text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="italic text-[10px]">
                          {selectedDeck.cards[currentCardIndex].repetitions ? `Reviewed ${selectedDeck.cards[currentCardIndex].repetitions}x` : 'New card'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Recall Scoring Buttons (Visible after flip) */}
                  {isFlipped ? (
                    <div className="space-y-2 animate-fade-in">
                      <div className="text-center text-[11px] text-[#A5A58D] font-medium">
                        Rate how accurately you recalled this concept (Keys 1 - 4):
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => handleRateCard('again')}
                          className="p-3 rounded-2xl bg-rose-50 hover:bg-rose-100/90 text-rose-900 border border-rose-200 font-semibold text-xs transition cursor-pointer flex flex-col items-center gap-0.5 active:scale-95"
                        >
                          <span className="font-bold flex items-center gap-1">
                            <span>1. Again</span>
                          </span>
                          <span className="text-[10px] font-normal text-rose-700">Repeat tomorrow (1d)</span>
                        </button>

                        <button
                          onClick={() => handleRateCard('hard')}
                          className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/90 text-amber-900 border border-amber-200 font-semibold text-xs transition cursor-pointer flex flex-col items-center gap-0.5 active:scale-95"
                        >
                          <span className="font-bold flex items-center gap-1">
                            <span>2. Hard</span>
                          </span>
                          <span className="text-[10px] font-normal text-amber-700">Recall delayed (3d)</span>
                        </button>

                        <button
                          onClick={() => handleRateCard('good')}
                          className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200 font-semibold text-xs transition cursor-pointer flex flex-col items-center gap-0.5 active:scale-95"
                        >
                          <span className="font-bold flex items-center gap-1">
                            <span>3. Good</span>
                          </span>
                          <span className="text-[10px] font-normal text-emerald-700">Solid recall (7d)</span>
                        </button>

                        <button
                          onClick={() => handleRateCard('mastered')}
                          className="p-3 rounded-2xl bg-[#6B705C]/15 hover:bg-[#6B705C]/25 text-[#6B705C] border border-[#6B705C]/30 font-semibold text-xs transition cursor-pointer flex flex-col items-center gap-0.5 active:scale-95"
                        >
                          <span className="font-bold flex items-center gap-1">
                            <span>4. Mastered ⭐</span>
                          </span>
                          <span className="text-[10px] font-normal text-[#6B705C]">Long term (14d)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setIsFlipped(true)}
                        className="w-full sm:w-auto px-8 py-3 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span>Flip & Reveal Answer (Space)</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Review Complete Celebration Screen */
                <div className="py-6 text-center space-y-5 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
                    <Award className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-serif italic font-bold text-[#4A4E4D]">
                      Deck Review Completed!
                    </h3>
                    <p className="text-xs text-[#A5A58D]">
                      Your spaced-repetition memory intervals have been updated and synchronized with Cloud storage.
                    </p>
                  </div>

                  {/* Summary Scores */}
                  <div className="grid grid-cols-4 gap-2 max-w-md mx-auto text-xs">
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                      <div className="text-[10px] uppercase font-bold text-rose-800">Again</div>
                      <div className="text-base font-bold text-rose-900 mt-0.5">{reviewSessionStats.againCount}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                      <div className="text-[10px] uppercase font-bold text-amber-800">Hard</div>
                      <div className="text-base font-bold text-amber-900 mt-0.5">{reviewSessionStats.hardCount}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[10px] uppercase font-bold text-emerald-800">Good</div>
                      <div className="text-base font-bold text-emerald-900 mt-0.5">{reviewSessionStats.goodCount}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#6B705C]/15 border border-[#6B705C]/30">
                      <div className="text-[10px] uppercase font-bold text-[#6B705C]">Mastered</div>
                      <div className="text-base font-bold text-[#6B705C] mt-0.5">{reviewSessionStats.masteredCount}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleStartReview(selectedDeck)}
                      className="px-6 py-2.5 bg-[#F9F7F2] hover:bg-[#F0EDE4] text-[#4A4E4D] border border-[#E0DBD0] text-xs font-semibold rounded-full flex items-center gap-2 cursor-pointer transition active:scale-95"
                    >
                      <RotateCw className="w-4 h-4 text-[#6B705C]" />
                      <span>Review Again</span>
                    </button>

                    <button
                      onClick={() => setIsReviewing(false)}
                      className="px-6 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Back to Decks</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Subject Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-[#A5A58D] flex items-center gap-1 shrink-0 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Subject:</span>
        </span>

        <button
          onClick={() => setSubjectFilter('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 border ${
            subjectFilter === 'ALL'
              ? 'bg-[#6B705C] text-white border-[#6B705C]'
              : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F9F7F2]'
          }`}
        >
          All Subjects ({decks.length})
        </button>

        {subjects.map(s => {
          const count = decks.filter(d => d.subjectName === s.name).length;
          return (
            <button
              key={s.id}
              onClick={() => setSubjectFilter(s.name)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 border ${
                subjectFilter === s.name
                  ? 'bg-[#6B705C] text-white border-[#6B705C]'
                  : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F9F7F2]'
              }`}
            >
              {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Deck Grid */}
      {filteredDecks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDecks.map((deck) => {
            const masteredCount = deck.cards.filter(c => c.mastered).length;
            const dueCount = deck.cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= todayStr).length;
            const pct = Math.round((masteredCount / (deck.cards.length || 1)) * 100);

            return (
              <div
                key={deck.id}
                className="bg-white border border-[#E0DBD0] hover:border-[#6B705C]/40 rounded-3xl p-5 shadow-xs transition flex flex-col justify-between space-y-4 group"
              >
                {/* Deck Top */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                      {deck.subjectName}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#A5A58D]">
                      <Layers className="w-3.5 h-3.5 text-[#6B705C]" />
                      <span>{deck.cards.length} cards</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-serif italic font-bold text-[#4A4E4D] line-clamp-1 group-hover:text-[#6B705C] transition">
                    {deck.title}
                  </h3>

                  <p className="text-xs text-[#A5A58D] line-clamp-2">
                    {deck.description || 'Active recall spaced repetition deck.'}
                  </p>
                </div>

                {/* Deck Mastery Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-[#E0DBD0]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#A5A58D] font-mono">Mastery: {pct}%</span>
                    {dueCount > 0 ? (
                      <span className="text-amber-800 font-bold font-mono text-[10px] px-2 py-0.5 bg-amber-50 rounded border border-amber-200">
                        {dueCount} due today
                      </span>
                    ) : (
                      <span className="text-emerald-800 font-bold font-mono text-[10px] px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        All reviewed
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-[#EAE7DF] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#6B705C] h-full rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>

                {/* Deck Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartReview(deck)}
                      className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Review</span>
                    </button>

                    {onOpenAudioStudy && (
                      <button
                        onClick={() => onOpenAudioStudy(deck.id)}
                        className="px-3 py-1.5 bg-theme-accent hover:opacity-85 text-primary font-medium text-xs rounded-full border border-theme flex items-center gap-1 cursor-pointer transition active:scale-95"
                        title="Start Voice Quiz & Hands-Free Audio Arena"
                      >
                        <Mic className="w-3.5 h-3.5 text-primary" />
                        <span>Voice</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onStartTimerForTopic && deck.topicName && (
                      <button
                        onClick={() => onStartTimerForTopic(deck.subjectName, deck.chapterName || '', deck.topicName || '')}
                        className="p-2 rounded-full hover:bg-theme-accent text-primary transition"
                        title="Start Pomodoro Timer for this topic"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete deck "${deck.title}"?`)) {
                          onDeleteDeck(deck.id);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-rose-50 text-rose-800/60 hover:text-rose-800 transition"
                      title="Delete deck"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-3xl border border-[#E0DBD0] p-6 space-y-4">
          <Brain className="w-10 h-10 text-[#6B705C] mx-auto opacity-70" />
          <div className="space-y-1">
            <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">No Flashcard Decks Found</h3>
            <p className="text-xs text-[#A5A58D] max-w-sm mx-auto">
              Generate an instant active recall deck with AI or create custom cards for your syllabus.
            </p>
          </div>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full shadow-xs inline-flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate First AI Deck</span>
          </button>
        </div>
      )}

      {/* AI FLASHCARD GENERATOR MODAL */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 bg-[#2D312E]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative my-auto animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6B705C]" />
                  <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                    AI Flashcard Deck Architect
                  </h3>
                </div>
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-1 rounded-full hover:bg-[#EAE7DF] text-[#A5A58D] hover:text-[#4A4E4D] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {aiGenError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiGenError}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Subject selection */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <select
                    value={aiSubject}
                    onChange={(e) => setAiSubject(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Chapter & Topic */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Chapter (Optional)
                    </label>
                    <select
                      value={aiChapter}
                      onChange={(e) => setAiChapter(e.target.value)}
                      className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="">All Chapters</option>
                      {subjects.find(s => s.name === aiSubject)?.chapters.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Topic (Optional)
                    </label>
                    <select
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="">All Topics</option>
                      {subjects
                        .find(s => s.name === aiSubject)
                        ?.chapters.find(c => c.name === aiChapter)
                        ?.topics.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Card Count & Difficulty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Cards Count: <span className="font-mono text-[#4A4E4D]">{aiCount}</span>
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="16"
                      step="2"
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="w-full accent-[#6B705C] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value as any)}
                      className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                    >
                      <option value="Mixed">Mixed (Balanced)</option>
                      <option value="Easy">Easy (Core Foundations)</option>
                      <option value="Medium">Medium (Exam Standard)</option>
                      <option value="Hard">Hard (Deep & Tricky)</option>
                    </select>
                  </div>
                </div>

                {/* Focus on Weak Areas Toggle */}
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiWeakFocus}
                    onChange={(e) => setAiWeakFocus(e.target.checked)}
                    className="rounded text-[#6B705C] focus:ring-0 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#4A4E4D]">Prioritize Weak Misconceptions</span>
                    <p className="text-[10px] text-[#A5A58D]">Generates cards targeting frequent traps and difficult nuances.</p>
                  </div>
                </label>

                {/* Additional syllabus or lecture context */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                    Custom Lecture Notes / Extra Context (Optional)
                  </label>
                  <textarea
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    placeholder="Paste specific definitions, equations, or concepts you want included..."
                    rows={3}
                    className="w-full p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-mono text-xs focus:outline-none focus:border-[#6B705C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E0DBD0]">
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F9F7F2]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAiDeck}
                  disabled={isGeneratingAi}
                  className="px-6 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAi ? 'Synthesizing Cards...' : 'Generate & Start Review'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL CUSTOM DECK MODAL */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 bg-[#2D312E]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative my-auto animate-fade-in max-h-[90vh] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#6B705C]" />
                  <h3 className="text-base font-serif italic font-bold text-[#4A4E4D]">
                    Create Custom Flashcard Deck
                  </h3>
                </div>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-1 rounded-full hover:bg-[#EAE7DF] text-[#A5A58D] hover:text-[#4A4E4D] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Deck Title *
                    </label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="e.g. Thermodynamics Carnot Cycle High Yield"
                      className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                      Subject
                    </label>
                    <select
                      value={manualSubject}
                      onChange={(e) => setManualSubject(e.target.value)}
                      className="w-full p-2.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] font-medium focus:outline-none focus:border-[#6B705C]"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cards List Editor */}
                <div className="space-y-3 pt-2 border-t border-[#E0DBD0]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#6B705C] uppercase tracking-wider text-[11px]">
                      Cards ({manualCards.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualCards(prev => [...prev, { front: '', back: '', mnemonic: '' }])}
                      className="px-3 py-1 rounded-full bg-[#EAE7DF] hover:bg-[#E0DBD0] text-[#6B705C] font-semibold text-[11px] flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Card</span>
                    </button>
                  </div>

                  {manualCards.map((card, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2 relative">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#A5A58D]">
                        <span>Card #{idx + 1}</span>
                        {manualCards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setManualCards(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-800 hover:text-rose-900"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={card.front}
                        onChange={(e) => {
                          const updated = [...manualCards];
                          updated[idx].front = e.target.value;
                          setManualCards(updated);
                        }}
                        placeholder="Front: Concept Prompt or Question"
                        className="w-full p-2 rounded-xl bg-white border border-[#E0DBD0] text-[#4A4E4D] text-xs font-medium focus:outline-none focus:border-[#6B705C]"
                      />

                      <textarea
                        value={card.back}
                        onChange={(e) => {
                          const updated = [...manualCards];
                          updated[idx].back = e.target.value;
                          setManualCards(updated);
                        }}
                        placeholder="Back: Answer, Key Explanation & Formula"
                        rows={2}
                        className="w-full p-2 rounded-xl bg-white border border-[#E0DBD0] text-[#4A4E4D] text-xs focus:outline-none focus:border-[#6B705C]"
                      />

                      <input
                        type="text"
                        value={card.mnemonic || ''}
                        onChange={(e) => {
                          const updated = [...manualCards];
                          updated[idx].mnemonic = e.target.value;
                          setManualCards(updated);
                        }}
                        placeholder="Optional Mnemonic / Memory Hook"
                        className="w-full p-1.5 rounded-xl bg-white border border-[#E0DBD0] text-[#6B705C] text-[11px] italic focus:outline-none focus:border-[#6B705C]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E0DBD0]">
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F9F7F2]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveManualDeck}
                  className="px-6 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Deck</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
