import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  BookOpen, 
  Clock, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  Brain, 
  Sparkles, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Timer, 
  Calendar,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { Subject, RevisionItem, StudySession, ActiveTab } from '../types';

interface RevisionViewProps {
  subjects: Subject[];
  revisions: RevisionItem[];
  sessions?: StudySession[];
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onMarkRevisionDone: (revisionId: string) => void;
  onDeleteRevision?: (revisionId: string) => void;
  onAddRevisionTopic?: (item: Omit<RevisionItem, 'id' | 'userId'>) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

export const RevisionView: React.FC<RevisionViewProps> = ({
  subjects,
  revisions,
  sessions = [],
  onStartTimerForTopic,
  onMarkRevisionDone,
  onDeleteRevision,
  onAddRevisionTopic,
  onNavigateTab
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed' | 'timed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state for adding custom revision topic
  const [newSubject, setNewSubject] = useState(subjects[0]?.name || '');
  const [newChapter, setNewChapter] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newPriority, setNewPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [newNotes, setNewNotes] = useState('');

  // Synchronize chapter/topic when newSubject changes in modal
  const currentSubjectObj = subjects.find(s => s.name === newSubject) || subjects[0];
  const currentChapterObj = currentSubjectObj?.chapters.find(c => c.name === newChapter) || currentSubjectObj?.chapters[0];

  const handleOpenAddModal = () => {
    if (subjects.length > 0) {
      const firstSub = subjects[0];
      setNewSubject(firstSub.name);
      setNewChapter(firstSub.chapters[0]?.name || '');
      setNewTopic(firstSub.chapters[0]?.topics[0]?.name || '');
    }
    setIsAddModalOpen(true);
  };

  const handleCreateRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject || !newTopic) return;
    if (onAddRevisionTopic) {
      const todayStr = new Date().toISOString().split('T')[0];
      const dueStr = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      onAddRevisionTopic({
        subjectName: newSubject,
        chapterName: newChapter || '',
        topicName: newTopic,
        lastStudied: todayStr,
        dueDate: dueStr,
        priority: newPriority,
        status: 'Pending',
        reason: newNotes || 'Added manually to revision queue',
        timeSpentMinutes: 0,
        totalTimeSpentMinutes: 0,
        sessionsCount: 0
      });
    }
    setIsAddModalOpen(false);
    setNewNotes('');
  };

  // Map and unify all revision topics
  // 1. Existing stored revisions
  // 2. Syllabus topics that have logged timer time or status 'Weak'/'Needs Revision' not yet in revisions
  const unifiedItems = useMemo(() => {
    const list: (RevisionItem & { isAuto?: boolean; computedMinutes: number; computedSessions: number })[] = [];
    const seenKeys = new Set<string>();

    // Process explicitly stored revisions first
    revisions.forEach(r => {
      const key = `${r.subjectName.trim().toLowerCase()}::${r.topicName.trim().toLowerCase()}`;
      seenKeys.add(key);

      // Also correlate with studySessions to get exact accurate accumulated minutes if higher
      const matchedSessions = sessions.filter(s => 
        s.subjectName.trim().toLowerCase() === r.subjectName.trim().toLowerCase() &&
        s.topicName.trim().toLowerCase() === r.topicName.trim().toLowerCase()
      );
      const sessionMinutes = matchedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      const totalTime = Math.max(r.totalTimeSpentMinutes || 0, r.timeSpentMinutes || 0, sessionMinutes);
      const totalSess = Math.max(r.sessionsCount || 0, matchedSessions.length);

      list.push({
        ...r,
        computedMinutes: totalTime,
        computedSessions: totalSess,
        isAuto: false
      });
    });

    // Process syllabus topics that have logged time or are weak/needs revision
    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          const key = `${sub.name.trim().toLowerCase()}::${t.name.trim().toLowerCase()}`;
          if (!seenKeys.has(key)) {
            // Check sessions
            const matchedSessions = sessions.filter(s => 
              s.subjectName.trim().toLowerCase() === sub.name.trim().toLowerCase() &&
              s.topicName.trim().toLowerCase() === t.name.trim().toLowerCase()
            );
            const sessionMinutes = matchedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
            const totalTime = Math.max(t.timeSpentMinutes || 0, sessionMinutes);
            const totalSess = Math.max(t.sessionsCount || 0, matchedSessions.length);

            // Include if it has saved time OR has weak / needs revision status
            if (totalTime > 0 || t.status === 'Weak' || t.status === 'Needs Revision') {
              seenKeys.add(key);
              list.push({
                id: `auto-${sub.name}-${t.name}`,
                userId: '',
                subjectName: sub.name,
                chapterName: ch.name,
                topicName: t.name,
                lastStudied: t.lastStudiedAt || (matchedSessions[0]?.date) || 'Recently',
                dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
                priority: t.status === 'Weak' ? 'High' : (totalTime > 0 ? 'Medium' : 'Low'),
                status: t.status === 'Mastered' ? 'Completed' : 'Pending',
                reason: t.weakNotes || (totalTime > 0 ? `Saved timer session: ${totalTime}m recorded` : 'Needs active recall practice'),
                timeSpentMinutes: totalTime,
                totalTimeSpentMinutes: totalTime,
                sessionsCount: totalSess,
                computedMinutes: totalTime,
                computedSessions: totalSess,
                isAuto: true
              });
            }
          }
        });
      });
    });

    return list;
  }, [revisions, subjects, sessions]);

  // Compute aggregate statistics
  const totalRevisionTimeMinutes = useMemo(() => {
    return unifiedItems.reduce((acc, item) => acc + (item.computedMinutes || 0), 0);
  }, [unifiedItems]);

  const pendingCount = useMemo(() => {
    return unifiedItems.filter(i => i.status !== 'Completed').length;
  }, [unifiedItems]);

  const completedCount = useMemo(() => {
    return unifiedItems.filter(i => i.status === 'Completed').length;
  }, [unifiedItems]);

  const timedTopicsCount = useMemo(() => {
    return unifiedItems.filter(i => i.computedMinutes > 0).length;
  }, [unifiedItems]);

  // Filter and search items
  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      // Filter tab
      if (filterTab === 'pending' && item.status === 'Completed') return false;
      if (filterTab === 'completed' && item.status !== 'Completed') return false;
      if (filterTab === 'timed' && item.computedMinutes <= 0) return false;

      // Subject filter
      if (selectedSubjectFilter !== 'all' && item.subjectName !== selectedSubjectFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTopic = item.topicName.toLowerCase().includes(q);
        const matchSub = item.subjectName.toLowerCase().includes(q);
        const matchCh = item.chapterName?.toLowerCase().includes(q);
        const matchReason = item.reason?.toLowerCase().includes(q);
        if (!matchTopic && !matchSub && !matchCh && !matchReason) return false;
      }

      return true;
    });
  }, [unifiedItems, filterTab, selectedSubjectFilter, searchQuery]);

  // Format minutes helper
  const formatTime = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours === 0) return `${m}m`;
    return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header & Overview Banner */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#6B705C]/10 text-[#6B705C]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-serif italic font-bold text-[#6B705C]">
              Revision Queue & Saved Study Time
            </h2>
          </div>
          <p className="text-xs text-[#A5A58D]">
            All timer sessions logged for topics are permanently saved here. Review weak topics, track cumulative study minutes, and schedule spaced repetition.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('flashcards')}
              className="px-4 py-2 bg-[#F2EFE9] hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#4A4E4D] text-xs font-semibold rounded-full transition flex items-center gap-1.5 cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Flashcard Arena</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Topic to Revision</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">
              Total Saved Study Time
            </span>
            <Timer className="w-4 h-4 text-[#6B705C]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#6B705C]">
            {formatTime(totalRevisionTimeMinutes)}
          </div>
          <span className="text-[11px] text-[#A5A58D] block">
            {timedTopicsCount} topics studied with Timer
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">
              Pending Revisions
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-800" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-800">
            {pendingCount}
          </div>
          <span className="text-[11px] text-[#A5A58D] block">
            Active recall required
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">
              Completed Revisions
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#6B705C]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#4A4E4D]">
            {completedCount}
          </div>
          <span className="text-[11px] text-[#6B705C] block">
            Verified & ticked off
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A5A58D] font-mono font-bold uppercase tracking-wider">
              Total Queue Items
            </span>
            <BookOpen className="w-4 h-4 text-[#A5A58D]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#4A4E4D]">
            {unifiedItems.length}
          </div>
          <span className="text-[11px] text-[#A5A58D] block">
            Across {subjects.length} subjects
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E0DBD0] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'bg-[#F9F7F2] text-[#6B705C] hover:bg-[#EAE7DF]'
            }`}
          >
            All ({unifiedItems.length})
          </button>
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'bg-[#F9F7F2] text-[#6B705C] hover:bg-[#EAE7DF]'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              filterTab === 'completed'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'bg-[#F9F7F2] text-[#6B705C] hover:bg-[#EAE7DF]'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilterTab('timed')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              filterTab === 'timed'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'bg-[#F9F7F2] text-[#6B705C] hover:bg-[#EAE7DF]'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Timed Sessions ({timedTopicsCount})</span>
          </button>
        </div>

        {/* Search & Subject select */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5A58D]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic, notes, subject..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-none focus:border-[#6B705C]"
            />
          </div>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            aria-label="Filter revision topics by subject"
            className="px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-xs text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Revision Topic Items List */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E0DBD0]/70 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#6B705C]" />
            <h3 className="text-sm font-bold text-[#6B705C] uppercase tracking-widest">
              Revision Items ({filteredItems.length})
            </h3>
          </div>
          <span className="text-xs text-[#A5A58D]">
            Saved study times update in real-time as you complete timer sessions
          </span>
        </div>

        {filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isDone = item.status === 'Completed';

              return (
                <div
                  key={item.id}
                  className={`p-4.5 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isDone 
                      ? 'bg-[#FAF8F5]/80 border-[#E5E0D8] opacity-80' 
                      : 'bg-[#FDFCF9] border-[#E0DBD0] hover:border-[#6B705C]/40 hover:shadow-xs'
                  }`}
                >
                  {/* Left Topic Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Toggle Checkbox */}
                      <button
                        onClick={() => onMarkRevisionDone(item.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                          isDone 
                            ? 'bg-[#6B705C] border-[#6B705C] text-white' 
                            : 'bg-white border-[#C5BFB0] hover:border-[#6B705C]'
                        }`}
                        title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        {isDone && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>

                      {/* Subject Badge */}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EAE7DF] text-[#6B705C]">
                        {item.subjectName}
                      </span>

                      {/* Chapter */}
                      {item.chapterName && (
                        <span className="text-xs font-mono text-[#A5A58D]">
                          {item.chapterName}
                        </span>
                      )}

                      {/* Priority Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        item.priority === 'High'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : item.priority === 'Medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-stone-50 text-[#858575] border-[#E0DBD0]'
                      }`}>
                        {item.priority.toUpperCase()} PRIORITY
                      </span>

                      {/* Saved Time Badge - Prominent */}
                      {item.computedMinutes > 0 ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Timer className="w-3 h-3 text-emerald-700" />
                          <span>{formatTime(item.computedMinutes)} studied</span>
                          {item.computedSessions > 0 && (
                            <span className="text-emerald-700/80 font-normal">
                              ({item.computedSessions} session{item.computedSessions > 1 ? 's' : ''})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#A5A58D] px-2 py-0.5 rounded bg-[#F2EFE9]">
                          No timer time yet
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className={`text-sm font-bold text-[#4A4E4D] ${isDone ? 'line-through text-[#858575]' : ''}`}>
                        {item.topicName}
                      </h4>
                      {item.reason && (
                        <p className="text-xs text-[#737770] mt-0.5">
                          {item.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-[#A5A58D] pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Last studied: <strong className="text-[#4A4E4D]">{item.lastStudied || 'Not logged'}</strong></span>
                      </span>
                      {item.dueDate && (
                        <span>Due: <strong className="text-[#4A4E4D]">{item.dueDate}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start lg:self-center flex-wrap">
                    {/* Launch Timer Button */}
                    <button
                      onClick={() => onStartTimerForTopic(item.subjectName, item.chapterName || '', item.topicName)}
                      className="px-3.5 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                      title="Launch Study Timer for this Topic"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start Timer</span>
                    </button>

                    {/* Cards button */}
                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('flashcards')}
                        className="px-3 py-2 bg-white hover:bg-[#EAE7DF] border border-[#E0DBD0] text-[#6B705C] text-xs font-semibold rounded-full transition flex items-center gap-1 cursor-pointer"
                        title="Review Flashcards"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cards</span>
                      </button>
                    )}

                    {/* Mark Done / Pending Toggle button */}
                    <button
                      onClick={() => onMarkRevisionDone(item.id)}
                      className={`px-3 py-2 border text-xs font-semibold rounded-full transition flex items-center gap-1 cursor-pointer ${
                        isDone
                          ? 'bg-[#F2EFE9] border-[#E0DBD0] text-[#6B705C] hover:bg-[#EAE7DF]'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                      title={isDone ? 'Reopen revision' : 'Mark as done'}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isDone ? 'Reopen' : 'Done'}</span>
                    </button>

                    {/* Delete button */}
                    {onDeleteRevision && !item.isAuto && (
                      <button
                        onClick={() => onDeleteRevision(item.id)}
                        className="p-2 text-[#A5A58D] hover:text-rose-800 hover:bg-rose-50 rounded-full transition cursor-pointer"
                        title="Remove from revision queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#F9F7F2] rounded-2xl border border-dashed border-[#E0DBD0] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#6B705C] mx-auto" />
            <p className="text-xs font-bold text-[#4A4E4D]">
              {searchQuery || selectedSubjectFilter !== 'all' || filterTab !== 'all'
                ? 'No revision topics match your current filter.'
                : 'No revision topics in queue!'}
            </p>
            <p className="text-[11px] text-[#A5A58D]">
              Use the Study Timer or click "Add Topic to Revision" above to queue topics.
            </p>
          </div>
        )}
      </div>

      {/* Add Topic Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E0DBD0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#6B705C]" />
                <h3 className="text-base font-bold text-[#6B705C]">Add Topic to Revision Queue</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#A5A58D] hover:text-[#4A4E4D] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRevision} className="space-y-3 text-xs">
              {/* Subject */}
              <div>
                <label className="block font-bold text-[#6B705C] mb-1">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => {
                    const subName = e.target.value;
                    setNewSubject(subName);
                    const found = subjects.find(s => s.name === subName);
                    setNewChapter(found?.chapters[0]?.name || '');
                    setNewTopic(found?.chapters[0]?.topics[0]?.name || '');
                  }}
                  className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              <div>
                <label className="block font-bold text-[#6B705C] mb-1">Chapter</label>
                <select
                  value={newChapter}
                  onChange={(e) => {
                    const chName = e.target.value;
                    setNewChapter(chName);
                    const ch = currentSubjectObj?.chapters.find(c => c.name === chName);
                    setNewTopic(ch?.topics[0]?.name || '');
                  }}
                  className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  {currentSubjectObj?.chapters.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block font-bold text-[#6B705C] mb-1">Topic</label>
                <select
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                >
                  {currentChapterObj?.topics.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block font-bold text-[#6B705C] mb-1">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['High', 'Medium', 'Low'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`py-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        newPriority === p
                          ? 'bg-[#6B705C] text-white border-[#6B705C]'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#EAE7DF]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Notes */}
              <div>
                <label className="block font-bold text-[#6B705C] mb-1">Revision Notes (Optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Needs formula memorization, test gap..."
                  className="w-full p-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-xl text-[#4A4E4D] focus:outline-none focus:border-[#6B705C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#858575] hover:text-[#4A4E4D] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Add to Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
