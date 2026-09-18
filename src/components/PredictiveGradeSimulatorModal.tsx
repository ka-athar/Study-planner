import React, { useState, useMemo } from 'react';
import { 
  X, 
  Award, 
  Sparkles, 
  TrendingUp, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  Smile, 
  HelpCircle,
  BarChart3
} from 'lucide-react';
import { Subject, TestResult, UserProfile, ActiveTab } from '../types';

interface PredictiveGradeSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  testResults: TestResult[];
  userProfile?: UserProfile | null;
  onNavigateToTests?: () => void;
  onStartComfortTest?: (subjectName: string) => void;
}

export const PredictiveGradeSimulatorModal: React.FC<PredictiveGradeSimulatorModalProps> = ({
  isOpen,
  onClose,
  subjects,
  testResults,
  userProfile,
  onNavigateToTests,
  onStartComfortTest
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [examPaceMode, setExamPaceMode] = useState<'optimistic' | 'standard' | 'conservative'>('standard');

  // Calculate Predictive Analytics
  const predictions = useMemo(() => {
    let totalTopics = 0;
    let completedTopics = 0;
    
    const subjectBreakdown = subjects.map(sub => {
      let subTopics = 0;
      let subCompleted = 0;
      (sub.chapters || []).forEach(chap => {
        (chap.topics || []).forEach(top => {
          subTopics++;
          if (top.completed) subCompleted++;
        });
      });

      totalTopics += subTopics;
      completedTopics += subCompleted;

      const completionPct = subTopics > 0 ? Math.round((subCompleted / subTopics) * 100) : 0;
      
      // Calculate past test score average for this subject
      const subTests = testResults.filter(t => t.subjectId === sub.id || t.subjectId === sub.name);
      const testAvg = subTests.length > 0 
        ? Math.round(subTests.reduce((acc, t) => acc + (t.score / Math.max(1, t.totalMarks)) * 100, 0) / subTests.length)
        : Math.min(88, completionPct > 0 ? completionPct + 10 : 70);

      // Blended prediction
      const predictedScore = Math.min(98, Math.max(50, Math.round(completionPct * 0.45 + testAvg * 0.55)));
      
      const letterGrade = 
        predictedScore >= 90 ? 'A+' :
        predictedScore >= 80 ? 'A' :
        predictedScore >= 70 ? 'B' :
        predictedScore >= 60 ? 'C' : 'D';

      return {
        id: sub.id,
        name: sub.name,
        icon: sub.icon || '📚',
        color: sub.color || '#6B705C',
        completionPct,
        testAvg,
        predictedScore,
        letterGrade,
        status: predictedScore >= 80 ? 'Solid Mastery' : predictedScore >= 65 ? 'Approaching Target' : 'Needs Reinforcement'
      };
    });

    const overallPredictedScore = subjectBreakdown.length > 0
      ? Math.round(subjectBreakdown.reduce((acc, s) => acc + s.predictedScore, 0) / subjectBreakdown.length)
      : 78;

    const overallLetterGrade = 
      overallPredictedScore >= 90 ? 'A+' :
      overallPredictedScore >= 80 ? 'A' :
      overallPredictedScore >= 70 ? 'B' :
      overallPredictedScore >= 60 ? 'C' : 'D';

    const readinessIndex = Math.min(100, Math.round(overallPredictedScore * 0.95 + (completedTopics / Math.max(1, totalTopics)) * 10));

    return {
      overallPredictedScore,
      overallLetterGrade,
      readinessIndex,
      totalTopics,
      completedTopics,
      subjectBreakdown
    };
  }, [subjects, testResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-[#E0DBD0] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2EFE9] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#4A4E4D]">Predictive Grade & Readiness Simulator</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Low-Stress Diagnostic
                </span>
              </div>
              <p className="text-xs text-[#6B705C]">Cognitive exam projection without test anxiety</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A5A58D] hover:text-[#4A4E4D] hover:bg-[#F2EFE9] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Hero Score Gauge */}
          <div className="rounded-3xl p-6 bg-gradient-to-br from-[#FAF8F5] to-emerald-50/40 border border-[#E0DBD0] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                Cognitive Readiness Forecast
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#4A4E4D]">
                Projected Standing: Grade <span className="text-emerald-700 font-serif italic text-3xl font-black">{predictions.overallLetterGrade}</span>
              </h3>
              <p className="text-xs text-[#6B705C] max-w-md">
                Based on your {predictions.completedTopics} of {predictions.totalTopics} completed syllabus topics, past quiz scores, and revision cycles.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] text-center min-w-[110px] shadow-2xs">
                <div className="text-3xl font-bold text-[#4A4E4D]">
                  {predictions.overallPredictedScore}%
                </div>
                <span className="text-[10px] uppercase font-bold text-[#A5A58D]">Est. Exam Score</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-600 text-white text-center min-w-[110px] shadow-md">
                <div className="text-3xl font-bold font-serif italic">
                  {predictions.readinessIndex}%
                </div>
                <span className="text-[10px] uppercase font-bold opacity-80">Readiness</span>
              </div>
            </div>
          </div>

          {/* Gentle Philosophy Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
            <Smile className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Zero-Stress Principle:</span>
              <p className="text-amber-800/90 leading-relaxed">
                You do not need to sit through high-stress practice tests to gauge your preparation. This simulator updates automatically as you complete daily study sessions and flashcard reviews.
              </p>
            </div>
          </div>

          {/* Subject by Subject Predicted Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#4A4E4D] uppercase tracking-wider">
              Subject-Level Predicted Breakdown
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {predictions.subjectBreakdown.map(sub => (
                <div key={sub.id} className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sub.icon}</span>
                      <span className="text-xs font-bold text-[#4A4E4D]">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#4A4E4D]">{sub.predictedScore}%</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#E0DBD0] text-emerald-700">
                        {sub.letterGrade}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#E0DBD0]/60 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${sub.predictedScore}%`,
                        backgroundColor: sub.color || '#10B981'
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6B705C]">
                    <span>Syllabus Covered: {sub.completionPct}%</span>
                    <span className="font-medium text-emerald-700">{sub.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Low-Stress Practice Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => {
                if (onNavigateToTests) onNavigateToTests();
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Open Formal Mock Exam Arena</span>
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer text-center"
            >
              Done / Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
