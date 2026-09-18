import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Sparkles, 
  Target, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Flame, 
  Copy, 
  Check, 
  Share2, 
  MessageSquare, 
  Send, 
  Calendar, 
  LogOut, 
  Trash2, 
  Award, 
  AlertCircle, 
  Lock, 
  Globe, 
  ShieldCheck, 
  Bot, 
  Play, 
  Compass, 
  Search, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { 
  StudyGroup, 
  StudyGroupMember, 
  CollaborativeGoal, 
  GroupChatMessage, 
  AIGroupStudySuggestion, 
  Subject, 
  UserProfile, 
  ActiveTab, 
  StudySession 
} from '../types';
import { CreateGroupModal } from './CreateGroupModal';
import { AddGoalModal } from './AddGoalModal';
import { AIGroupFacilitatorCard } from './AIGroupFacilitatorCard';

interface StudyGroupsViewProps {
  groups: StudyGroup[];
  user: any;
  userProfile: UserProfile | null;
  subjects: Subject[];
  sessions: StudySession[];
  onUpdateGroup: (group: StudyGroup) => void;
  onCreateGroup: (groupData: {
    name: string;
    description: string;
    groupCode: string;
    subjectFocus: string[];
    isPublic: boolean;
    targetExam?: string;
    targetExamDate?: string;
  }) => void;
  onDeleteGroup?: (groupId: string) => void;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onSendPromptToTutor: (prompt: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const StudyGroupsView: React.FC<StudyGroupsViewProps> = ({
  groups,
  user,
  userProfile,
  subjects,
  sessions,
  onUpdateGroup,
  onCreateGroup,
  onDeleteGroup,
  onStartTimerForTopic,
  onSendPromptToTutor,
  setActiveTab
}) => {
  const currentUid = user?.uid || 'current-user';
  const currentUserName = userProfile?.displayName || user?.displayName || 'Student';
  const currentUserEmail = userProfile?.email || user?.email || 'student@study.edu';

  // State
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'facilitator' | 'goals' | 'members' | 'chat'>('facilitator');
  
  // Join Code Modal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Group Chat Message Input
  const [chatInput, setChatInput] = useState('');
  const [copiedCodeToast, setCopiedCodeToast] = useState(false);

  // Filter / Search for Discover
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'my_groups' | 'discover'>('my_groups');

  // Compute current user's syllabus statistics to share
  const totalSyllabusTopics = subjects.reduce((acc, s) => 
    acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.length, 0), 0
  ) || 24;

  const completedSyllabusTopics = subjects.reduce((acc, s) => 
    acc + s.chapters.reduce((cAcc, c) => cAcc + c.topics.filter(t => t.status === 'Completed' || t.status === 'Mastered').length, 0), 0
  );

  const masteredTopicNames: string[] = [];
  const weakTopicNames: string[] = [];
  subjects.forEach(s => {
    s.chapters.forEach(c => {
      c.topics.forEach(t => {
        if (t.status === 'Mastered') masteredTopicNames.push(t.name);
        if (t.status === 'Weak' || t.status === 'Needs Revision') weakTopicNames.push(t.name);
      });
    });
  });

  // Hours studied this week
  const studiedHoursThisWeek = Number((sessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60).toFixed(1));

  // Determine current active group
  const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  // Check if current user is a member of the active group
  const isMemberOfActiveGroup = activeGroup?.members.some(m => m.uid === currentUid);
  const currentMemberRecord = activeGroup?.members.find(m => m.uid === currentUid);
  const isCurrentMemberSharing = currentMemberRecord ? currentMemberRecord.shareProgress : true;

  // Copy Group Code Helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeToast(true);
    setTimeout(() => setCopiedCodeToast(false), 2500);
  };

  // Join Group with Code
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    const matchingGroup = groups.find(g => g.groupCode.toUpperCase() === cleanCode);
    if (!matchingGroup) {
      setJoinError(`No study group found with code "${cleanCode}". Please check the code and try again.`);
      return;
    }

    if (matchingGroup.members.some(m => m.uid === currentUid)) {
      setJoinError(`You are already a member of "${matchingGroup.name}"!`);
      setSelectedGroupId(matchingGroup.id);
      setIsJoinModalOpen(false);
      return;
    }

    // Add user as member
    const newMember: StudyGroupMember = {
      uid: currentUid,
      displayName: currentUserName,
      email: currentUserEmail,
      photoURL: user?.photoURL,
      role: 'member',
      joinedAt: new Date().toISOString(),
      shareProgress: true,
      completedTopicsCount: completedSyllabusTopics,
      totalTopicsCount: totalSyllabusTopics,
      studiedHoursThisWeek,
      sharedMasteredTopics: masteredTopicNames.slice(0, 5),
      sharedWeakTopics: weakTopicNames.slice(0, 5),
      upcomingExams: userProfile?.examDates || []
    };

    const welcomeMsg: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUid,
      senderName: currentUserName,
      text: `👋 ${currentUserName} joined the study circle!`,
      timestamp: Date.now(),
      type: 'member_joined'
    };

    const updatedGroup: StudyGroup = {
      ...matchingGroup,
      members: [...matchingGroup.members, newMember],
      messages: [...(matchingGroup.messages || []), welcomeMsg]
    };

    onUpdateGroup(updatedGroup);
    setSelectedGroupId(matchingGroup.id);
    setJoinSuccess(`Successfully joined "${matchingGroup.name}"!`);
    setTimeout(() => {
      setIsJoinModalOpen(false);
      setJoinSuccess(null);
      setJoinCodeInput('');
    }, 1200);
  };

  // Join a public group directly from Discover
  const handleJoinPublicGroup = (groupToJoin: StudyGroup) => {
    if (groupToJoin.members.some(m => m.uid === currentUid)) {
      setSelectedGroupId(groupToJoin.id);
      setViewMode('my_groups');
      return;
    }

    const newMember: StudyGroupMember = {
      uid: currentUid,
      displayName: currentUserName,
      email: currentUserEmail,
      photoURL: user?.photoURL,
      role: 'member',
      joinedAt: new Date().toISOString(),
      shareProgress: true,
      completedTopicsCount: completedSyllabusTopics,
      totalTopicsCount: totalSyllabusTopics,
      studiedHoursThisWeek,
      sharedMasteredTopics: masteredTopicNames.slice(0, 5),
      sharedWeakTopics: weakTopicNames.slice(0, 5),
      upcomingExams: userProfile?.examDates || []
    };

    const updatedGroup: StudyGroup = {
      ...groupToJoin,
      members: [...groupToJoin.members, newMember]
    };

    onUpdateGroup(updatedGroup);
    setSelectedGroupId(groupToJoin.id);
    setViewMode('my_groups');
  };

  // Leave Group
  const handleLeaveGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const remainingMembers = group.members.filter(m => m.uid !== currentUid);
    const updatedGroup: StudyGroup = {
      ...group,
      members: remainingMembers
    };

    onUpdateGroup(updatedGroup);
  };

  // Toggle Sharing Syllabus Progress
  const handleToggleShareProgress = () => {
    if (!activeGroup) return;

    const updatedMembers = activeGroup.members.map(m => {
      if (m.uid === currentUid) {
        const nextShare = !m.shareProgress;
        return {
          ...m,
          shareProgress: nextShare,
          completedTopicsCount: nextShare ? completedSyllabusTopics : undefined,
          totalTopicsCount: nextShare ? totalSyllabusTopics : undefined,
          studiedHoursThisWeek: nextShare ? studiedHoursThisWeek : undefined,
          sharedMasteredTopics: nextShare ? masteredTopicNames.slice(0, 5) : [],
          sharedWeakTopics: nextShare ? weakTopicNames.slice(0, 5) : [],
          upcomingExams: nextShare ? (userProfile?.examDates || []) : []
        };
      }
      return m;
    });

    onUpdateGroup({
      ...activeGroup,
      members: updatedMembers
    });
  };

  // Add Collaborative Goal
  const handleAddGoal = (goalData: Omit<CollaborativeGoal, 'id' | 'createdAt' | 'currentValue' | 'completed'>) => {
    if (!activeGroup) return;

    const newGoal: CollaborativeGoal = {
      id: `goal-${Date.now()}`,
      ...goalData,
      currentValue: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const goalAlertMsg: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUid,
      senderName: currentUserName,
      text: `🎯 Added new collaborative goal: "${newGoal.title}" (Target: ${newGoal.targetValue} ${newGoal.unit})`,
      timestamp: Date.now(),
      type: 'chat'
    };

    onUpdateGroup({
      ...activeGroup,
      goals: [...activeGroup.goals, newGoal],
      messages: [...(activeGroup.messages || []), goalAlertMsg]
    });
  };

  // Contribute progress towards a goal
  const handleContributeGoalProgress = (goalId: string, delta: number) => {
    if (!activeGroup) return;

    const updatedGoals = activeGroup.goals.map(g => {
      if (g.id === goalId) {
        const newVal = Math.max(0, g.currentValue + delta);
        const wasCompleted = g.completed;
        const nowCompleted = newVal >= g.targetValue;

        return {
          ...g,
          currentValue: newVal,
          completed: nowCompleted
        };
      }
      return g;
    });

    onUpdateGroup({
      ...activeGroup,
      goals: updatedGoals
    });
  };

  // Send Group Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeGroup) return;

    const newMsg: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUid,
      senderName: currentUserName,
      senderPhoto: user?.photoURL,
      text: chatInput.trim(),
      timestamp: Date.now(),
      type: 'chat'
    };

    onUpdateGroup({
      ...activeGroup,
      messages: [...(activeGroup.messages || []), newMsg]
    });

    setChatInput('');
  };

  // Update AI Suggestions in active group
  const handleUpdateGroupSuggestions = (suggestions: AIGroupStudySuggestion[]) => {
    if (!activeGroup) return;
    onUpdateGroup({
      ...activeGroup,
      aiSuggestions: suggestions
    });
  };

  // Filtered public groups for discovery
  const publicGroups = groups.filter(g => 
    g.isPublic && 
    (g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     g.subjectFocus.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const myJoinedGroups = groups.filter(g => g.members.some(m => m.uid === currentUid));

  return (
    <div className="space-y-6 animate-fade-in text-[#4A4E4D]">
      {/* Top Banner & Hub Controls */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                <span>Study Circles & Collaborative Groups</span>
                <span className="text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#6B705C]/10 text-[#6B705C] border border-[#6B705C]/30">
                  AI Facilitated
                </span>
              </h2>
              <p className="text-xs text-[#A5A58D] mt-0.5">
                Study together, set collaborative milestones, share syllabus progress, and let AI discover high-yield group study topics.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#F9F7F2] p-1 rounded-2xl border border-[#E0DBD0] text-xs">
            <button
              onClick={() => setViewMode('my_groups')}
              className={`px-3 py-1.5 rounded-xl font-medium transition ${
                viewMode === 'my_groups'
                  ? 'bg-[#6B705C] text-white shadow-2xs font-bold'
                  : 'text-[#A5A58D] hover:text-[#4A4E4D]'
              }`}
            >
              My Groups ({myJoinedGroups.length})
            </button>
            <button
              onClick={() => setViewMode('discover')}
              className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                viewMode === 'discover'
                  ? 'bg-[#6B705C] text-white shadow-2xs font-bold'
                  : 'text-[#A5A58D] hover:text-[#4A4E4D]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Discover</span>
            </button>
          </div>

          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#4A4E4D] font-bold text-xs transition flex items-center gap-1.5"
            title="Join an existing group with invite code"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Join with Code</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs"
            title="Create a new study group"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* DISCOVER PUBLIC GROUPS VIEW */}
      {viewMode === 'discover' && (
        <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Discover Academic Study Circles</h3>
              <p className="text-xs text-[#A5A58D]">Join peer study groups by subject and prepare for upcoming exams together.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#A5A58D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject or group..."
                className="w-full pl-9 pr-3.5 py-2 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicGroups.map(group => {
              const isJoined = group.members.some(m => m.uid === currentUid);
              return (
                <div
                  key={group.id}
                  className="p-5 rounded-3xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-4 flex flex-col justify-between hover:border-[#6B705C]/50 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#4A4E4D]">{group.name}</h4>
                        <span className="text-[10px] text-[#A5A58D]">Led by {group.createdByName}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0]">
                        {group.members.length} members
                      </span>
                    </div>

                    <p className="text-xs text-[#4A4E4D]/80 line-clamp-2 leading-relaxed">
                      {group.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {group.subjectFocus.map(sub => (
                        <span key={sub} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#E0DBD0] text-[#6B705C]">
                          {sub}
                        </span>
                      ))}
                    </div>

                    {group.targetExam && (
                      <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/60 text-[11px] text-rose-800 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-semibold">{group.targetExam}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleJoinPublicGroup(group)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      isJoined
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white shadow-2xs'
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Already Joined (Open)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Join Study Group</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY STUDY GROUPS WORKSPACE */}
      {viewMode === 'my_groups' && (
        <div className="space-y-6">
          {/* Group Tabs Bar */}
          {myJoinedGroups.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {myJoinedGroups.map(group => {
                const isSelected = group.id === activeGroup?.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap border transition flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-xs'
                        : 'bg-white text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F9F7F2]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{group.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE7DF] text-[#6B705C]'}`}>
                      {group.members.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white border border-[#E0DBD0] rounded-3xl space-y-3">
              <Users className="w-10 h-10 text-[#A5A58D] mx-auto" />
              <h3 className="text-sm font-bold text-[#4A4E4D]">You have not joined any study groups yet</h3>
              <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
                Create your own study circle with friends or browse the Discover tab to join an active group!
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-full text-xs font-medium"
                >
                  Create My First Group
                </button>
                <button
                  onClick={() => setViewMode('discover')}
                  className="px-4 py-2 bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#4A4E4D] rounded-full text-xs font-medium"
                >
                  Browse Public Groups
                </button>
              </div>
            </div>
          )}

          {/* Active Group Details */}
          {activeGroup && (
            <div className="space-y-6">
              {/* Group Workspace Header Card */}
              <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E0DBD0] pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-serif italic font-bold text-[#6B705C]">
                        {activeGroup.name}
                      </h3>
                      {activeGroup.isPublic ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" /> Public Group
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C] border border-[#E0DBD0] flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Private Circle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4A4E4D]/80 max-w-3xl leading-relaxed">
                      {activeGroup.description}
                    </p>
                  </div>

                  {/* Group Code Copy Button & Member Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-[#F9F7F2] px-3 py-1.5 rounded-2xl border border-[#E0DBD0]">
                      <div className="text-[10px] font-bold text-[#A5A58D] uppercase tracking-wider">Invite Code:</div>
                      <span className="text-xs font-mono font-bold text-[#6B705C]">{activeGroup.groupCode}</span>
                      <button
                        onClick={() => handleCopyCode(activeGroup.groupCode)}
                        className="text-[#6B705C] hover:text-[#5a5f4e] p-1 rounded transition ml-1"
                        title="Copy code to share with friends"
                      >
                        {copiedCodeToast ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Progress Sharing Toggle */}
                    <button
                      onClick={handleToggleShareProgress}
                      className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition flex items-center gap-1.5 ${
                        isCurrentMemberSharing
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#A5A58D]'
                      }`}
                      title={isCurrentMemberSharing ? "Syllabus progress is shared with group for AI recommendations" : "Progress hidden from group"}
                    >
                      {isCurrentMemberSharing ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Progress Shared (On)</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Progress Private</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleLeaveGroup(activeGroup.id)}
                      className="text-[#A5A58D] hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition"
                      title="Leave this group"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setActiveSubTab('facilitator')}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeSubTab === 'facilitator'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Study Facilitator</span>
                    {activeGroup.aiSuggestions && activeGroup.aiSuggestions.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                        {activeGroup.aiSuggestions.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveSubTab('goals')}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeSubTab === 'goals'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Collaborative Goals</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                      {activeGroup.goals.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('members')}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeSubTab === 'members'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Members & Syllabus Synergy</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                      {activeGroup.members.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('chat')}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeSubTab === 'chat'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'bg-[#F9F7F2] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Group Discussion & Logs</span>
                    {activeGroup.messages && activeGroup.messages.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                        {activeGroup.messages.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* TAB 1: AI FACILITATOR */}
              {activeSubTab === 'facilitator' && (
                <AIGroupFacilitatorCard
                  group={activeGroup}
                  onUpdateGroupSuggestions={handleUpdateGroupSuggestions}
                  onStartTimerForTopic={onStartTimerForTopic}
                  onSendPromptToTutor={onSendPromptToTutor}
                  setActiveTab={setActiveTab}
                />
              )}

              {/* TAB 2: COLLABORATIVE GOALS */}
              {activeSubTab === 'goals' && (
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-4">
                    <div>
                      <h3 className="text-base font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                        <Target className="w-4 h-4 text-[#6B705C]" />
                        <span>Collaborative Study Goals</span>
                      </h3>
                      <p className="text-xs text-[#A5A58D]">
                        Achieve milestones together. Every member's study session and solved problems contribute to the shared pool!
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddGoalModalOpen(true)}
                      className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white rounded-full text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Set New Goal</span>
                    </button>
                  </div>

                  {/* Goal Cards */}
                  {activeGroup.goals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeGroup.goals.map((goal) => {
                        const progressPct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
                        const isDone = goal.completed || progressPct >= 100;

                        return (
                          <div
                            key={goal.id}
                            className={`p-5 rounded-3xl border transition space-y-3.5 flex flex-col justify-between ${
                              isDone
                                ? 'bg-emerald-50/60 border-emerald-200'
                                : 'bg-[#F9F7F2] border-[#E0DBD0]'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-[#4A4E4D] leading-snug">{goal.title}</h4>
                                  {goal.description && (
                                    <p className="text-xs text-[#A5A58D]">{goal.description}</p>
                                  )}
                                </div>

                                {isDone && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-3 h-3" /> Completed!
                                  </span>
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-mono">
                                  <span className="font-bold text-[#6B705C]">
                                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                                  </span>
                                  <span className="text-[#A5A58D] font-bold">{progressPct}%</span>
                                </div>
                                <div className="w-full h-3 bg-[#EAE7DF] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                      isDone ? 'bg-emerald-600' : 'bg-[#6B705C]'
                                    }`}
                                    style={{ width: `${progressPct}%` }}
                                  ></div>
                                </div>
                              </div>

                              {goal.deadline && (
                                <div className="text-[10px] text-[#A5A58D] flex items-center gap-1 font-mono">
                                  <Calendar className="w-3 h-3" />
                                  <span>Deadline: {goal.deadline}</span>
                                </div>
                              )}
                            </div>

                            {/* Contribution Buttons */}
                            <div className="pt-2 border-t border-[#E0DBD0] flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#A5A58D]">
                                By {goal.createdByName || 'Member'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleContributeGoalProgress(goal.id, 1)}
                                  className="px-2.5 py-1 bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] rounded-lg text-xs font-bold transition shadow-2xs"
                                  title={`Log +1 ${goal.unit} towards this goal`}
                                >
                                  +1 {goal.unit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleContributeGoalProgress(goal.id, 5)}
                                  className="px-2.5 py-1 bg-white hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] rounded-lg text-xs font-bold transition shadow-2xs"
                                  title={`Log +5 ${goal.unit} towards this goal`}
                                >
                                  +5
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-[#F9F7F2] rounded-3xl border border-dashed border-[#E0DBD0] space-y-2">
                      <Target className="w-8 h-8 text-[#A5A58D] mx-auto" />
                      <h4 className="text-xs font-bold text-[#4A4E4D]">No active goals set yet</h4>
                      <p className="text-xs text-[#A5A58D]">Create a goal for combined study hours, topics to master, or streak days!</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MEMBERS & SYLLABUS SYNERGY */}
              {activeSubTab === 'members' && (
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="border-b border-[#E0DBD0] pb-4">
                    <h3 className="text-base font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#6B705C]" />
                      <span>Member Progress & Peer Synergy Hub</span>
                    </h3>
                    <p className="text-xs text-[#A5A58D]">
                      See each member's shared syllabus progress, mastered concepts, and target exam deadlines to discover peer teaching pairs.
                    </p>
                  </div>

                  {/* Members Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeGroup.members.map((member) => {
                      const compTopics = member.completedTopicsCount || 0;
                      const totTopics = member.totalTopicsCount || 20;
                      const pct = Math.round((compTopics / totTopics) * 100);

                      return (
                        <div
                          key={member.uid}
                          className="p-5 rounded-3xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#6B705C] text-white flex items-center justify-center font-bold text-xs">
                                  {member.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-[#4A4E4D]">{member.displayName}</h4>
                                  <span className="text-[10px] text-[#A5A58D]">
                                    {member.role === 'admin' ? '⭐ Group Admin' : 'Member'}
                                  </span>
                                </div>
                              </div>

                              {member.studiedHoursThisWeek !== undefined && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#6B705C]">
                                  {member.studiedHoursThisWeek}h studied
                                </span>
                              )}
                            </div>

                            {/* Progress Bar */}
                            {member.shareProgress ? (
                              <div className="space-y-1 bg-white p-3 rounded-2xl border border-[#E0DBD0]">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-[#A5A58D]">Syllabus Mastery</span>
                                  <span className="font-bold text-[#6B705C]">{compTopics}/{totTopics} topics ({pct}%)</span>
                                </div>
                                <div className="w-full h-2 bg-[#EAE7DF] rounded-full overflow-hidden">
                                  <div className="h-full bg-[#6B705C] rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[10px] text-[#A5A58D] italic text-center">
                                Progress kept private
                              </div>
                            )}

                            {/* Mastered concepts */}
                            {member.sharedMasteredTopics && member.sharedMasteredTopics.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                  Can Teach / Mastered:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {member.sharedMasteredTopics.map(t => (
                                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
                                      ✓ {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Weak concepts */}
                            {member.sharedWeakTopics && member.sharedWeakTopics.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                  Needs Review / Weak:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {member.sharedWeakTopics.map(t => (
                                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                                      ⚠ {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Target exams */}
                            {member.upcomingExams && member.upcomingExams.length > 0 && (
                              <div className="text-[10px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200 font-mono">
                                📅 Exam: {member.upcomingExams[0].examName} ({member.upcomingExams[0].date})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: GROUP DISCUSSION & ACTIVITY LOGS */}
              {activeSubTab === 'chat' && (
                <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="border-b border-[#E0DBD0] pb-3">
                    <h3 className="text-base font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#6B705C]" />
                      <span>Group Chat & Activity Feed</span>
                    </h3>
                    <p className="text-xs text-[#A5A58D]">
                      Post updates, schedule live study calls, share tips, or discuss AI practice drills.
                    </p>
                  </div>

                  {/* Messages list */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 bg-[#F9F7F2] p-4 rounded-2xl border border-[#E0DBD0]">
                    {activeGroup.messages && activeGroup.messages.length > 0 ? (
                      activeGroup.messages.map((msg) => {
                        const isMe = msg.senderId === currentUid;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A5A58D] mb-1">
                              <span className="font-bold text-[#4A4E4D]">{msg.senderName}</span>
                              <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div
                              className={`p-3 rounded-2xl text-xs max-w-md ${
                                isMe
                                  ? 'bg-[#6B705C] text-white rounded-tr-xs'
                                  : 'bg-white border border-[#E0DBD0] text-[#4A4E4D] rounded-tl-xs'
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[#A5A58D] text-center py-6 italic">No messages yet. Say hello to your study circle!</p>
                    )}
                  </div>

                  {/* Message Input Form */}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message or share an update..."
                      className="flex-1 px-4 py-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-xs text-[#4A4E4D] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className={`p-2.5 rounded-2xl font-bold transition flex items-center justify-center ${
                        chatInput.trim()
                          ? 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white'
                          : 'bg-[#EAE7DF] text-[#A5A58D] cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        subjects={subjects}
        userProfile={userProfile}
        onCreateGroup={onCreateGroup}
      />

      {/* ADD GOAL MODAL */}
      <AddGoalModal
        isOpen={isAddGoalModalOpen}
        onClose={() => setIsAddGoalModalOpen(false)}
        onAddGoal={handleAddGoal}
        currentMemberName={currentUserName}
      />

      {/* JOIN WITH CODE MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-md w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Join Study Group</h3>
                  <p className="text-[11px] text-[#A5A58D]">Enter the 6-12 character invite code</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsJoinModalOpen(false);
                  setJoinError(null);
                  setJoinSuccess(null);
                }}
                className="text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F9F7F2]"
              >
                ✕
              </button>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl">
                {joinError}
              </div>
            )}

            {joinSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{joinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6B705C] uppercase tracking-wider mb-1">
                  Invite Code *
                </label>
                <input
                  type="text"
                  required
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CHEM-MED-24 or PHYS-STEM-88"
                  className="w-full px-4 py-2.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-sm font-mono font-bold text-[#6B705C] placeholder-[#A5A58D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C] tracking-wider uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E0DBD0]">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Join Circle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
