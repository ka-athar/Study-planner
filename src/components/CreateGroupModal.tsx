import React, { useState } from 'react';
import { X, Users, Sparkles, Plus, BookOpen, Calendar, Shield } from 'lucide-react';
import { Subject, UserProfile } from '../types';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userProfile: UserProfile | null;
  onCreateGroup: (groupData: {
    name: string;
    description: string;
    groupCode: string;
    subjectFocus: string[];
    isPublic: boolean;
    targetExam?: string;
    targetExamDate?: string;
  }) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  subjects,
  userProfile,
  onCreateGroup
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [targetExam, setTargetExam] = useState('');
  const [targetExamDate, setTargetExamDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Generate a random memorable code like CHEM-SPRINT-88
  const generateRandomCode = () => {
    const prefix = selectedSubjects.length > 0 
      ? selectedSubjects[0].slice(0, 4).toUpperCase() 
      : 'STUDY';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  const [groupCode, setGroupCode] = useState(generateRandomCode());

  if (!isOpen) return null;

  const toggleSubject = (subName: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subName) ? prev.filter(s => s !== subName) : [...prev, subName]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateGroup({
      name: name.trim(),
      description: description.trim() || 'A collaborative study group focused on mutual academic success and consistent goal tracking.',
      groupCode: groupCode.trim().toUpperCase() || generateRandomCode(),
      subjectFocus: selectedSubjects.length > 0 ? selectedSubjects : (subjects.map(s => s.name).slice(0, 2)),
      isPublic,
      targetExam: targetExam.trim() || undefined,
      targetExamDate: targetExamDate || undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Create Study Group</h3>
              <p className="text-[11px] text-[#A5A58D]">Form a collaborative study circle with AI-driven topic suggestions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F9F7F2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Organic Chemistry Masterminds, Biology Finals Prep"
              className="w-full px-3.5 py-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
              Mission / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are the group's goals? (e.g. Daily revision, solving 20 MCQs together, preparing for Midterms)"
              className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
            />
          </div>

          {/* Subject Focus Selector */}
          <div>
            <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1.5">
              Subject Focus
            </label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => {
                const isSelected = selectedSubjects.includes(s.name);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#6B705C] text-white border-[#6B705C]'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <span>{s.icon || '📚'}</span>
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Exam Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                Target Exam Name (Optional)
              </label>
              <input
                type="text"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                placeholder="e.g. Fall Midterms, AP Chemistry"
                className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                Target Exam Date (Optional)
              </label>
              <input
                type="date"
                value={targetExamDate}
                onChange={(e) => setTargetExamDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
              />
            </div>
          </div>

          {/* Group Code */}
          <div className="p-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider block">Invite Code</span>
              <span className="text-xs font-mono font-bold text-[#6B705C]">{groupCode}</span>
            </div>
            <button
              type="button"
              onClick={() => setGroupCode(generateRandomCode())}
              className="text-[11px] font-medium text-[#6B705C] hover:underline"
            >
              Regenerate Code
            </button>
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl">
            <div>
              <span className="text-xs font-bold text-[#4A4E4D] block">Public Study Circle</span>
              <span className="text-[11px] text-[#A5A58D]">Allow other students to discover and join this group</span>
            </div>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0DBD0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
