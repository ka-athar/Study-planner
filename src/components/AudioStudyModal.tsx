import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FastForward, 
  Rewind, 
  Radio, 
  Layers, 
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { Subject, FlashcardDeck, Flashcard } from '../types';
import { 
  speakText, 
  stopSpeaking, 
  startVoiceRecognition, 
  evaluateSpokenAnswer, 
  generateTopicPodcastScript,
  AudioPodcast 
} from '../lib/audioStudyService';

interface AudioStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  flashcardDecks: FlashcardDeck[];
  initialDeckId?: string;
  initialMode?: 'voice_flashcards' | 'audio_podcast';
}

export const AudioStudyModal: React.FC<AudioStudyModalProps> = ({
  isOpen,
  onClose,
  subjects,
  flashcardDecks,
  initialDeckId,
  initialMode = 'voice_flashcards'
}) => {
  const [activeTab, setActiveTab] = useState<'voice_flashcards' | 'audio_podcast'>(initialMode);
  
  // Voice Flashcards State
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    initialDeckId || (flashcardDecks.length > 0 ? flashcardDecks[0].id : '')
  );
  const selectedDeck = flashcardDecks.find(d => d.id === selectedDeckId) || flashcardDecks[0] || null;
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<{
    isCorrect: boolean;
    score: number;
    feedbackSpoken: string;
  } | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  // Podcast State
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0]?.name || '');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [podcast, setPodcast] = useState<AudioPodcast | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [isPlayingPodcast, setIsPlayingPodcast] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Setup chapter default when subject changes
  useEffect(() => {
    const subObj = subjects.find(s => s.name === selectedSubject);
    if (subObj && subObj.chapters.length > 0) {
      setSelectedChapter(subObj.chapters[0].name);
    }
  }, [selectedSubject, subjects]);

  // Generate Podcast script
  useEffect(() => {
    if (selectedSubject && selectedChapter) {
      const subObj = subjects.find(s => s.name === selectedSubject);
      const chObj = subObj?.chapters.find(c => c.name === selectedChapter);
      const topicNames = chObj?.topics.map(t => t.name) || [];
      const generated = generateTopicPodcastScript(selectedSubject, selectedChapter, topicNames);
      setPodcast(generated);
      setCurrentSectionIndex(0);
      setIsPlayingPodcast(false);
      stopSpeaking();
    }
  }, [selectedSubject, selectedChapter]);

  // Cleanup speech on modal close or unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const currentCard: Flashcard | undefined = selectedDeck?.cards[cardIndex];

  // Voice Flashcards Handler
  const handleReadQuestion = () => {
    if (!currentCard) return;
    setEvaluationResult(null);
    setIsRevealed(false);
    setSpokenTranscript('');
    speakText(`Question ${cardIndex + 1}: ${currentCard.front}`, {
      rate: 1.0,
      onEnd: () => {
        // Automatically start listening for spoken answer
        handleStartListening();
      }
    });
  };

  const handleStartListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsVoiceListening(true);
    setSpokenTranscript('');

    const rec = startVoiceRecognition({
      continuous: false,
      onResult: (transcript, isFinal) => {
        setSpokenTranscript(transcript);
        if (isFinal && currentCard) {
          setIsVoiceListening(false);
          // Evaluate answer
          const evaluation = evaluateSpokenAnswer(transcript, currentCard.back);
          setEvaluationResult(evaluation);
          setIsRevealed(true);

          // Speak verdict feedback
          speakText(evaluation.feedbackSpoken, {
            rate: 1.0,
            onEnd: () => {
              if (autoAdvance && selectedDeck && cardIndex < selectedDeck.cards.length - 1) {
                setTimeout(() => {
                  handleNextCard();
                }, 1500);
              }
            }
          });
        }
      },
      onError: (err) => {
        setIsVoiceListening(false);
      },
      onEnd: () => {
        setIsVoiceListening(false);
      }
    });

    recognitionRef.current = rec;
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsVoiceListening(false);
  };

  const handleNextCard = () => {
    stopSpeaking();
    handleStopListening();
    if (selectedDeck && cardIndex < selectedDeck.cards.length - 1) {
      setCardIndex(prev => prev + 1);
      setIsRevealed(false);
      setEvaluationResult(null);
      setSpokenTranscript('');
    }
  };

  const handlePrevCard = () => {
    stopSpeaking();
    handleStopListening();
    if (cardIndex > 0) {
      setCardIndex(prev => prev - 1);
      setIsRevealed(false);
      setEvaluationResult(null);
      setSpokenTranscript('');
    }
  };

  // Podcast Handlers
  const handlePlaySection = (secIndex: number) => {
    if (!podcast) return;
    setCurrentSectionIndex(secIndex);
    setIsPlayingPodcast(true);

    const section = podcast.sections[secIndex];
    if (section) {
      speakText(`${section.title}. ${section.script}`, {
        rate: playbackSpeed,
        onEnd: () => {
          if (secIndex < podcast.sections.length - 1) {
            handlePlaySection(secIndex + 1);
          } else {
            setIsPlayingPodcast(false);
          }
        },
        onError: () => {
          setIsPlayingPodcast(false);
        }
      });
    }
  };

  const handleTogglePlayPodcast = () => {
    if (isPlayingPodcast) {
      stopSpeaking();
      setIsPlayingPodcast(false);
    } else {
      handlePlaySection(currentSectionIndex);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card text-primary w-full max-w-2xl rounded-3xl border border-theme shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-header p-5 sm:p-6 border-b border-theme flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Audio Study & Hands-Free Voice Studio</h3>
                <p className="text-xs text-muted">Hands-free voice flashcards and interactive topic podcasts</p>
              </div>
            </div>
            <button
              onClick={() => {
                stopSpeaking();
                handleStopListening();
                onClose();
              }}
              className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-theme bg-surface px-6 pt-3 gap-3">
            <button
              onClick={() => {
                stopSpeaking();
                handleStopListening();
                setActiveTab('voice_flashcards');
              }}
              className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'voice_flashcards'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Voice Flashcard Quizzing</span>
            </button>
            <button
              onClick={() => {
                stopSpeaking();
                handleStopListening();
                setActiveTab('audio_podcast');
              }}
              className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'audio_podcast'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Summary Audio Podcasts</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
            {activeTab === 'voice_flashcards' ? (
              <div className="space-y-4">
                {/* Deck Selector */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                      Selected Flashcard Deck
                    </label>
                    <select
                      value={selectedDeckId}
                      onChange={e => {
                        setSelectedDeckId(e.target.value);
                        setCardIndex(0);
                        setIsRevealed(false);
                        setEvaluationResult(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-theme text-xs font-medium text-primary focus:outline-none"
                    >
                      {flashcardDecks.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.subjectName} • {d.cards.length} cards)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={e => setAutoAdvance(e.target.checked)}
                        className="rounded border-theme text-primary focus:ring-primary"
                      />
                      <span>Auto-next</span>
                    </label>
                  </div>
                </div>

                {currentCard ? (
                  <div className="bg-surface rounded-2xl border border-theme p-5 sm:p-6 space-y-4 relative">
                    {/* Card Counter & Tag */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-muted uppercase tracking-wider">
                        Card {cardIndex + 1} of {selectedDeck?.cards.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                        {selectedDeck?.subjectName}
                      </span>
                    </div>

                    {/* Question Box */}
                    <div className="bg-card rounded-xl p-4 border border-theme shadow-2xs">
                      <div className="text-xs font-bold text-muted mb-1 flex items-center justify-between">
                        <span>QUESTION</span>
                        <button
                          onClick={handleReadQuestion}
                          className="p-1 rounded-lg hover:bg-theme-accent text-primary transition cursor-pointer flex items-center gap-1 text-[11px]"
                          title="Read Question Aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Speak</span>
                        </button>
                      </div>
                      <div className="text-base font-bold text-primary">{currentCard.front}</div>
                    </div>

                    {/* Voice Listening Bar */}
                    <div className="flex flex-col items-center justify-center p-4 bg-card rounded-xl border border-theme text-center gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={isVoiceListening ? handleStopListening : handleStartListening}
                          className={`p-4 rounded-full transition shadow-md flex items-center justify-center cursor-pointer ${
                            isVoiceListening
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-primary text-white hover:opacity-90'
                          }`}
                          title={isVoiceListening ? 'Stop Listening' : 'Speak Answer'}
                        >
                          {isVoiceListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                      </div>
                      <div className="text-xs font-semibold">
                        {isVoiceListening ? (
                          <span className="text-rose-500 animate-pulse">🎙️ Listening... Speak your answer now</span>
                        ) : (
                          <span className="text-muted">Click microphone or "Speak & Quiz" to answer by voice</span>
                        )}
                      </div>
                      {spokenTranscript && (
                        <div className="text-xs italic text-primary bg-surface px-3 py-1.5 rounded-lg border border-theme max-w-full">
                          "{spokenTranscript}"
                        </div>
                      )}
                    </div>

                    {/* Answer Reveal & Diagnostic */}
                    {isRevealed && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-xl p-4 border ${
                          evaluationResult?.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">
                            {evaluationResult?.isCorrect ? '✅ Correct / Close Match' : '🔍 Review Expected Answer'}
                          </span>
                          {evaluationResult && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-card border border-theme">
                              {evaluationResult.score}% Accuracy
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-primary">{currentCard.back}</div>
                        {currentCard.mnemonic && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            💡 Mnemonic: <em>{currentCard.mnemonic}</em>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={handlePrevCard}
                        disabled={cardIndex === 0}
                        className="px-3 py-1.5 rounded-xl border border-theme text-xs font-semibold hover:bg-theme-accent disabled:opacity-30 cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsRevealed(prev => !prev)}
                          className="px-3 py-1.5 rounded-xl border border-theme text-xs font-semibold hover:bg-theme-accent cursor-pointer"
                        >
                          {isRevealed ? 'Hide Answer' : 'Show Answer'}
                        </button>
                        <button
                          onClick={handleReadQuestion}
                          className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Speak & Quiz</span>
                        </button>
                      </div>
                      <button
                        onClick={handleNextCard}
                        disabled={!selectedDeck || cardIndex >= selectedDeck.cards.length - 1}
                        className="px-3 py-1.5 rounded-xl border border-theme text-xs font-semibold hover:bg-theme-accent disabled:opacity-30 cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-surface rounded-2xl border border-theme text-muted text-xs">
                    No cards found in this deck.
                  </div>
                )}
              </div>
            ) : (
              /* Podcast Mode */
              <div className="space-y-4">
                {/* Subject & Chapter Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                      Subject
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={e => setSelectedSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-theme text-xs font-medium text-primary focus:outline-none"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                      Chapter
                    </label>
                    <select
                      value={selectedChapter}
                      onChange={e => setSelectedChapter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-theme text-xs font-medium text-primary focus:outline-none"
                    >
                      {subjects.find(s => s.name === selectedSubject)?.chapters.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {podcast && (
                  <div className="bg-surface rounded-2xl border border-theme p-5 sm:p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold">{podcast.title}</div>
                        <div className="text-xs text-muted mt-0.5">{podcast.overview}</div>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-card border border-theme">
                        ~{Math.round(podcast.totalDurationSec / 60)} mins
                      </span>
                    </div>

                    {/* Interactive Player Controls */}
                    <div className="bg-card rounded-2xl p-4 border border-theme shadow-2xs flex flex-col items-center gap-3">
                      <div className="text-xs font-semibold text-primary">
                        Section {currentSectionIndex + 1} of {podcast.sections.length}: <span className="text-primary font-bold">{podcast.sections[currentSectionIndex]?.title}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            if (currentSectionIndex > 0) handlePlaySection(currentSectionIndex - 1);
                          }}
                          disabled={currentSectionIndex === 0}
                          className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary disabled:opacity-30 cursor-pointer"
                          title="Previous Section"
                        >
                          <Rewind className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleTogglePlayPodcast}
                          className="p-4 rounded-full bg-primary text-white hover:opacity-90 shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center"
                          title={isPlayingPodcast ? 'Pause Audio' : 'Play Audio'}
                        >
                          {isPlayingPodcast ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                        </button>
                        <button
                          onClick={() => {
                            if (currentSectionIndex < podcast.sections.length - 1) handlePlaySection(currentSectionIndex + 1);
                          }}
                          disabled={currentSectionIndex >= podcast.sections.length - 1}
                          className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary disabled:opacity-30 cursor-pointer"
                          title="Next Section"
                        >
                          <FastForward className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Speed Selector */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted">Speed:</span>
                        {[0.75, 1.0, 1.25, 1.5].map(sp => (
                          <button
                            key={sp}
                            onClick={() => {
                              setPlaybackSpeed(sp);
                              if (isPlayingPodcast) {
                                handlePlaySection(currentSectionIndex);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-mono cursor-pointer ${
                              playbackSpeed === sp ? 'bg-primary text-white border-primary' : 'bg-surface border-theme text-muted'
                            }`}
                          >
                            {sp}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section Transcript List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {podcast.sections.map((sec, idx) => {
                        const isCurrent = currentSectionIndex === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handlePlaySection(idx)}
                            className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between ${
                              isCurrent
                                ? 'bg-primary/10 border-primary text-primary font-bold'
                                : 'bg-card border-theme text-muted hover:text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{idx + 1}.</span>
                              <span>{sec.title}</span>
                            </div>
                            <span className="text-[10px] font-mono">{sec.durationSec}s</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-header p-4 sm:p-5 border-t border-theme flex items-center justify-between">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Native Web Speech Engine • Zero API Bandwidth</span>
            </div>
            <button
              onClick={() => {
                stopSpeaking();
                handleStopListening();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
