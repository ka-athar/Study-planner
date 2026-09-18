import React, { useState } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Building2, 
  Target, 
  Award, 
  Edit3, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  TrendingUp 
} from 'lucide-react';
import { UserProfile, Subject, ExamDate } from '../types';
import { EditYearProfileModal } from './EditYearProfileModal';

interface YearProfileCardProps {
  userProfile: UserProfile | null;
  subjects?: Subject[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigateTab?: (tab: any) => void;
  compact?: boolean;
}

export const YearProfileCard: React.FC<YearProfileCardProps> = ({
  userProfile,
  subjects = [],
  onUpdateProfile,
  onNavigateTab,
  compact = false
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fallback defaults if userProfile is not yet filled
  const academicYear = userProfile?.academicYear || '2026 - 2027';
  const yearLevel = userProfile?.yearLevel || 'Year 3 (Junior)';
  const semesterOrTerm = userProfile?.semesterOrTerm || 'Fall Semester';
  const targetExamYear = userProfile?.targetExamYear || '2027';
  const institution = userProfile?.institution || 'Academic University';
  const majorOrStream = userProfile?.majorOrStream || 'STEM & Computer Science';
  const targetGpaOrScore = userProfile?.targetGpaOrScore || '3.8 GPA / 90%+';
  const targetHours = userProfile?.targetHoursPerDay || 3;

  // Calculate Academic Year Timeline & Progress
  const now = new Date();
  const startDateStr = userProfile?.academicYearStartDate || `${now.getFullYear()}-08-01`;
  const endDateStr = userProfile?.academicYearEndDate || `${now.getFullYear() + 1}-05-31`;
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const yearProgressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  // Closest Upcoming Exam Date
  const upcomingExams = userProfile?.examDates || [];
  const nextExam = upcomingExams
    .filter(e => new Date(e.date).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;

  const daysToNextExam = nextExam 
    ? Math.max(0, Math.ceil((new Date(nextExam.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  if (compact) {
    return (
      <>
        <div 
          onClick={() => setIsEditModalOpen(true)}
          className="p-3 bg-surface hover:bg-theme-accent border border-theme rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition shadow-2xs group"
          title="Click to view or edit Academic Year Profile"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <span>{academicYear}</span>
                <span className="text-[10px] text-muted">• {yearLevel}</span>
              </div>
              <div className="text-[10px] text-muted truncate max-w-[180px]">
                {semesterOrTerm} • {majorOrStream}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-primary font-medium group-hover:translate-x-0.5 transition">
            <span className="hidden sm:inline font-mono">{yearProgressPercent}% Year Done</span>
            <Edit3 className="w-3.5 h-3.5 text-muted group-hover:text-primary" />
          </div>
        </div>

        <EditYearProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userProfile={userProfile}
          onUpdateProfile={onUpdateProfile}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-card border border-theme rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 relative overflow-hidden">
        {/* Top Bar: Title & Edit Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                  Academic Year Profile
                </span>
                <span className="text-xs font-mono font-bold text-primary bg-surface px-2 py-0.5 rounded-md border border-theme">
                  {academicYear}
                </span>
                <span className="text-xs font-semibold text-muted">
                  {semesterOrTerm}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-serif italic font-bold text-primary mt-0.5 flex items-center gap-2">
                <span>{yearLevel}</span>
                <span className="text-xs font-sans not-italic text-muted font-normal">• {institution}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
              title="Edit Academic Year, Class level, Stream and Timeline"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" />
              <span>Edit Year Profile</span>
            </button>
          </div>
        </div>

        {/* 4-Column Academic Year Vital Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Target Exam Year & Stream */}
          <div className="p-3 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
              <span>Target Year</span>
              <Target className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold font-mono text-primary">{targetExamYear}</div>
            <div className="text-[10px] text-muted truncate">{majorOrStream}</div>
          </div>

          {/* Academic Progression */}
          <div className="p-3 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
              <span>Year Timeline</span>
              <Calendar className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold font-mono text-primary">{yearProgressPercent}%</div>
            <div className="text-[10px] text-muted">{remainingDays} days remaining</div>
          </div>

          {/* Enrolled Syllabus Subjects */}
          <div className="p-3 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
              <span>Enrolled Courses</span>
              <Award className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold font-mono text-primary">{subjects.length} Subjects</div>
            <div className="text-[10px] text-muted">Active curriculum syllabus</div>
          </div>

          {/* Target Aim & Pace */}
          <div className="p-3 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
              <span>Target Aim</span>
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold text-primary truncate">{targetGpaOrScore}</div>
            <div className="text-[10px] text-muted">{targetHours} hrs/day daily pace</div>
          </div>
        </div>

        {/* Academic Year Timeline Progress Bar */}
        <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-primary">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Academic Year Timeline ({startDateStr} to {endDateStr})</span>
            </div>
            <span className="font-mono font-bold text-primary text-xs">
              Day {elapsedDays} of {totalDays} ({yearProgressPercent}%)
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full h-2.5 rounded-full bg-theme-accent/60 overflow-hidden relative">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${yearProgressPercent}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-muted gap-1 pt-0.5">
            <span>Current Term: <strong className="text-primary">{semesterOrTerm}</strong> • {majorOrStream}</span>
            {nextExam && daysToNextExam !== null ? (
              <span className="text-primary font-medium">
                🎯 Next Milestone: <strong className="text-primary">{nextExam.examName}</strong> ({nextExam.date}) — in <strong>{daysToNextExam} days</strong>
              </span>
            ) : (
              <span>Target Graduation / Exam Horizon: <strong className="text-primary">{targetExamYear}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Year Profile Modal */}
      <EditYearProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={onUpdateProfile}
      />
    </>
  );
};
