import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  HelpCircle, 
  RefreshCw, 
  Brain, 
  Target, 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  Award, 
  ChevronRight, 
  ArrowRight,
  BookOpen,
  MessageSquare,
  FileText
} from 'lucide-react';
import { Subject, StudySession, TestResult, StudyPlan, UserProfile, PracticeQuestion, PracticeQuestionSet, AIChatMessage } from '../types';
import { apiTutorChat, apiGenerateQuestions } from '../lib/aiApi';
import { 
  subscribeChatHistory, 
  saveChatHistoryToDb, 
  clearChatHistoryInDb, 
  resolveActiveUserId 
} from '../lib/db';

interface AITutorViewProps {
  subjects: Subject[];
  sessions: StudySession[];
  testResults: TestResult[];
  plans: StudyPlan[];
  userProfile: UserProfile | null;
  initialPrompt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const AITutorView: React.FC<AITutorViewProps> = ({
  subjects,
  sessions,
  testResults,
  plans,
  userProfile,
  initialPrompt
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'practice'>('chat');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello ${userProfile?.displayName || 'Student'}! I am your AI Academic Tutor & Personal Organizer. I have full access to your saved study history, syllabus progress, test mistakes, and today's plan. How can I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState<string>(initialPrompt || '');
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Practice Generator State
  const [selectedSubject, setSelectedSubject] = useState<string>('WEAK_AREAS');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [focusWeakAreas, setFocusWeakAreas] = useState<boolean>(true);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Mixed'>('Mixed');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState<boolean>(false);
  
  // Quiz Player State
  const [currentSet, setCurrentSet] = useState<PracticeQuestionSet | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number | string>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  const effectiveUid = resolveActiveUserId(undefined, userProfile?.email || null);

  // Subscribe to real-time chat history from Firestore
  useEffect(() => {
    if (!effectiveUid) return;
    const unsub = subscribeChatHistory(effectiveUid, (cloudMsgs) => {
      if (cloudMsgs && cloudMsgs.length > 0) {
        setMessages(cloudMsgs);
      }
    });
    return () => unsub();
  }, [effectiveUid]);

  // Sync messages to Firestore whenever messages change
  const saveMessagesToCloud = (newMsgs: ChatMessage[]) => {
    if (effectiveUid && newMsgs.length > 1) {
      saveChatHistoryToDb(effectiveUid, newMsgs).catch((e) => {
        console.warn("Failed to sync chat history to cloud:", e);
      });
    }
  };

  const handleClearChat = async () => {
    const initialMsg: ChatMessage = {
      id: `init-${Date.now()}`,
      role: 'assistant',
      content: `Hello ${userProfile?.displayName || 'Student'}! How can I assist you with your studies today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([initialMsg]);
    if (effectiveUid) {
      await clearChatHistoryInDb(effectiveUid);
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      setInputMessage(initialPrompt);
      setActiveSubTab('chat');
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (activeSubTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingChat, activeSubTab]);

  const presetQuestions = [
    "What did I study yesterday?",
    "What should I study now?",
    "Which subject am I neglecting?",
    "What have I completed?",
    "Why am I struggling with this topic?",
    "Give me practice questions for my weak area.",
    "Make today's plan based on what I actually accomplished yesterday."
  ];

  // Calculate user context
  let completedCount = 0;
  let totalTopicsCount = 0;
  let weakTopics: string[] = [];

  subjects.forEach(s => {
    s.chapters.forEach(c => {
      c.topics.forEach(t => {
        totalTopicsCount++;
        if (t.status === 'Completed' || t.status === 'Mastered') completedCount++;
        if (t.status === 'Weak' || t.status === 'Needs Revision') weakTopics.push(`${s.name}: ${t.name}`);
      });
    });
  });

  const overallProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPlan = plans.find(p => p.date === todayStr) || null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoadingChat) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoadingChat(true);

    try {
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await apiTutorChat({
        message: text,
        chatHistory,
        userContext: {
          profile: userProfile,
          overallProgress,
          weakTopics,
          recentSessions: sessions.slice(0, 10),
          testResults: testResults.slice(0, 5),
          todayPlan,
          syllabusSummary: subjects.map(s => ({
            name: s.name,
            chapterCount: s.chapters.length
          }))
        }
      });

      if (res.success && res.reply) {
        const assistantMsg: ChatMessage = {
          id: `msg-res-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const allNewMsgs = [...messages, userMsg, assistantMsg];
        setMessages(allNewMsgs);
        saveMessagesToCloud(allNewMsgs);
      } else {
        throw new Error("Failed to receive tutor response");
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "I ran into an issue connecting to the AI server. Please check your network connection and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Generate Practice Set Handler
  const handleGenerateQuestions = async () => {
    setIsGeneratingQuestions(true);
    setCurrentSet(null);
    setUserAnswers({});
    setRevealedHints({});
    setRevealedExplanations({});
    setQuizSubmitted(false);

    try {
      const subName = selectedSubject === 'WEAK_AREAS' ? undefined : selectedSubject;
      const res = await apiGenerateQuestions({
        subjectName: subName,
        chapterName: selectedChapter || undefined,
        topicName: selectedTopic || undefined,
        focusWeakAreas: selectedSubject === 'WEAK_AREAS' || focusWeakAreas,
        count: questionCount,
        difficulty,
        userContext: {
          weakTopics,
          testResults: testResults.slice(0, 5)
        }
      });

      if (res.success && res.questionSet) {
        const qSet: PracticeQuestionSet = {
          id: `pset-${Date.now()}`,
          subjectName: selectedSubject === 'WEAK_AREAS' ? 'Weak Areas Focus' : selectedSubject,
          chapterName: selectedChapter,
          topicName: selectedTopic,
          isWeakTopicFocus: focusWeakAreas,
          difficulty,
          questions: res.questionSet.questions || [],
          createdAt: new Date().toISOString()
        };
        setCurrentSet(qSet);
      } else {
        throw new Error("Could not generate practice questions");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to generate practice questions. Please verify network connection and try again.");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Discuss Question in Chat
  const handleDiscussQuestionInChat = (q: PracticeQuestion) => {
    const promptText = `I am practicing a question on "${q.topicName || selectedSubject}":
Question: "${q.question}"
${q.options ? `Options: ${q.options.join(', ')}` : ''}

Can you explain the detailed concept behind this step by step, and show why the correct answer is: "${q.explanation}"?`;
    
    setActiveSubTab('chat');
    handleSendMessage(promptText);
  };

  // Selected Subject Object
  const currentSubjectObj = subjects.find(s => s.name === selectedSubject);

  // Score Calculation
  let totalScore = 0;
  if (currentSet && quizSubmitted) {
    currentSet.questions.forEach((q) => {
      if (q.type === 'mcq') {
        if (userAnswers[q.id] === q.correctOptionIndex) {
          totalScore += 1;
        }
      } else {
        // For short answer / conceptual self-graded
        if (userAnswers[q.id] === 'correct') {
          totalScore += 1;
        } else if (userAnswers[q.id] === 'partial') {
          totalScore += 0.5;
        }
      }
    });
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#6B705C]" />
            <span>AI Academic Tutor & Practice Generator</span>
          </h2>
          <p className="text-xs text-[#A5A58D] mt-1">
            Answers study questions with Firestore memory & generates customized practice questions for weak areas.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-[#F2EFE9] p-1.5 rounded-2xl border border-[#E0DBD0] shrink-0">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'chat'
                ? 'bg-white text-[#6B705C] shadow-xs'
                : 'text-[#A5A58D] hover:text-[#4A4E4D]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI Tutor Chat</span>
          </button>
          <button
            onClick={() => setActiveSubTab('practice')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'practice'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'text-[#A5A58D] hover:text-[#4A4E4D]'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Practice Questions</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: TUTOR CHAT */}
      {activeSubTab === 'chat' && (
        <div className="space-y-6">
          {/* Quick Prompts Bar */}
          <div className="bg-[#F2EFE9] border border-[#E0DBD0] rounded-3xl p-4 space-y-2">
            <span className="text-xs font-bold text-[#6B705C] flex items-center gap-1.5 uppercase tracking-widest">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ask standard academic questions:</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {presetQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-[#E0DBD0] hover:border-[#6B705C] hover:bg-[#F9F7F2] text-xs font-medium text-[#4A4E4D] transition shadow-2xs"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Box */}
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col h-[520px] relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E0DBD0]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-[#6B705C]">Live Cloud Synced Session</span>
              </div>
              {messages.length > 1 && (
                <button
                  onClick={handleClearChat}
                  className="text-[11px] font-medium text-[#A5A58D] hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
                  title="Clear conversation history across devices"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Clear Conversation</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xs ${
                      isUser ? 'bg-[#6B705C] text-white' : 'bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0]'
                    }`}>
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`max-w-[80%] rounded-2xl p-4 text-xs space-y-1 ${
                      isUser 
                        ? 'bg-[#6B705C] text-white rounded-tr-none' 
                        : 'bg-[#F9F7F2] border border-[#E0DBD0] text-[#4A4E4D] rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <span className={`block text-[10px] text-right ${isUser ? 'text-[#EAE7DF]' : 'text-[#A5A58D]'}`}>
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isLoadingChat && (
                <div className="flex items-center gap-2 text-xs text-[#6B705C] bg-[#F9F7F2] p-3 rounded-2xl border border-[#E0DBD0] w-max">
                  <Sparkles className="w-4 h-4 animate-spin text-[#6B705C]" />
                  <span>AI Tutor is thinking and querying your study database...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Controls */}
            <div className="pt-4 border-t border-[#E0DBD0] flex items-center gap-2 mt-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask AI Tutor anything about your study history, weak areas, or concepts..."
                className="flex-1 p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoadingChat || !inputMessage.trim()}
                className="p-3 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-2xl transition shadow-xs disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PRACTICE QUESTIONS GENERATOR */}
      {activeSubTab === 'practice' && (
        <div className="space-y-6">
          {/* Question Generator Config Card */}
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#6B705C] flex items-center gap-2 uppercase tracking-widest">
                <Brain className="w-4 h-4 text-[#6B705C]" />
                <span>Configure Practice Quiz</span>
              </h3>
              {weakTopics.length > 0 && (
                <span className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>{weakTopics.length} Weak Topics Detected</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Subject Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4A4E4D]">Target Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedChapter('');
                    setSelectedTopic('');
                  }}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  <option value="WEAK_AREAS">🎯 Auto-Focus on Weak Topics & Test Mistakes</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Chapter Selector (if subject selected) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4A4E4D]">Specific Chapter (Optional)</label>
                <select
                  value={selectedChapter}
                  onChange={(e) => {
                    setSelectedChapter(e.target.value);
                    setSelectedTopic('');
                  }}
                  disabled={selectedSubject === 'WEAK_AREAS' || !currentSubjectObj}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] disabled:opacity-50"
                >
                  <option value="">All Chapters</option>
                  {currentSubjectObj?.chapters.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Topic Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4A4E4D]">Specific Topic (Optional)</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={!selectedChapter || selectedSubject === 'WEAK_AREAS'}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C] disabled:opacity-50"
                >
                  <option value="">All Topics in Chapter</option>
                  {currentSubjectObj?.chapters
                    .find(c => c.name === selectedChapter)
                    ?.topics.map(t => (
                      <option key={t.id} value={t.name}>
                        {t.name} {t.status === 'Weak' ? '⚠️ (Weak)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Question Count */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4A4E4D]">Number of Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  <option value={3}>3 Questions (Quick Sprint)</option>
                  <option value={5}>5 Questions (Standard)</option>
                  <option value={10}>10 Questions (In-Depth Test)</option>
                </select>
              </div>

              {/* Difficulty */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4A4E4D]">Difficulty Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full p-3 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  <option value="Mixed">Mixed (Adaptive)</option>
                  <option value="Easy">Easy (Foundational)</option>
                  <option value="Medium">Medium (Exam Level)</option>
                  <option value="Hard">Hard (Challenging)</option>
                </select>
              </div>

              {/* Focus Toggle */}
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 text-xs font-bold text-[#4A4E4D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusWeakAreas}
                    onChange={(e) => setFocusWeakAreas(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span>Prioritize recorded test mistakes & weak topics</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerateQuestions}
                disabled={isGeneratingQuestions}
                className="px-6 py-3 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingQuestions ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Generating Practice Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Practice Set Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Practice Quiz Interface */}
          {currentSet && (
            <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E0DBD0] gap-2">
                <div>
                  <h3 className="text-base font-serif italic font-bold text-[#6B705C]">
                    {currentSet.subjectName} Practice Quiz
                  </h3>
                  <p className="text-xs text-[#A5A58D] mt-0.5">
                    Difficulty: {currentSet.difficulty} • {currentSet.questions.length} Questions
                  </p>
                </div>

                {quizSubmitted ? (
                  <div className="bg-[#6B705C] text-white px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold">
                    <Award className="w-4 h-4" />
                    <span>Score: {totalScore} / {currentSet.questions.length} ({Math.round((totalScore / currentSet.questions.length) * 100)}%)</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setQuizSubmitted(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-full shadow-xs transition"
                  >
                    Submit & Grade Quiz
                  </button>
                )}
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {currentSet.questions.map((q, idx) => {
                  const userAnswer = userAnswers[q.id];
                  const isMcq = q.type === 'mcq';
                  const showHint = revealedHints[q.id];
                  const showExp = revealedExplanations[q.id] || quizSubmitted;

                  return (
                    <div key={q.id || idx} className="p-5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-4 relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#6B705C] text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">
                            {q.topicName || currentSet.subjectName}
                          </span>
                          {q.difficulty && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#E0DBD0] text-[#A5A58D]">
                              {q.difficulty}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDiscussQuestionInChat(q)}
                          className="text-[11px] text-[#6B705C] hover:underline flex items-center gap-1 font-medium"
                          title="Ask AI Tutor to explain this step-by-step"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Discuss with Tutor</span>
                        </button>
                      </div>

                      <p className="text-xs font-bold text-[#4A4E4D] leading-relaxed">
                        {q.question}
                      </p>

                      {/* Options for MCQ */}
                      {isMcq && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userAnswer === optIdx;
                            const isCorrect = optIdx === q.correctOptionIndex;

                            let btnStyle = "bg-white border-[#E0DBD0] text-[#4A4E4D] hover:border-[#6B705C]";
                            if (quizSubmitted) {
                              if (isCorrect) {
                                btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-900 font-bold";
                              } else if (isSelected && !isCorrect) {
                                btnStyle = "bg-rose-50 border-rose-300 text-rose-900 font-bold";
                              }
                            } else if (isSelected) {
                              btnStyle = "bg-[#6B705C] text-white border-[#6B705C] font-bold";
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={quizSubmitted}
                                onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                className={`p-3 rounded-2xl border text-xs text-left transition flex items-center justify-between gap-2 ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {quizSubmitted && isCorrect && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                                {quizSubmitted && isSelected && !isCorrect && (
                                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Short Answer Input / Self-Grading */}
                      {!isMcq && (
                        <div className="space-y-3 pt-1">
                          <textarea
                            rows={3}
                            disabled={quizSubmitted}
                            placeholder="Type your brief answer or calculations here..."
                            value={(userAnswer as string) || ''}
                            onChange={(e) => setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-full p-3 bg-white border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                          />

                          {quizSubmitted && (
                            <div className="p-3 bg-white border border-[#E0DBD0] rounded-2xl flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#4A4E4D]">Grade your answer:</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: 'correct' }))}
                                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                                    userAnswer === 'correct' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'
                                  }`}
                                >
                                  Correct (1.0)
                                </button>
                                <button
                                  onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: 'partial' }))}
                                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                                    userAnswer === 'partial' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'
                                  }`}
                                >
                                  Partial (0.5)
                                </button>
                                <button
                                  onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: 'incorrect' }))}
                                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                                    userAnswer === 'incorrect' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                                  }`}
                                >
                                  Incorrect (0)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Hint & Explanation controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E0DBD0]/60">
                        <div className="flex items-center gap-2">
                          {q.hint && (
                            <button
                              onClick={() => setRevealedHints(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                              className="text-[11px] text-[#6B705C] hover:underline flex items-center gap-1"
                            >
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                              <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => setRevealedExplanations(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="text-[11px] text-[#A5A58D] hover:text-[#4A4E4D] font-medium"
                        >
                          {showExp ? 'Hide Model Explanation' : 'View Model Explanation'}
                        </button>
                      </div>

                      {/* Revealed Hint Box */}
                      {showHint && (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-0.5 animate-fade-in">
                          <span className="font-bold flex items-center gap-1 text-[11px]">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            Hint:
                          </span>
                          <p>{q.hint}</p>
                        </div>
                      )}

                      {/* Revealed Explanation Box */}
                      {showExp && (
                        <div className="p-4 bg-white border border-[#E0DBD0] text-[#4A4E4D] rounded-2xl text-xs space-y-1 animate-fade-in">
                          <span className="font-bold text-[#6B705C] flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            Model Explanation & Key Concepts:
                          </span>
                          <p className="whitespace-pre-wrap leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
