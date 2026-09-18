import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  X, 
  Calendar, 
  BookOpen, 
  Building2, 
  Award, 
  Target, 
  Sparkles, 
  Save, 
  Clock 
} from 'lucide-react';
import { UserProfile } from '../types';

interface EditYearProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

export const EditYearProfileModal: React.FC<EditYearProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile
}) => {
  const [displayName, setDisplayName] = useState<string>(userProfile?.displayName || userProfile?.name || 'Student');
  const [academicYear, setAcademicYear] = useState<string>(userProfile?.academicYear || '2026 - 2027');
  const [yearLevel, setYearLevel] = useState<string>(userProfile?.yearLevel || 'Year 3 (Junior)');
  const [semesterOrTerm, setSemesterOrTerm] = useState<string>(userProfile?.semesterOrTerm || 'Fall Semester');
  const [targetExamYear, setTargetExamYear] = useState<string>(userProfile?.targetExamYear || '2027');
  const [institution, setInstitution] = useState<string>(userProfile?.institution || 'Academic University');
  const [majorOrStream, setMajorOrStream] = useState<string>(userProfile?.majorOrStream || 'STEM & Computer Science');
  const [academicYearStartDate, setAcademicYearStartDate] = useState<string>(userProfile?.academicYearStartDate || '2026-08-01');
  const [academicYearEndDate, setAcademicYearEndDate] = useState<string>(userProfile?.academicYearEndDate || '2027-05-31');
  const [targetGpaOrScore, setTargetGpaOrScore] = useState<string>(userProfile?.targetGpaOrScore || '3.8 GPA / 90%+');
  const [targetHours, setTargetHours] = useState<number>(userProfile?.targetHoursPerDay || 3);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Sync state whenever userProfile or modal visibility changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName || userProfile.name) {
        setDisplayName(userProfile.displayName || userProfile.name || 'Student');
      }
      if (userProfile.academicYear) setAcademicYear(userProfile.academicYear);
      if (userProfile.yearLevel) setYearLevel(userProfile.yearLevel);
      if (userProfile.semesterOrTerm) setSemesterOrTerm(userProfile.semesterOrTerm);
      if (userProfile.targetExamYear) setTargetExamYear(userProfile.targetExamYear);
      if (userProfile.institution) setInstitution(userProfile.institution);
      if (userProfile.majorOrStream) setMajorOrStream(userProfile.majorOrStream);
      if (userProfile.academicYearStartDate) setAcademicYearStartDate(userProfile.academicYearStartDate);
      if (userProfile.academicYearEndDate) setAcademicYearEndDate(userProfile.academicYearEndDate);
      if (userProfile.targetGpaOrScore) setTargetGpaOrScore(userProfile.targetGpaOrScore);
      if (userProfile.targetHoursPerDay) setTargetHours(userProfile.targetHoursPerDay);
    }
  }, [userProfile, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateProfile({
      displayName,
      name: displayName,
      academicYear,
      yearLevel,
      semesterOrTerm,
      targetExamYear,
      institution,
      majorOrStream,
      academicYearStartDate,
      academicYearEndDate,
      targetGpaOrScore,
      targetHoursPerDay: targetHours,
      yearProfile: {
        academicYear,
        yearLevel,
        semesterOrTerm,
        targetExamYear,
        institution,
        majorOrStream,
        academicYearStartDate,
        academicYearEndDate,
        targetGpaOrScore,
        graduationYear: targetExamYear
      }
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const yearPresets = ['2026 - 2027', '2025 - 2026', '2027 - 2028', '2026', '2027'];
  const levelPresets = [
    'Year 1 (Freshman)', 
    'Year 2 (Sophomore)', 
    'Year 3 (Junior)', 
    'Year 4 / Senior (Final Year)', 
    'Class 10 / Secondary', 
    'Class 11 - 12 / Pre-University', 
    'Postgraduate / Masters', 
    'PhD Candidate', 
    'Medical / Residency Board', 
    'Competitive Exam Aspirant'
  ];
  const termPresets = ['Fall Semester', 'Spring Semester', 'Semester 1', 'Semester 2', 'Trimester 1', 'Trimester 2', 'Trimester 3', 'Annual Session'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-theme flex items-center justify-between bg-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif italic font-bold text-primary flex items-center gap-2">
                <span>Academic Year & Student Profile</span>
                <span className="text-[10px] uppercase font-sans tracking-widest px-2 py-0.5 rounded-full bg-theme-accent text-primary border border-theme">
                  Year Settings
                </span>
              </h3>
              <p className="text-xs text-muted">
                Configure your academic year, cohort level, term timeline, and institutional details.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-primary">
          {savedSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-2xl flex items-center gap-2 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              <span>Academic Year Profile saved successfully!</span>
            </div>
          )}

          {/* Student Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-primary flex items-center gap-1.5">
              <span>Student Display Name</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Academic Year & Presets */}
          <div className="space-y-2">
            <label className="font-bold text-primary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Academic Year</span>
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2026 - 2027"
              className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {yearPresets.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setAcademicYear(yr)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition border cursor-pointer ${
                    academicYear === yr
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Year Level / Class */}
          <div className="space-y-2">
            <label className="font-bold text-primary flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              <span>Year Level / Grade / Cohort</span>
            </label>
            <input
              type="text"
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              placeholder="e.g. Year 3 (Junior)"
              className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {levelPresets.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setYearLevel(lvl)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] transition border cursor-pointer ${
                    yearLevel === lvl
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Term / Semester & Target Exam Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span>Current Term / Semester</span>
              </label>
              <input
                type="text"
                value={semesterOrTerm}
                onChange={(e) => setSemesterOrTerm(e.target.value)}
                placeholder="e.g. Fall Semester"
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {termPresets.slice(0, 4).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSemesterOrTerm(t)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] transition border cursor-pointer ${
                      semesterOrTerm === t
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" />
                <span>Target Exam / Graduation Year</span>
              </label>
              <input
                type="text"
                value={targetExamYear}
                onChange={(e) => setTargetExamYear(e.target.value)}
                placeholder="e.g. 2027"
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {['2026', '2027', '2028', '2029'].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setTargetExamYear(yr)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition border cursor-pointer ${
                      targetExamYear === yr
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface hover:bg-theme-accent border-theme text-muted'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Institution & Major / Stream */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>School / College / Institution</span>
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Academic University / High School"
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-primary" />
                <span>Major / Academic Stream / Field</span>
              </label>
              <input
                type="text"
                value={majorOrStream}
                onChange={(e) => setMajorOrStream(e.target.value)}
                placeholder="e.g. Computer Science, Pre-Med, STEM"
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Academic Year Dates & Target Aim */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1">
                <span>Year Start Date</span>
              </label>
              <input
                type="date"
                value={academicYearStartDate}
                onChange={(e) => setAcademicYearStartDate(e.target.value)}
                className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1">
                <span>Year End Date</span>
              </label>
              <input
                type="date"
                value={academicYearEndDate}
                onChange={(e) => setAcademicYearEndDate(e.target.value)}
                className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-primary flex items-center gap-1">
                <span>Target Score / GPA Aim</span>
              </label>
              <input
                type="text"
                value={targetGpaOrScore}
                onChange={(e) => setTargetGpaOrScore(e.target.value)}
                placeholder="e.g. 3.8 GPA / 90%+"
                className="w-full p-2.5 bg-surface border border-theme rounded-2xl text-xs text-primary font-medium focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Daily Study Target */}
          <div className="p-3.5 rounded-2xl bg-theme-accent/30 border border-theme flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-primary flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Daily Study Goal Target</span>
              </span>
              <p className="text-[11px] text-muted">Daily target hours reflected across all progress and streak widgets.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.5"
                max="16"
                step="0.5"
                value={targetHours}
                onChange={(e) => setTargetHours(parseFloat(e.target.value) || 3)}
                className="w-16 p-2 text-center bg-surface border border-theme rounded-xl text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
              />
              <span className="text-xs font-semibold text-muted">hrs/day</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-theme flex items-center justify-between bg-header">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-theme hover:bg-theme-accent text-primary text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Year Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
