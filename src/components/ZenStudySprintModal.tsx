import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  X, 
  ArrowRight, 
  BookOpen, 
  Check, 
  Brain, 
  Award, 
  Zap, 
  Send,
  HelpCircle,
  Eye,
  Headphones,
  Compass
} from 'lucide-react';
import { Subject, StudySession, Topic } from '../types';

interface ZenStudySprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubject?: string;
  initialTopic?: string;
  onSaveSession: (session: Omit<StudySession, 'id'>) => void;
  onSelectTopicInSyllabus?: (subjectId: string, topicId: string) => void;
  onOpenCheatSheet?: (subjectName: string, topicName: string) => void;
}

type SprintStage = 'warmup' | 'focus' | 'blurt' | 'complete';

export const ZenStudySprintModal: React.FC<ZenStudySprintModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubject,
  initialTopic,
  onSaveSession,
  onOpenCheatSheet
}) => {
  // Topic selection
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(
    initialSubject || subjects[0]?.name || ''
  );
  const activeSubject = subjects.find(s => s.name === selectedSubjectName) || subjects[0];
  const allSubjectTopics = activeSubject?.chapters.flatMap(ch => 
    ch.topics.map(t => ({ ...t, chapterName: ch.name }))
  ) || [];

  const [selectedTopicName, setSelectedTopicName] = useState<string>(
    initialTopic || allSubjectTopics[0]?.name || ''
  );

  // Workflow Stage
  const [stage, setStage] = useState<SprintStage>('warmup');

  // Stage 1: Active Recall Warmup State (5 min)
  const [warmupSecondsLeft, setWarmupSecondsLeft] = useState<number>(5 * 60);
  const [warmupCards, setWarmupCards] = useState<Array<{
    q: string;
    a: string;
    revealed: boolean;
    rating?: 'easy' | 'medium' | 'hard';
  }>>([]);
  const [currentWarmupIdx, setCurrentWarmupIdx] = useState<number>(0);

  // Stage 2: Deep Focus Sprint State (Default 25 mins)
  const [focusTargetMinutes, setFocusTargetMinutes] = useState<number>(25);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number>(25 * 60);
  const [isFocusActive, setIsFocusActive] = useState<boolean>(false);
  const [isFocusPaused, setIsFocusPaused] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Ambient Noise Engine (Web Audio API)
  const [ambientSound, setAmbientSound] = useState<'off' | 'white' | 'rain' | 'forest'>('white');
  const [ambientVolume, setAmbientVolume] = useState<number>(0.15);
  const audioContextRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    source?: AudioBufferSourceNode;
  } | null>(null);

  // Stage 3: Lock-In Feynman Blurt State (5 min)
  const [blurtText, setBlurtText] = useState<string>('');
  const [blurtSecondsLeft, setBlurtSecondsLeft] = useState<number>(5 * 60);
  const [blurtResultStatus, setBlurtResultStatus] = useState<'Completed' | 'Mastered'>('Completed');

  // Sync initial props
  useEffect(() => {
    if (initialSubject) setSelectedSubjectName(initialSubject);
    if (initialTopic) setSelectedTopicName(initialTopic);
  }, [initialSubject, initialTopic]);

  // Generate Warmup Prompts whenever topic changes
  useEffect(() => {
    if (selectedTopicName) {
      const activeTopicObj = allSubjectTopics.find(t => t.name === selectedTopicName);
      setWarmupCards([
        {
          q: `What is the core definition or governing law behind "${selectedTopicName}"?`,
          a: `State the fundamental relationship, boundary conditions, and SI units associated with ${selectedTopicName}.`,
          revealed: false
        },
        {
          q: `What is the most frequent mistake or trick examiners test on "${selectedTopicName}"?`,
          a: `Overlooking subtle sign conventions, failing to show unit conversions, or confusing inverse dependencies.`,
          revealed: false
        },
        {
          q: `How would you explain "${selectedTopicName}" to someone with zero background?`,
          a: `Focus on the intuitive cause-and-effect mechanism and a relatable real-world physical analogy.`,
          revealed: false
        }
      ]);
      setCurrentWarmupIdx(0);
      setWarmupSecondsLeft(5 * 60);
      setFocusSecondsLeft(focusTargetMinutes * 60);
      setIsFocusActive(false);
      setBlurtText('');
      setStage('warmup');
    }
  }, [selectedTopicName, selectedSubjectName]);

  // Ambient Noise generator
  const startAmbientNoise = (type: 'white' | 'rain' | 'forest') => {
    try {
      if (audioContextRef.current) {
        stopAmbientNoise();
      }
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      if (type === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'rain') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        }
      } else {
        // Forest / Pink Noise
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          data[i] = (b0 + b1 + b2) * 0.15;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(ambientVolume, ctx.currentTime);

      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      audioContextRef.current = { ctx, gain, source: noise };
    } catch (e) {
      console.warn("Ambient audio error:", e);
    }
  };

  const stopAmbientNoise = () => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.source?.stop();
        audioContextRef.current.ctx.close();
        audioContextRef.current = null;
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (stage === 'focus' && isFocusActive && !isFocusPaused && ambientSound !== 'off') {
      startAmbientNoise(ambientSound);
    } else {
      stopAmbientNoise();
    }
    return () => stopAmbientNoise();
  }, [stage, isFocusActive, isFocusPaused, ambientSound]);

  // Focus Timer countdown
  useEffect(() => {
    let timer: any = null;
    if (stage === 'focus' && isFocusActive && !isFocusPaused) {
      timer = setInterval(() => {
        setFocusSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsFocusActive(false);
            stopAmbientNoise();
            setStage('blurt');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [stage, isFocusActive, isFocusPaused]);

  // Finish and Log Session
  const handleFinalizeSprint = () => {
    const activeTopicObj = allSubjectTopics.find(t => t.name === selectedTopicName);
    const totalSprintMinutes = Math.round((focusTargetMinutes * 60 - focusSecondsLeft) / 60) + 5; // Focus time + 5m warmup/blurt
    const actualMins = Math.max(5, totalSprintMinutes);

    const now = new Date();
    const startTimeStr = new Date(now.getTime() - actualMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    onSaveSession({
      userId: '',
      date: now.toISOString().split('T')[0],
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: actualMins,
      subjectName: selectedSubjectName,
      chapterName: activeTopicObj?.chapterName || 'Curriculum',
      topicName: selectedTopicName,
      result: blurtResultStatus === 'Mastered' ? 'Completed' : 'Completed',
      notes: `Zen Sprint (${actualMins}m): Warmup + Focus + Feynman Blurt: "${blurtText.slice(0, 120)}${blurtText.length > 120 ? '...' : ''}"`,
      timestamp: Date.now()
    });

    setStage('complete');
  };

  if (!isOpen) return null;

  const focusMins = Math.floor(focusSecondsLeft / 60);
  const focusSecs = focusSecondsLeft % 60;
  const focusProgress = ((focusTargetMinutes * 60 - focusSecondsLeft) / (focusTargetMinutes * 60)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className={`relative w-full ${isFullscreen ? 'max-w-6xl h-[95vh]' : 'max-w-3xl'} bg-[#1F2220] border border-[#3E433F] rounded-3xl shadow-2xl text-white flex flex-col overflow-hidden transition-all duration-300`}>
        
        {/* HEADER BAR */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#1A1C1B]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                  Zen Study Sprint
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Option 1 Flow
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-sm sm:max-w-md">
                {selectedTopicName || 'Select Topic'} <span className="text-[#A5A58D] font-normal">({selectedSubjectName})</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4CFC4] hover:text-white transition cursor-pointer"
              title="Toggle Fullscreen Focus"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4CFC4] hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-STAGE STEPPER INDICATOR */}
        <div className="px-6 py-3 bg-[#171918] border-b border-white/5 flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-2 ${stage === 'warmup' ? 'text-amber-400 font-bold' : 'text-[#8A8F8B]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${stage === 'warmup' ? 'bg-amber-400 text-black font-bold' : 'bg-white/10'}`}>
              1
            </span>
            <span>Active Recall Warmup (5m)</span>
          </div>

          <div className="w-8 h-px bg-white/10 hidden sm:block" />

          <div className={`flex items-center gap-2 ${stage === 'focus' ? 'text-emerald-400 font-bold' : 'text-[#8A8F8B]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${stage === 'focus' ? 'bg-emerald-400 text-black font-bold' : 'bg-white/10'}`}>
              2
            </span>
            <span>Deep Focus Sprint ({focusTargetMinutes}m)</span>
          </div>

          <div className="w-8 h-px bg-white/10 hidden sm:block" />

          <div className={`flex items-center gap-2 ${stage === 'blurt' ? 'text-indigo-400 font-bold' : 'text-[#8A8F8B]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${stage === 'blurt' ? 'bg-indigo-400 text-black font-bold' : 'bg-white/10'}`}>
              3
            </span>
            <span>Feynman Blurt (5m)</span>
          </div>
        </div>

        {/* WORKFLOW CONTENT CONTAINER */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6">
          
          {/* ========================================================================= */}
          {/* STAGE 1: ACTIVE RECALL WARMUP */}
          {/* ========================================================================= */}
          {stage === 'warmup' && (
            <div className="space-y-6 max-w-xl mx-auto text-center">
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Step 1: Cognitive Priming
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
                  Prime Your Brain Before Deep Work
                </h3>
                <p className="text-xs sm:text-sm text-[#A5A58D]">
                  Answer this rapid question mentally or aloud. Active retrieval primes synaptic connections so information sticks 3x better during your focus sprint.
                </p>
              </div>

              {/* Flash Warmup Card */}
              {warmupCards[currentWarmupIdx] && (
                <div className="p-6 rounded-3xl bg-[#262A27] border border-[#3E433F] text-left space-y-4 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-mono text-[#A5A58D]">
                    <span>Card {currentWarmupIdx + 1} of {warmupCards.length}</span>
                    <span className="text-amber-400 font-bold">Active Retrieval</span>
                  </div>

                  <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
                    {warmupCards[currentWarmupIdx].q}
                  </div>

                  {warmupCards[currentWarmupIdx].revealed ? (
                    <div className="p-4 rounded-2xl bg-[#1A1C1B] border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm leading-relaxed space-y-2">
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Core Concept Key:</span>
                      </div>
                      <p>{warmupCards[currentWarmupIdx].a}</p>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-[#A5A58D]">How well did you know this?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (currentWarmupIdx < warmupCards.length - 1) {
                                setCurrentWarmupIdx(prev => prev + 1);
                              } else {
                                setStage('focus');
                                setIsFocusActive(true);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition"
                          >
                            Hard
                          </button>
                          <button
                            onClick={() => {
                              if (currentWarmupIdx < warmupCards.length - 1) {
                                setCurrentWarmupIdx(prev => prev + 1);
                              } else {
                                setStage('focus');
                                setIsFocusActive(true);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition"
                          >
                            Medium
                          </button>
                          <button
                            onClick={() => {
                              if (currentWarmupIdx < warmupCards.length - 1) {
                                setCurrentWarmupIdx(prev => prev + 1);
                              } else {
                                setStage('focus');
                                setIsFocusActive(true);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition"
                          >
                            Easy
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const updated = [...warmupCards];
                        updated[currentWarmupIdx].revealed = true;
                        setWarmupCards(updated);
                      }}
                      className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-amber-400" />
                      <span>Reveal Core Retrieval Answer</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setStage('focus');
                    setIsFocusActive(true);
                  }}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Skip Warmup & Start 25m Focus Sprint</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: DEEP FOCUS SPRINT (25 MINS) */}
          {/* ========================================================================= */}
          {stage === 'focus' && (
            <div className="space-y-6 max-w-lg mx-auto text-center">
              
              {/* Circular Focus Dial */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44%"
                    stroke="#2D312E"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="44%"
                    stroke="#10B981"
                    strokeWidth="8"
                    strokeDasharray="276%"
                    strokeDashoffset={`${276 - (focusProgress / 100) * 276}%`}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
                  <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white">
                    {String(focusMins).padStart(2, '0')}:{String(focusSecs).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-[#A5A58D] font-mono uppercase tracking-widest">
                    {isFocusPaused ? 'Paused' : isFocusActive ? 'Deep Focus Sprint' : 'Ready'}
                  </span>
                </div>
              </div>

              {/* Topic Focus Label */}
              <div className="p-3.5 rounded-2xl bg-[#262A27] border border-[#3E433F] max-w-md mx-auto space-y-1">
                <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Target Concept Under Study
                </div>
                <div className="text-sm font-bold text-white">
                  {selectedTopicName}
                </div>
              </div>

              {/* Ambient Soundscape Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="text-[#A5A58D] flex items-center gap-1 font-mono text-[11px] mr-1">
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zen Sound:</span>
                </span>
                {(['white', 'rain', 'forest', 'off'] as const).map(snd => (
                  <button
                    key={snd}
                    onClick={() => setAmbientSound(snd)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition cursor-pointer ${
                      ambientSound === snd 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' 
                        : 'bg-white/5 text-[#A5A58D] hover:text-white'
                    }`}
                  >
                    {snd === 'off' ? 'Mute' : snd}
                  </button>
                ))}
              </div>

              {/* Sprint Action Controls */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {isFocusActive && !isFocusPaused ? (
                  <button
                    onClick={() => setIsFocusPaused(true)}
                    className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsFocusActive(true);
                      setIsFocusPaused(false);
                    }}
                    className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isFocusPaused ? 'Resume Sprint' : 'Start Focus Sprint'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    stopAmbientNoise();
                    setStage('blurt');
                  }}
                  className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-[#D4CFC4] hover:text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Move directly to Feynman Summary"
                >
                  <span>Finish Early & Blurt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {onOpenCheatSheet && (
                <div className="pt-2">
                  <button
                    onClick={() => onOpenCheatSheet(selectedSubjectName, selectedTopicName)}
                    className="text-xs text-amber-300 hover:text-amber-200 underline font-mono inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Need quick reference? Open AI 1-Page Cheat Sheet</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: FEYNMAN BLURT SUMMARY (5 MINS) */}
          {/* ========================================================================= */}
          {stage === 'blurt' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="text-center space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                  Step 3: Neural Lock-In
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
                  60-Second Feynman Blurt
                </h3>
                <p className="text-xs text-[#A5A58D]">
                  In 2-3 sentences, blurt out what you just understood or learned in your own words. Teaching or summarizing cements long-term memory.
                </p>
              </div>

              <div className="space-y-3 bg-[#262A27] p-5 rounded-3xl border border-[#3E433F]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>Explain "{selectedTopicName}"</span>
                  </span>
                  <span className="font-mono text-[#A5A58D] text-[11px]">
                    {blurtText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                <textarea
                  value={blurtText}
                  onChange={(e) => setBlurtText(e.target.value)}
                  placeholder="e.g. The core mechanism here is that when temperature increases, average kinetic energy increases, leading to more frequent collisions with energy exceeding activation energy..."
                  rows={4}
                  className="w-full p-3.5 bg-[#1A1C1B] border border-white/10 rounded-2xl text-xs text-white placeholder-[#6B705C] focus:outline-none focus:border-indigo-400 resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#A5A58D]">Mastery Level:</span>
                    <button
                      onClick={() => setBlurtResultStatus('Completed')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        blurtResultStatus === 'Completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-[#A5A58D] hover:text-white'
                      }`}
                    >
                      Solid (Completed)
                    </button>
                    <button
                      onClick={() => setBlurtResultStatus('Mastered')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        blurtResultStatus === 'Mastered'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-[#A5A58D] hover:text-white'
                      }`}
                    >
                      ⭐ Mastered
                    </button>
                  </div>

                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    +50 XP & Streak Saved
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleFinalizeSprint}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Log Sprint & Update Syllabus Progress</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 4: CELEBRATION & COMPLETE */}
          {/* ========================================================================= */}
          {stage === 'complete' && (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold font-serif text-white">Sprint Completed!</h3>
                <p className="text-xs text-[#D4CFC4]">
                  You successfully executed today's Zen Study Sprint. Your syllabus topic has been updated, streak extended, and revision queue recalibrated.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#262A27] border border-[#3E433F] text-xs font-mono text-emerald-300 space-y-1">
                <div>Topic: {selectedTopicName}</div>
                <div>Status: {blurtResultStatus}</div>
                <div>XP Earned: +75 XP</div>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                Return to Dashboard
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
