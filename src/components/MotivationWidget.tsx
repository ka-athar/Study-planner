import React, { useState, useEffect } from 'react';
import { Quote, Sparkles, RefreshCw, Bookmark, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AcademicQuote {
  quote: string;
  author: string;
  role: string;
  tag: string;
}

const ACADEMIC_QUOTES: AcademicQuote[] = [
  {
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
    role: "Philosopher & Leader",
    tag: "Lifelong Learning"
  },
  {
    quote: "It is not that I'm so smart, it's just that I stay with problems longer.",
    author: "Albert Einstein",
    role: "Theoretical Physicist",
    tag: "Perseverance"
  },
  {
    quote: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.",
    author: "Marie Curie",
    role: "Nobel Laureate Physicist & Chemist",
    tag: "Curiosity"
  },
  {
    quote: "The first principle is that you must not fool yourself and you are the easiest person to fool.",
    author: "Richard Feynman",
    role: "Theoretical Physicist",
    tag: "Intellectual Honesty"
  },
  {
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    role: "Ancient Philosopher",
    tag: "Consistency"
  },
  {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
    role: "Human Rights Leader",
    tag: "Purpose"
  },
  {
    quote: "Develop a passion for learning. If you do, you will never cease to grow.",
    author: "Anthony J. D'Angelo",
    role: "Educator & Author",
    tag: "Growth Mindset"
  },
  {
    quote: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin",
    role: "Polymath & Inventor",
    tag: "Value of Study"
  },
  {
    quote: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
    role: "Scholar & Artist",
    tag: "Mastery"
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
    role: "Author",
    tag: "Daily Progress"
  },
  {
    quote: "You don't have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
    role: "Author & Speaker",
    tag: "Action"
  },
  {
    quote: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King",
    role: "Musician & Thinker",
    tag: "Empowerment"
  },
  {
    quote: "Luck is what happens when preparation meets opportunity.",
    author: "Seneca",
    role: "Stoic Philosopher",
    tag: "Preparation"
  },
  {
    quote: "If you want to teach people a new way of thinking, don't bother trying to teach them. Give them a tool, the use of which will lead to new ways of thinking.",
    author: "Buckminster Fuller",
    role: "Architect & Systems Theorist",
    tag: "Deep Focus"
  }
];

export const MotivationWidget: React.FC = () => {
  // Hash today's date string (YYYY-MM-DD) to get a consistent quote of the day
  const todayStr = new Date().toISOString().split('T')[0];
  
  const getDailyIndex = (dateStr: string) => {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash << 5) - hash + dateStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % ACADEMIC_QUOTES.length;
  };

  const [currentIndex, setCurrentIndex] = useState<number>(() => getDailyIndex(todayStr));
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const currentQuote = ACADEMIC_QUOTES[currentIndex];

  const handleNextQuote = () => {
    setCurrentIndex((prev) => (prev + 1) % ACADEMIC_QUOTES.length);
    setCopied(false);
  };

  const handleCopyQuote = () => {
    const textToCopy = `"${currentQuote.quote}" — ${currentQuote.author}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between gap-4"
    >
      {/* Top Tag & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-[#6B705C]/10 text-[#6B705C]">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#6B705C]">
            Quote of the Day
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F2EFE9] text-[#A5A58D] border border-[#E0DBD0]">
            {currentQuote.tag}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyQuote}
            className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
            title="Copy Quote to Clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              isSaved ? 'text-[#6B705C] bg-[#6B705C]/10' : 'text-[#A5A58D] hover:bg-[#F2EFE9] hover:text-[#4A4E4D]'
            }`}
            title={isSaved ? "Saved to Favorites" : "Save Quote"}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleNextQuote}
            className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer"
            title="Get Another Quote"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quote Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.25 }}
          className="space-y-2 py-1"
        >
          <div className="flex gap-3">
            <Quote className="w-6 h-6 text-[#6B705C]/30 shrink-0 transform -scale-x-100" />
            <p className="text-base sm:text-lg font-serif italic text-[#4A4E4D] leading-relaxed">
              "{currentQuote.quote}"
            </p>
          </div>

          <div className="pl-9 text-xs">
            <span className="font-bold text-[#6B705C]">— {currentQuote.author}</span>
            <span className="text-[#A5A58D] ml-1.5">({currentQuote.role})</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
