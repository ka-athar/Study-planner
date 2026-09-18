import React, { useState, useEffect } from 'react';
import { 
  X, 
  Target, 
  BookOpen, 
  Layers
} from 'lucide-react';
import { Subject, Chapter, Topic, TopicStatus, TestResult } from '../types';
import { TargetedMCQSolver } from './TargetedMCQSolver';

interface TopicTargetedTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectName?: string;
  initialChapterName?: string;
  initialTopicNumber?: string;
  initialTopicName?: string;
  initialTopicId?: string;
  testResults?: TestResult[];
  onSaveTestResult?: (result: Omit<TestResult, 'id'>) => Promise<void> | void;
  onUpdateTopicStatus?: (subjectId: string, chapterId: string, topicId: string, newStatus: TopicStatus, scorePercentage?: number) => void;
}

export const TopicTargetedTestModal: React.FC<TopicTargetedTestModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  initialSubjectName,
  initialChapterName,
  initialTopicNumber,
  initialTopicName,
  initialTopicId,
  testResults = [],
  onSaveTestResult,
  onUpdateTopicStatus
}) => {
  // Selected Target Hierarchy
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Resolve active objects
  const activeSubject = subjects.find(s => s.id === selectedSubjectId || s.name === initialSubjectName) || subjects[0];
  const activeChapter = activeSubject?.chapters.find(c => c.id === selectedChapterId || c.name === initialChapterName) || activeSubject?.chapters[0];
  const activeTopic = activeChapter?.topics.find(t => t.id === selectedTopicId || t.name === initialTopicName || (initialTopicNumber && t.topicNumber === initialTopicNumber)) || activeChapter?.topics[0];

  // Resolve Topic Number (e.g. "15.1")
  const computedTopicNumber = activeTopic?.topicNumber || initialTopicNumber || (
    activeChapter && activeTopic ? `${activeSubject?.chapters.indexOf(activeChapter)! + 1}.${activeChapter.topics.indexOf(activeTopic)! + 1}` : '1.1'
  );

  // Initialize selection when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSubjectName) {
        const foundSub = subjects.find(s => s.name.toLowerCase() === initialSubjectName.toLowerCase());
        if (foundSub) {
          setSelectedSubjectId(foundSub.id);
          if (initialChapterName) {
            const foundCh = foundSub.chapters.find(c => c.name.toLowerCase() === initialChapterName.toLowerCase());
            if (foundCh) {
              setSelectedChapterId(foundCh.id);
              if (initialTopicId || initialTopicName || initialTopicNumber) {
                const foundTp = foundCh.topics.find(t => 
                  (initialTopicId && t.id === initialTopicId) ||
                  (initialTopicName && t.name.toLowerCase() === initialTopicName.toLowerCase()) ||
                  (initialTopicNumber && t.topicNumber === initialTopicNumber)
                );
                if (foundTp) setSelectedTopicId(foundTp.id);
              }
            }
          }
        }
      } else if (subjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subjects[0].id);
        if (subjects[0].chapters.length > 0) {
          setSelectedChapterId(subjects[0].chapters[0].id);
          if (subjects[0].chapters[0].topics.length > 0) {
            setSelectedTopicId(subjects[0].chapters[0].topics[0].id);
          }
        }
      }
    }
  }, [isOpen, initialSubjectName, initialChapterName, initialTopicNumber, initialTopicName, initialTopicId, subjects]);

  if (!isOpen || !activeTopic) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in text-primary">
      <div className="bg-white dark:bg-[#1E201E] border border-theme rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Quick Topic Switcher Bar */}
        <div className="px-5 py-3 bg-surface text-primary border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[240px]">
            <span className="text-[10px] font-mono uppercase text-muted font-bold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span>Target Topic:</span>
            </span>
            
            {/* Subject Selector */}
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                const sub = subjects.find(s => s.id === e.target.value);
                if (sub && sub.chapters.length > 0) {
                  setSelectedChapterId(sub.chapters[0].id);
                  if (sub.chapters[0].topics.length > 0) {
                    setSelectedTopicId(sub.chapters[0].topics[0].id);
                  }
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-theme-accent/60 hover:bg-theme-accent text-primary border border-theme text-xs font-bold focus:outline-none cursor-pointer"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id} className="text-primary bg-card">{s.name}</option>
              ))}
            </select>

            {/* Chapter Selector */}
            {activeSubject && activeSubject.chapters.length > 0 && (
              <select
                value={selectedChapterId}
                onChange={(e) => {
                  setSelectedChapterId(e.target.value);
                  const ch = activeSubject.chapters.find(c => c.id === e.target.value);
                  if (ch && ch.topics.length > 0) {
                    setSelectedTopicId(ch.topics[0].id);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-theme-accent/60 hover:bg-theme-accent text-primary border border-theme text-xs font-bold focus:outline-none cursor-pointer max-w-[170px] truncate"
              >
                {activeSubject.chapters.map(c => (
                  <option key={c.id} value={c.id} className="text-primary bg-card">{c.name}</option>
                ))}
              </select>
            )}

            {/* Topic Selector */}
            {activeChapter && activeChapter.topics.length > 0 && (
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-theme-accent/60 hover:bg-theme-accent text-primary border border-theme text-xs font-bold focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {activeChapter.topics.map((t, idx) => (
                  <option key={t.id} value={t.id} className="text-primary bg-card">
                    {t.topicNumber || `${activeSubject.chapters.indexOf(activeChapter) + 1}.${idx + 1}`}: {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated TargetedMCQSolver Component Body */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-4">
          <TargetedMCQSolver
            key={activeTopic.id}
            topic={{
              ...activeTopic,
              topicNumber: computedTopicNumber
            }}
            chapter={activeChapter}
            subject={activeSubject}
            syllabusContext={{
              subjectName: activeSubject?.name,
              chapterName: activeChapter?.name,
              topicNumber: computedTopicNumber,
              subtopics: activeTopic.subtopics?.map(s => s.name) || []
            }}
            pastTestResults={testResults}
            onClose={onClose}
            onTestCompleted={async (result) => {
              if (onSaveTestResult && activeSubject && activeChapter && activeTopic) {
                const newTestResult: Omit<TestResult, 'id'> = {
                  userId: '',
                  testName: `Targeted MCQ Drill: Topic ${computedTopicNumber} (${activeTopic.name})`,
                  subjectName: activeSubject.name,
                  chapterName: activeChapter.name,
                  topicNumber: computedTopicNumber,
                  topicName: activeTopic.name,
                  topicId: activeTopic.id,
                  score: `${result.score}/${result.totalMarks}`,
                  totalMarks: result.totalMarks,
                  obtainedMarks: result.score,
                  percentage: result.percentage,
                  scorePercentage: result.percentage,
                  date: new Date().toISOString().split('T')[0],
                  mistakes: result.mistakes.length > 0 ? result.mistakes.join('\n') : 'Perfect score - all questions answered correctly!',
                  struggledTopics: result.mistakes.length > 0 ? [`Topic ${computedTopicNumber}: ${activeTopic.name}`] : [],
                  questionsCount: result.totalMarks,
                  correctCount: result.score,
                  incorrectCount: result.totalMarks - result.score
                };
                await onSaveTestResult(newTestResult);
              }
            }}
            onUpdateTopicStatus={(newStatus, scorePercentage) => {
              if (onUpdateTopicStatus && activeSubject && activeChapter && activeTopic) {
                onUpdateTopicStatus(activeSubject.id, activeChapter.id, activeTopic.id, newStatus, scorePercentage);
              }
            }}
          />
        </div>

      </div>
    </div>
  );
};
