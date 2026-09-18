import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  X, 
  RotateCcw, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  Pause,
  BookOpen,
  Send,
  Loader2,
  HelpCircle,
  Zap,
  Flame,
  MessageSquare
} from 'lucide-react';
import { Subject, UserProfile } from '../types';
import { apiSocraticOralTurn } from '../lib/aiApi';
import confetti from 'canvas-confetti';

interface VoiceFeynmanOralExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubject?: string;
  initialConcept?: string;
  userProfile?: UserProfile | null;
  onLogActivity?: (log: any) => void;
  onAwardXP?: (xp: number, reason: string) => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  probingQuestion?: string;
  intuitionCheck?: string;
}

export const VoiceFeynmanOralExamModal: React.FC<VoiceFeynmanOralExamModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubject,
  initialConcept,
  userProfile,
  onLogActivity,
  onAwardXP
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || subjects[0]?.name || 'Physics');
  const [conceptName, setConceptName] = useState<string>(initialConcept || '');
  const [examState, setExamState] = useState<'setup' | 'in_progress' | 'completed'>('setup');
  
  // Audio Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Audio Speech Synthesis (TTS)
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);

  // Examination Dialogue
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnCount, setTurnCount] = useState<number>(1);
  const [isLoadingTurn, setIsLoadingTurn] = useState<boolean>(false);
  const [finalRubric, setFinalRubric] = useState<any>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [useKeyboard, setUseKeyboard] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSubject) setSelectedSubject(initialSubject);
    if (initialConcept) setConceptName(initialConcept);
  }, [initialSubject, initialConcept]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
        setUseKeyboard(true);
      }
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingTurn]);

  // Voice Speech Synthesis Handler
  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop prior audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    // Choose natural voice if present
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      setUseKeyboard(true);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (isAiSpeaking && typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
        setIsAiSpeaking(false);
      }
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start issue:', err);
      }
    }
  };

  const handleStartExam = () => {
    if (!conceptName.trim()) return;
    setExamState('in_progress');
    setTurnCount(1);
    setFinalRubric(null);
    
    const openingGreeting = `Welcome to the Socratic Oral Exam on "${conceptName}". I'm listening. Imagine I am an inquisitive 12-year-old who has never opened a textbook: explain to me in plain words what ${conceptName} is and how it works!`;
    
    setMessages([
      {
        role: 'assistant',
        text: openingGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        probingQuestion: `How would you explain "${conceptName}" to someone with zero technical background?`
      }
    ]);

    speakText(openingGreeting);
  };

  const handleSendResponse = async (responseText?: string) => {
    const textToSend = responseText || transcript || manualInput;
    if (!textToSend.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const newHistory: Message[] = [
      ...messages,
      {
        role: 'user',
        text: textToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newHistory);
    setTranscript('');
    setManualInput('');
    setIsLoadingTurn(true);

    try {
      const isFinalTurn = turnCount >= 3;
      const apiRes = await apiSocraticOralTurn({
        conceptName,
        subjectName: selectedSubject,
        conversationHistory: newHistory.map(m => ({ role: m.role, text: m.text })),
        userSpeech: textToSend.trim(),
        isFinalTurn,
        turnCount
      });

      const assistantMsg: Message = {
        role: 'assistant',
        text: apiRes.speechResponse || "That's a thoughtful way to frame it. Let's dig into the core principle.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        probingQuestion: apiRes.probingQuestion,
        intuitionCheck: apiRes.intuitionCheck
      };

      setMessages([...newHistory, assistantMsg]);
      speakText(assistantMsg.text);

      if (apiRes.isCompleted && apiRes.finalRubric) {
        setFinalRubric(apiRes.finalRubric);
        setExamState('completed');
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch {}

        if (onAwardXP) {
          onAwardXP(75, `Completed Socratic Oral Exam on ${conceptName}`);
        }

        if (onLogActivity) {
          onLogActivity({
            subjectName: selectedSubject,
            topicName: conceptName,
            action: 'Socratic Oral Exam (Feynman Mode)',
            scorePercentage: apiRes.finalRubric.feynmanScore || 85,
            durationMinutes: 10,
            details: `Oral Exam Score: ${apiRes.finalRubric.feynmanScore}%. Verdict: ${apiRes.finalRubric.verdict}.`
          });
        }
      } else {
        setTurnCount(prev => prev + 1);
      }
    } catch (err: any) {
      console.error('Oral turn failed:', err);
      const fallbackMsg: Message = {
        role: 'assistant',
        text: "You explained the fundamental idea well! Now, what real-world everyday situation resembles this mechanism?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        probingQuestion: "Can you give me an everyday analogy for this?"
      };
      setMessages([...newHistory, fallbackMsg]);
      speakText(fallbackMsg.text);
      setTurnCount(prev => prev + 1);
    } finally {
      setIsLoadingTurn(false);
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    setExamState('setup');
    setMessages([]);
    setFinalRubric(null);
    setTurnCount(1);
    setTranscript('');
    setManualInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-[#E0DBD0] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2EFE9] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#4A4E4D]">Voice Socratic Oral Exam</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Feynman Mode
                </span>
              </div>
              <p className="text-xs text-[#6B705C]">Verbal concept defense & deep intuition probing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (voiceEnabled && typeof window !== 'undefined') window.speechSynthesis?.cancel();
                setVoiceEnabled(!voiceEnabled);
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                voiceEnabled 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-stone-100 border-stone-200 text-stone-500'
              }`}
              title={voiceEnabled ? 'Examiner Voice Active (Click to Mute)' : 'Examiner Voice Muted'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[11px] hidden sm:inline">{voiceEnabled ? 'AI Voice ON' : 'Muted'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {examState === 'setup' && (
            <div className="space-y-6 max-w-xl mx-auto py-4">
              <div className="bg-[#FAF8F5] border border-[#E0DBD0] rounded-3xl p-6 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-500/15 flex items-center justify-center text-amber-700 shadow-xs">
                  <Mic className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[#4A4E4D]">How the Socratic Oral Exam Works</h3>
                <p className="text-xs text-[#6B705C] leading-relaxed max-w-md mx-auto">
                  Inspired by Richard Feynman: You speak into the microphone to explain a concept in plain English. The AI Examiner listens, probes your mental blind spots with 2-3 follow-up verbal questions, and rates your conceptual clarity!
                </p>
                
                <div className="grid grid-cols-3 gap-2 pt-2 text-left">
                  <div className="p-2.5 rounded-2xl bg-white border border-[#E0DBD0]">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">1. Explain</div>
                    <div className="text-[11px] text-[#4A4E4D] mt-0.5">Speak simply like teaching a 12-year-old</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white border border-[#E0DBD0]">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">2. Probe</div>
                    <div className="text-[11px] text-[#4A4E4D] mt-0.5">Defend against Socratic 'What-ifs'</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white border border-[#E0DBD0]">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">3. Mastery</div>
                    <div className="text-[11px] text-[#4A4E4D] mt-0.5">Earn Feynman score & +75 XP</div>
                  </div>
                </div>
              </div>

              {/* Concept Picker */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#4A4E4D] uppercase tracking-wider mb-1.5">
                    1. Select Academic Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E0DBD0] bg-white text-xs font-semibold text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  >
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.icon || '📚'} {sub.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A4E4D] uppercase tracking-wider mb-1.5">
                    2. Choose Concept or Topic to Defend
                  </label>
                  <input
                    type="text"
                    value={conceptName}
                    onChange={e => setConceptName(e.target.value)}
                    placeholder="e.g. Carnot Cycle, Photosynthesis Light Reactions, Hooke's Law, Organic Isomerism"
                    className="w-full px-4 py-3 rounded-2xl border border-[#E0DBD0] bg-white text-xs font-medium text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Quick Topic Chips from Subject */}
                {subjects.find(s => s.name === selectedSubject) && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[#A5A58D] uppercase">Suggestions from your syllabus:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {subjects.find(s => s.name === selectedSubject)?.chapters.flatMap(c => c.topics.slice(0, 3)).slice(0, 8).map(t => (
                        <button
                          key={t.id}
                          onClick={() => setConceptName(t.name)}
                          className="px-2.5 py-1 rounded-xl text-[11px] bg-[#F2EFE9] hover:bg-amber-100 text-[#4A4E4D] transition border border-[#E0DBD0] cursor-pointer"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartExam}
                  disabled={!conceptName.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  <span>Begin Socratic Oral Exam</span>
                </button>
              </div>
            </div>
          )}

          {(examState === 'in_progress' || examState === 'completed') && (
            <div className="space-y-4">
              {/* Exam Progress Indicator */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0] text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#4A4E4D]">{conceptName}</span>
                  <span className="text-[#A5A58D]">•</span>
                  <span className="text-[#6B705C]">{selectedSubject}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-700">
                  <span>Turn {Math.min(3, turnCount)} of 3</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                </div>
              </div>

              {/* Chat Dialogue Stream */}
              <div className="space-y-4 min-h-[220px]">
                {messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-[#A5A58D] uppercase font-mono">
                        {msg.role === 'user' ? 'You (Candidate)' : 'Richard Feynman (Examiner)'}
                      </span>
                      <span className="text-[10px] text-[#A5A58D]">{msg.timestamp}</span>
                    </div>

                    <div className={`max-w-[85%] rounded-3xl p-4 text-xs leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-[#6B705C] text-white rounded-tr-xs'
                        : 'bg-white text-[#4A4E4D] border border-[#E0DBD0] rounded-tl-xs'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      
                      {msg.probingQuestion && (
                        <div className="mt-3 p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 font-semibold text-[11px] flex items-start gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{msg.probingQuestion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoadingTurn && (
                  <div className="flex items-start gap-2 animate-pulse">
                    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-4 shadow-xs flex items-center gap-2 text-xs text-[#6B705C]">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      <span>Feynman is evaluating your intuition and formulating the next Socratic probe...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Live Audio Speech Wave & Recording Bar */}
              {examState === 'in_progress' && (
                <div className="p-4 rounded-3xl bg-[#FAF8F5] border border-[#E0DBD0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-stone-300'}`} />
                      <span className="text-xs font-bold text-[#4A4E4D]">
                        {isListening ? 'Listening to your verbal explanation...' : 'Press Mic to Speak Your Answer'}
                      </span>
                    </div>

                    <button
                      onClick={() => setUseKeyboard(!useKeyboard)}
                      className="text-[11px] font-bold text-[#6B705C] hover:text-[#4A4E4D] underline cursor-pointer"
                    >
                      {useKeyboard ? 'Switch to Voice Input' : 'Type Instead'}
                    </button>
                  </div>

                  {/* Speech Waveform / Live transcript */}
                  {isListening && (
                    <div className="p-3 bg-white rounded-2xl border border-rose-200 text-xs text-[#4A4E4D] min-h-[48px] flex items-center gap-3">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" />
                        <span className="w-1 h-6 bg-rose-600 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                      <p className="italic text-[#6B705C] flex-1">
                        {transcript || 'Start speaking clearly into your microphone...'}
                      </p>
                    </div>
                  )}

                  {/* Manual typing fallback */}
                  {useKeyboard && (
                    <div className="flex items-center gap-2">
                      <textarea
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        placeholder="Type your explanation in plain words..."
                        rows={2}
                        className="flex-1 px-3.5 py-2.5 rounded-2xl border border-[#E0DBD0] bg-white text-xs text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                      />
                      <button
                        onClick={() => handleSendResponse()}
                        disabled={!manualInput.trim() || isLoadingTurn}
                        className="px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Microphone Action Controls */}
                  {!useKeyboard && (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        onClick={handleToggleListening}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer ${
                          isListening
                            ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        <span>{isListening ? 'Stop & Review Spoken Answer' : 'Speak Answer'}</span>
                      </button>

                      {transcript && (
                        <button
                          onClick={() => handleSendResponse(transcript)}
                          disabled={isLoadingTurn}
                          className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Submit Answer ({transcript.split(/\s+/).length} words)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Completed Exam Rubric & Certificate */}
              {examState === 'completed' && finalRubric && (
                <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-5 animate-fade-in shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-600" />
                        <h4 className="text-base font-bold text-amber-950">Feynman Oral Exam Certificate</h4>
                      </div>
                      <p className="text-xs text-amber-800/80 mt-0.5">{finalRubric.verdict}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-serif italic font-bold text-amber-800">
                        {finalRubric.feynmanScore}%
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase text-amber-700">Feynman Score</span>
                    </div>
                  </div>

                  {/* Clarity Pillars */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Simplicity</span>
                      <div className="text-lg font-bold text-[#4A4E4D] mt-0.5">{finalRubric.simplicityScore || 85}%</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Accuracy</span>
                      <div className="text-lg font-bold text-[#4A4E4D] mt-0.5">{finalRubric.accuracyScore || 88}%</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/80 border border-amber-200 text-center">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Analogy</span>
                      <div className="text-lg font-bold text-[#4A4E4D] mt-0.5">{finalRubric.analogyScore || 80}%</div>
                    </div>
                  </div>

                  {/* Recommended Everyday Analogy */}
                  {finalRubric.recommendedEverydayAnalogy && (
                    <div className="p-3.5 rounded-2xl bg-white border border-amber-200 text-xs text-[#4A4E4D] space-y-1">
                      <span className="font-bold text-amber-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Feynman's Recommended Everyday Metaphor:</span>
                      </span>
                      <p className="italic text-[#6B705C]">{finalRubric.recommendedEverydayAnalogy}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2.5 rounded-2xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Test Another Topic</span>
                    </button>

                    <button
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Save & Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
