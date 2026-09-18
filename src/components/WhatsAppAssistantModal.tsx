import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Smartphone, 
  Info, 
  Sparkles, 
  Flame, 
  BookOpen,
  Bot,
  MessageSquare,
  Clock,
  Bell,
  CheckCheck,
  RotateCcw,
  Calendar,
  Zap,
  Loader2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { 
  generateMorningFlightPlanMessage, 
  generateDailyDigestMessage, 
  generateRevisionReminderMessage, 
  buildWaMeUrl, 
  loadWhatsAppConfig, 
  saveWhatsAppConfig 
} from '../lib/whatsappHelper';
import { apiWhatsAppCoachReply } from '../lib/aiApi';
import { testFreeCallMeBot } from '../lib/notificationService';

interface WhatsAppAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
  priorityTopics?: { subject: string; title: string; duration: number }[];
  flashcardsDueCount?: number;
  dailyGoalHours?: number;
  hoursStudiedToday?: number;
  xpEarnedToday?: number;
  onAwardXP?: (xp: number, reason: string) => void;
  onLogStudyMinutes?: (mins: number) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  time: string;
}

const COUNTRY_CODES = [
  { code: '+1', country: 'US/Canada' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+92', country: 'Pakistan (FBISE)' },
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+61', country: 'Australia' },
  { code: '+49', country: 'Germany' },
];

export const WhatsAppAssistantModal: React.FC<WhatsAppAssistantModalProps> = ({
  isOpen,
  onClose,
  streak,
  priorityTopics = [
    { subject: 'Physics', title: 'Thermodynamics Carnot Cycle', duration: 45 },
    { subject: 'Chemistry', title: 'Electrochemical Cells & Nernst Eq', duration: 35 },
    { subject: 'Biology', title: 'Cellular Respiration Krebs Cycle', duration: 30 },
  ],
  flashcardsDueCount = 18,
  dailyGoalHours = 3,
  hoursStudiedToday = 2.5,
  xpEarnedToday = 145,
  onAwardXP,
  onLogStudyMinutes
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat_coach' | 'instant_dispatch' | 'scheduled_alerts'>('chat_coach');
  const [config, setConfig] = useState(loadWhatsAppConfig());
  const [selectedTemplate, setSelectedTemplate] = useState<'morning' | 'digest' | 'revision'>('morning');
  const [copied, setCopied] = useState(false);
  const [customTopic, setCustomTopic] = useState({ subject: 'Physics', topic: 'Thermodynamics Carnot Cycle', urgency: 'High (Review Due)' });
  
  // Two-Way Interactive WhatsApp Coach Bot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        sender: 'coach',
        text: `👋 *Welcome to your WhatsApp Study Coach Bot!*\n\nI'm connected to your academic syllabus and streak tracker (${streak} days 🔥).\n\nYou can:\n- Text *"Studied 45 mins Physics"* to log study time & earn XP\n- Ask *"What should I study next?"*\n- Send *"Morning Plan"* to get today's flight plan\n\nHow's your revision going today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    'Studied 30m Physics ⏱️',
    'Next high-yield topic? 🎯',
    'Morning Flight Plan 🌅',
    'Feeling unmotivated 💡'
  ]);

  const [morningAlertsEnabled, setMorningAlertsEnabled] = useState(true);
  const [eveningAlertsEnabled, setEveningAlertsEnabled] = useState(true);
  const [testAlertSent, setTestAlertSent] = useState(false);

  // Free CallMeBot Automated Delivery State
  const [callMeBotApiKey, setCallMeBotApiKey] = useState(config.callMeBotApiKey || '');
  const [isTestingCallMeBot, setIsTestingCallMeBot] = useState(false);
  const [callMeBotResult, setCallMeBotResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestCallMeBot = async () => {
    if (!config.phoneNumber) {
      setCallMeBotResult({
        success: false,
        message: 'Please enter your phone number with country code.'
      });
      return;
    }
    if (!callMeBotApiKey) {
      setCallMeBotResult({
        success: false,
        message: 'Please enter your free CallMeBot API key. Send "I allow callmebot to send me messages" to +34 644 76 66 43 on WhatsApp to receive it instantly!'
      });
      return;
    }
    setIsTestingCallMeBot(true);
    setCallMeBotResult(null);
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const text = `🌅 *StudyFlow Morning Alert* (${dateStr}): Your study streak is ${streak} days strong! Keep conquering your revision goals today.`;
    const res = await testFreeCallMeBot(config.phoneNumber, callMeBotApiKey, text);
    setIsTestingCallMeBot(false);
    setCallMeBotResult(res);
  };

  const handleCallMeBotApiKeyChange = (val: string) => {
    setCallMeBotApiKey(val);
    const updated = { ...config, callMeBotApiKey: val };
    setConfig(updated);
    saveWhatsAppConfig(updated);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSubTab === 'chat_coach') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isCoachThinking, activeSubTab]);

  if (!isOpen) return null;

  const briefData = {
    streak,
    priorityTopics,
    flashcardsDueCount,
    dailyGoalHours,
    hoursStudiedToday,
    xpEarnedToday,
  };

  let currentMessage = '';
  if (selectedTemplate === 'morning') {
    currentMessage = generateMorningFlightPlanMessage(briefData);
  } else if (selectedTemplate === 'digest') {
    currentMessage = generateDailyDigestMessage(briefData);
  } else {
    currentMessage = generateRevisionReminderMessage(customTopic.subject, customTopic.topic, customTopic.urgency);
  }

  const handlePhoneChange = (val: string) => {
    const updated = { ...config, phoneNumber: val };
    setConfig(updated);
    saveWhatsAppConfig(updated);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenWhatsApp = () => {
    const url = buildWaMeUrl(config.phoneNumber, currentMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendCoachMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim() || isCoachThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsCoachThinking(true);

    try {
      const res = await apiWhatsAppCoachReply({
        userMessage: textToSend.trim(),
        chatHistory: chatMessages.slice(-6).map(m => ({ sender: m.sender, text: m.text })),
        studentData: {
          streak,
          dailyGoalHours,
          hoursStudiedToday,
          enrolledSubjects: priorityTopics.map(p => p.subject),
          targetExamYear: 'FBISE Finals'
        }
      });

      const coachMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: res.coachReply || "🔥 Keep pushing! Let's conquer the next topic.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, coachMsg]);

      if (res.suggestedQuickReplies && Array.isArray(res.suggestedQuickReplies)) {
        setQuickReplies(res.suggestedQuickReplies);
      }

      if (res.loggedMinutes && res.loggedMinutes > 0 && onLogStudyMinutes) {
        onLogStudyMinutes(res.loggedMinutes);
      }

      if (res.xpAwarded && res.xpAwarded > 0 && onAwardXP) {
        onAwardXP(res.xpAwarded, `WhatsApp Study Check-in`);
      }
    } catch (err) {
      console.error('Coach reply failed:', err);
      const fallbackMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: `🔥 Great check-in! Logged your progress. Your ${streak}-day streak is secured. Keep your momentum going!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsCoachThinking(false);
    }
  };

  const handleTestAlertNotification = () => {
    setTestAlertSent(true);
    setTimeout(() => setTestAlertSent(false), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-[#E0DBD0] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with WhatsApp Branding */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2EFE9] bg-[#075E54] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Automated WhatsApp Study Coach Bot</h2>
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
              </div>
              <p className="text-xs text-emerald-100">Interactive study check-ins, automated flight plans & streak logging</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs: Two-Way Chat Coach vs. 1-Click WhatsApp Dispatch vs. Alerts */}
        <div className="flex items-center border-b border-[#E0DBD0] bg-[#FAF8F5] px-4 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('chat_coach')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeSubTab === 'chat_coach'
                ? 'border-[#075E54] text-[#075E54]'
                : 'border-transparent text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>AI Study Coach Bot</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-[#25D366] text-white font-mono">Live</span>
          </button>

          <button
            onClick={() => setActiveSubTab('instant_dispatch')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeSubTab === 'instant_dispatch'
                ? 'border-[#075E54] text-[#075E54]'
                : 'border-transparent text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>1-Click wa.me Dispatch</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scheduled_alerts')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeSubTab === 'scheduled_alerts'
                ? 'border-[#075E54] text-[#075E54]'
                : 'border-transparent text-[#6B705C] hover:text-[#4A4E4D]'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Scheduled Alerts</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. TWO-WAY INTERACTIVE CHAT COACH */}
          {activeSubTab === 'chat_coach' && (
            <div className="flex flex-col h-[520px] bg-[#EFEAE2]">
              {/* WhatsApp Chat Message Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs relative ${
                        msg.sender === 'user'
                          ? 'bg-[#E7FFDB] text-[#111B21] rounded-tr-xs'
                          : 'bg-white text-[#111B21] rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-stone-500">
                        <span>{msg.time}</span>
                        {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-sky-500" />}
                      </div>
                    </div>
                  </div>
                ))}

                {isCoachThinking && (
                  <div className="flex items-center gap-2 text-xs text-[#075E54] bg-white/80 p-2.5 rounded-2xl w-fit shadow-xs animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#25D366]" />
                    <span>StudyCoach is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Suggestions */}
              <div className="p-2 bg-[#F0F2F5] border-t border-[#DCD6CD] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendCoachMessage(qr)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-[#075E54] border border-[#DCD6CD] text-[11px] font-semibold whitespace-nowrap transition cursor-pointer shrink-0 active:scale-95"
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Message Input Box */}
              <div className="p-3 bg-[#F0F2F5] border-t border-[#DCD6CD] flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCoachMessage()}
                  placeholder="Text your study coach (e.g. 'Studied 45 mins Physics')..."
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-[#DCD6CD] text-xs text-[#111B21] focus:outline-hidden focus:ring-2 focus:ring-[#25D366]"
                />
                <button
                  onClick={() => handleSendCoachMessage()}
                  disabled={!inputMessage.trim() || isCoachThinking}
                  className="p-2.5 rounded-2xl bg-[#00A884] hover:bg-[#008f6f] text-white transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 2. 1-CLICK WA.ME DISPATCH */}
          {activeSubTab === 'instant_dispatch' && (
            <div className="p-6 space-y-5">
              {/* User Phone Number Config */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0] space-y-2">
                <label className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Target WhatsApp Number (Your number or study buddy):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={config.phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="e.g. +92 300 1234567 or +1 555 123 4567"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E0DBD0] bg-white text-xs text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>
                <p className="text-[11px] text-[#6B705C]">
                  Leave empty to open WhatsApp with pre-filled text so you can choose any contact, self-chat, or group!
                </p>
              </div>

              {/* Template Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#4A4E4D]">Select Message Type:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedTemplate('morning')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                      selectedTemplate === 'morning'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                        : 'bg-white border-[#E0DBD0] hover:bg-[#FAF8F5] text-[#4A4E4D]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>🌅</span>
                      <span>Morning Flight Plan</span>
                    </div>
                    <span className="text-[10px] text-[#6B705C] leading-tight">Priority tasks & daily target</span>
                  </button>

                  <button
                    onClick={() => setSelectedTemplate('digest')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                      selectedTemplate === 'digest'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                        : 'bg-white border-[#E0DBD0] hover:bg-[#FAF8F5] text-[#4A4E4D]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>📊</span>
                      <span>Daily Study Recap</span>
                    </div>
                    <span className="text-[10px] text-[#6B705C] leading-tight">Hours logged & streak stats</span>
                  </button>

                  <button
                    onClick={() => setSelectedTemplate('revision')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                      selectedTemplate === 'revision'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                        : 'bg-white border-[#E0DBD0] hover:bg-[#FAF8F5] text-[#4A4E4D]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>⚡</span>
                      <span>Revision Alert</span>
                    </div>
                    <span className="text-[10px] text-[#6B705C] leading-tight">Forgetting curve reminder</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Message Bubble Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#4A4E4D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Chat Bubble Preview:</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#6B705C]">Formatted with WhatsApp Markdown</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#EFEAE2] border border-[#DCD6CD] shadow-inner font-sans text-xs text-[#111B21] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  <div className="bg-[#D9FDD3] p-3.5 rounded-xl shadow-xs border border-[#C5ECC0] max-w-lg ml-auto">
                    {currentMessage}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleCopy}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#6B705C]" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={handleOpenWhatsApp}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebd59] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in WhatsApp & Send</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. SCHEDULED ALERTS */}
          {activeSubTab === 'scheduled_alerts' && (
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#4A4E4D] flex items-center gap-2">
                      <span>🌅 Morning Flight Plan Alert (7:30 AM)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">Active</span>
                    </span>
                    <p className="text-[11px] text-[#6B705C]">Generates top 3 priority tasks and scheduled study blocks.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={morningAlertsEnabled}
                    onChange={(e) => setMorningAlertsEnabled(e.target.checked)}
                    className="w-5 h-5 rounded-md accent-[#25D366] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#4A4E4D] flex items-center gap-2">
                      <span>🌙 Evening Reflection & Streak Shield (8:00 PM)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">Active</span>
                    </span>
                    <p className="text-[11px] text-[#6B705C]">Sends today's hours logged and streak freeze warnings.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={eveningAlertsEnabled}
                    onChange={(e) => setEveningAlertsEnabled(e.target.checked)}
                    className="w-5 h-5 rounded-md accent-[#25D366] cursor-pointer"
                  />
                </div>
              </div>

              {/* Free Autonomous CallMeBot Gateway Card */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#25D366]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 text-[#25D366] flex items-center justify-center font-bold text-sm">
                      W
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#4A4E4D]">Autonomous WhatsApp Gateway (CallMeBot)</h4>
                      <p className="text-[10px] text-emerald-700 font-semibold">100% Free • No Twilio • No Subscription</p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#6B705C] leading-relaxed">
                  To receive automated WhatsApp reminders autonomously without clicking links, authorize CallMeBot on WhatsApp:
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://wa.me/34644766643?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#FAF8F5] text-[11px] font-bold text-[#075E54] shadow-2xs"
                  >
                    <span>1. Server A: Activate in WhatsApp (+34 644 76 66 43)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://wa.me/34644442619?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#FAF8F5] text-[11px] font-bold text-[#075E54] shadow-2xs"
                  >
                    <span>2. Server B: Activate in WhatsApp (+34 644 44 26 19)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#4A4E4D] block mb-1">
                      Your WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      value={config.phoneNumber || ''}
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#4A4E4D] block mb-1">
                      Free CallMeBot API Key
                    </label>
                    <input
                      type="text"
                      value={callMeBotApiKey}
                      onChange={e => handleCallMeBotApiKeyChange(e.target.value)}
                      placeholder="e.g. 1234567"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DBD0] text-xs font-mono text-[#4A4E4D] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTestCallMeBot}
                  disabled={isTestingCallMeBot}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingCallMeBot ? 'Dispatching Test...' : 'Send Test WhatsApp Alert (Autonomous)'}</span>
                </button>

                {callMeBotResult && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    callMeBotResult.success
                      ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-100/80 text-rose-900 border border-rose-300'
                  }`}>
                    {callMeBotResult.success ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Info className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{callMeBotResult.message}</span>
                  </div>
                )}
              </div>

              {testAlertSent && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Test WhatsApp dispatch fired! Check your WhatsApp companion.</span>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={handleOpenWhatsApp}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Open WhatsApp wa.me Link Now</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-2xl bg-[#075E54] hover:bg-[#05443d] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Alert Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
