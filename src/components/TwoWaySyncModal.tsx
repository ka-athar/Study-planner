import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  Calendar, 
  CheckSquare, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  X, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers
} from 'lucide-react';
import { StudyPlan, StudySession, RevisionItem, ExamDate, ActiveTab } from '../types';
import { executeTwoWaySync, FreeStudySlot, ScheduleConflict, TwoWaySyncResult } from '../lib/twoWaySyncService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface TwoWaySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  sessions: StudySession[];
  revisions: RevisionItem[];
  examDates?: ExamDate[];
  onToggleTopicCompletion?: (planDate: string, topicName: string, completed: boolean) => void;
  setActiveTab?: (tab: ActiveTab) => void;
}

export const TwoWaySyncModal: React.FC<TwoWaySyncModalProps> = ({
  isOpen,
  onClose,
  plans,
  sessions,
  revisions,
  examDates = [],
  onToggleTopicCompletion,
  setActiveTab
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<TwoWaySyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeTab, setActiveModalTab] = useState<'sync' | 'slots' | 'conflicts'>('sync');

  const todayStr = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  const handleRunSync = async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await executeTwoWaySync({
        plans,
        todayStr,
        revisions,
        examDates,
        onTopicStatusChanged: (topicName, subjectName, completed) => {
          if (onToggleTopicCompletion) {
            onToggleTopicCompletion(todayStr, topicName, completed);
          }
        }
      });

      setSyncResult(res);
      triggerStudyGoalConfetti();
    } catch (e: any) {
      setSyncError(e.message || 'Two-way sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white border border-[#E0DBD0] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#2B2D42] text-white p-6 border-b border-[#3D405B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-emerald-300">
              <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">
                Bidirectional Sync Engine
              </div>
              <h2 className="text-xl font-bold font-serif">
                Two-Way Calendar & Tasks Sync
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#E0DBD0] bg-[#F9F7F2]">
          <button
            onClick={() => setActiveModalTab('sync')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Live Sync Status
          </button>
          <button
            onClick={() => setActiveModalTab('slots')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'slots'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Free Study Windows ({syncResult?.freeSlotsFound.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Integration Explanation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2B2D42]">
                    <Calendar className="w-4 h-4 text-[#6B705C]" />
                    <span>Google Calendar Sync</span>
                  </div>
                  <p className="text-xs text-[#6B705C]">
                    Auto-blocks planned study sessions into your primary calendar with reminders, and pulls external commitments to detect free study gaps.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2B2D42]">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>Google Tasks 2-Way Sync</span>
                  </div>
                  <p className="text-xs text-[#6B705C]">
                    Exports today's topics to Google Tasks. When you check off a task on your phone, StudyOS marks it done automatically!
                  </p>
                </div>
              </div>

              {/* Sync Action Area */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#F2EFE9] to-[#EAE7DF] border border-[#E0DBD0] text-center space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#2B2D42] font-serif">
                    Synchronize StudyOS with Google Workspace
                  </h3>
                  <p className="text-xs text-[#6B705C] max-w-md mx-auto">
                    Reconciles task statuses, updates Google Calendar events, and calculates real-time free study slots.
                  </p>
                </div>

                <button
                  onClick={handleRunSync}
                  disabled={isSyncing}
                  className="px-6 py-3 rounded-2xl bg-[#2B2D42] hover:bg-[#1E202F] text-white text-xs font-bold shadow-md inline-flex items-center gap-2.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronizing Two-Way...' : 'Run Two-Way Sync Now'}</span>
                </button>
              </div>

              {/* Live Sync Results */}
              {syncResult && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Two-Way Synchronization Complete!</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                      <div className="font-bold text-base text-emerald-950">{syncResult.tasksCreated}</div>
                      <div className="text-[10px] text-emerald-700">Tasks Pushed</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                      <div className="font-bold text-base text-emerald-950">{syncResult.studyOSTasksUpdated}</div>
                      <div className="text-[10px] text-emerald-700">StudyOS Completed</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                      <div className="font-bold text-base text-emerald-950">{syncResult.calendarEventsFetched}</div>
                      <div className="text-[10px] text-emerald-700">Events Scanned</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                      <div className="font-bold text-base text-emerald-950">{syncResult.freeSlotsFound.length}</div>
                      <div className="text-[10px] text-emerald-700">Free Slots Found</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {syncError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
                  {syncError}
                </div>
              )}
            </div>
          )}

          {activeTab === 'slots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B705C]">
                  Detected Free Study Slots for Today
                </span>
                <span className="text-xs font-mono text-[#A5A58D]">
                  Calculated from Google Calendar busy blocks
                </span>
              </div>

              {!syncResult || syncResult.freeSlotsFound.length === 0 ? (
                <div className="p-8 text-center bg-[#F9F7F2] rounded-2xl border border-[#E0DBD0] space-y-2">
                  <Clock className="w-8 h-8 text-[#A5A58D] mx-auto" />
                  <p className="text-xs text-[#6B705C]">
                    Run a two-way sync to detect open study gaps in your Google Calendar schedule.
                  </p>
                  <button
                    onClick={handleRunSync}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-xl bg-[#6B705C] text-white text-xs font-bold hover:bg-[#5a5f4e] transition cursor-pointer"
                  >
                    Scan Calendar Gaps
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {syncResult.freeSlotsFound.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] flex items-center justify-between shadow-2xs hover:border-[#6B705C] transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#2B2D42]">
                            {slot.startTime} – {slot.endTime}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-medium">
                            {slot.label} (Unoccupied)
                          </div>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-xl bg-[#F2EFE9] text-[#6B705C] text-xs font-mono font-bold">
                        {slot.durationMinutes} mins free
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F9F7F2] border-t border-[#E0DBD0] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#6B705C] hover:text-[#2B2D42] transition cursor-pointer"
          >
            Close
          </button>
          <div className="text-xs text-[#A5A58D] font-mono">
            Bidirectional Google Sync • Real-Time
          </div>
        </div>
      </motion.div>
    </div>
  );
};
