import React, { useState } from 'react';
import { X, Target, Clock, BookOpen, Flame, Plus, Calendar } from 'lucide-react';
import { CollaborativeGoal } from '../types';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: (goal: Omit<CollaborativeGoal, 'id' | 'createdAt' | 'currentValue' | 'completed'>) => void;
  currentMemberName: string;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  isOpen,
  onClose,
  onAddGoal,
  currentMemberName
}) => {
  const [goalType, setGoalType] = useState<CollaborativeGoal['type']>('weekly_hours');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState<number>(30);
  const [deadline, setDeadline] = useState('');

  if (!isOpen) return null;

  const presets = [
    {
      type: 'weekly_hours' as const,
      label: 'Combined Study Hours',
      defaultTitle: 'Complete 40 Combined Study Hours',
      defaultVal: 40,
      unit: 'hours',
      icon: <Clock className="w-4 h-4" />
    },
    {
      type: 'topics_count' as const,
      label: 'Topics to Master',
      defaultTitle: 'Master 10 Difficult Topics Together',
      defaultVal: 10,
      unit: 'topics',
      icon: <BookOpen className="w-4 h-4" />
    },
    {
      type: 'streak_days' as const,
      label: 'Group Study Streak',
      defaultTitle: '7-Day Group Study Streak',
      defaultVal: 7,
      unit: 'days',
      icon: <Flame className="w-4 h-4" />
    },
    {
      type: 'exam_prep' as const,
      label: 'Exam Practice Questions',
      defaultTitle: 'Solve 50 Past Exam Questions',
      defaultVal: 50,
      unit: 'questions',
      icon: <Target className="w-4 h-4" />
    }
  ];

  const handleSelectPreset = (preset: typeof presets[0]) => {
    setGoalType(preset.type);
    setTitle(preset.defaultTitle);
    setTargetValue(preset.defaultVal);
  };

  const getUnit = () => {
    const found = presets.find(p => p.type === goalType);
    return found ? found.unit : 'units';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || targetValue <= 0) return;

    onAddGoal({
      title: title.trim(),
      description: description.trim() || `Collaborative goal to achieve ${targetValue} ${getUnit()} together.`,
      type: goalType,
      targetValue: Number(targetValue),
      unit: getUnit(),
      deadline: deadline || undefined,
      createdBy: 'current-user',
      createdByName: currentMemberName || 'Group Member'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-5">
        <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Set Collaborative Goal</h3>
              <p className="text-[11px] text-[#A5A58D]">Motivate your group with shared milestones and combined targets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F9F7F2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-2">
            1. Select Goal Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isSelected = goalType === preset.type;
              return (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-2xl text-left border transition flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  <div className={isSelected ? 'text-white' : 'text-[#6B705C]'}>
                    {preset.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{preset.label}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#A5A58D]'}`}>
                      Target in {preset.unit}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal Title */}
          <div>
            <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete 50 Combined Study Hours Before Finals"
              className="w-full px-3.5 py-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
            />
          </div>

          {/* Target Value & Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                Target ({getUnit()}) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                Target Deadline (Optional)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
              Goal Details / Note
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Everyone logs their pomodoro timer sessions to contribute."
              className="w-full px-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
            />
          </div>

          {/* Actions */}
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
              <span>Set Goal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
