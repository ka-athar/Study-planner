import React, { useState, useEffect } from 'react';
import { AmbientSoundType, FocusCommitment } from '../types';
import { ambientSound } from '../lib/audioSynthesizer';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Maximize2, 
  Minimize2, 
  Target, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw,
  Headphones,
  Flame,
  Coffee,
  CloudRain,
  BookOpen,
  Waves,
  Music
} from 'lucide-react';

interface VirtualStudyRoomViewProps {
  onSessionComplete?: (minutes: number, goal: string) => void;
  onNavigateToGamification?: () => void;
}

const SOUND_TRACKS: { id: AmbientSoundType; name: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'rain', name: 'Gentle Rain', icon: <CloudRain className="w-5 h-5" />, desc: 'Calming raindrop acoustics' },
  { id: 'brown_noise', name: 'Deep Brown Noise', icon: <Waves className="w-5 h-5" />, desc: 'Low-frequency rumble for heavy focus' },
  { id: 'alpha_waves', name: '10Hz Alpha Waves', icon: <Headphones className="w-5 h-5" />, desc: 'Binaural flow state synchronization' },
  { id: 'lofi', name: 'Lo-Fi Chill Pad', icon: <Music className="w-5 h-5" />, desc: 'Synthesized melodic ambient chords' },
  { id: 'library', name: 'Whispering Library', icon: <BookOpen className="w-5 h-5" />, desc: 'Gentle academic room resonance' },
  { id: 'cafe', name: 'Quiet Café', icon: <Coffee className="w-5 h-5" />, desc: 'Cozy study warmth' },
];

export const VirtualStudyRoomView: React.FC<VirtualStudyRoomViewProps> = ({
  onSessionComplete,
  onNavigateToGamification
}) => {
  const [activeTrack, setActiveTrack] = useState<AmbientSoundType | null>(null);
  const [volume, setVolume] = useState<number>(0.6);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Focus Commitment
  const [goal, setGoal] = useState<string>('');
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [commitment, setCommitment] = useState<FocusCommitment | null>(null);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    let interval: number | null = null;
    if (timerRunning && secondsLeft > 0) {
      interval = window.setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && timerRunning) {
      setTimerRunning(false);
      if (commitment && onSessionComplete) {
        onSessionComplete(commitment.targetMinutes, commitment.goal);
      }
      ambientSound.stop();
      setActiveTrack(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, secondsLeft, commitment, onSessionComplete]);

  // Handle ambient track toggle
  const handleToggleSound = (trackId: AmbientSoundType) => {
    if (activeTrack === trackId) {
      ambientSound.stop();
      setActiveTrack(null);
    } else {
      ambientSound.play(trackId);
      ambientSound.setVolume(volume);
      setActiveTrack(trackId);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    ambientSound.setVolume(newVol);
  };

  const handleToggleMute = () => {
    const muted = ambientSound.toggleMute();
    setIsMuted(muted);
  };

  const handleStartFocus = () => {
    if (!goal.trim()) return;
    const newCommitment: FocusCommitment = {
      goal: goal.trim(),
      targetMinutes,
      active: true,
      startedAt: new Date().toISOString(),
    };
    setCommitment(newCommitment);
    setSecondsLeft(targetMinutes * 60);
    setTimerRunning(true);

    // Auto-start rain or brown noise if no ambient sound is active
    if (!activeTrack) {
      ambientSound.play('brown_noise');
      ambientSound.setVolume(volume);
      setActiveTrack('brown_noise');
    }
  };

  const handleCancelFocus = () => {
    setTimerRunning(false);
    setCommitment(null);
    setSecondsLeft(targetMinutes * 60);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = commitment 
    ? Math.min(100, Math.round(((commitment.targetMinutes * 60 - secondsLeft) / (commitment.targetMinutes * 60)) * 100))
    : 0;

  return (
    <div className={`space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-[#FAF8F5] p-6 overflow-y-auto' : ''}`}>
      {/* Header with Fullscreen & Gamification shortcut */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E0DBD0] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#6B705C] font-bold">Deep Work Space</span>
          </div>
          <h1 className="text-2xl font-bold text-[#4A4E4D] tracking-tight mt-1">
            Virtual Silent Study Room
          </h1>
          <p className="text-xs text-[#6B705C] mt-1">
            Distraction-free focus canvas with synthesized ambient acoustics and goal commitment lock-in.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToGamification && (
            <button
              onClick={onNavigateToGamification}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Study Quests & XP</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-xs font-bold text-[#4A4E4D] transition cursor-pointer"
            title="Toggle Fullscreen Focus"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}</span>
          </button>
        </div>
      </div>

      {/* Main Focus Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Timer & Commitment */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-gradient-to-b from-white to-[#FAF8F5] rounded-3xl p-8 border border-[#E0DBD0] shadow-md flex flex-col items-center text-center relative overflow-hidden">
            {commitment && (
              <div className="w-full bg-[#6B705C]/10 border border-[#6B705C]/20 rounded-2xl p-3 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                  <Target className="w-4 h-4 text-[#6B705C] shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono uppercase text-[#6B705C] font-bold">Locked Focus Intention</div>
                    <div className="text-xs font-bold text-[#4A4E4D]">{commitment.goal}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#6B705C] bg-white px-2 py-0.5 rounded-lg border border-[#E0DBD0]">
                  {commitment.targetMinutes}m Sprint
                </span>
              </div>
            )}

            {/* Circular Progress Display */}
            <div className="relative my-4 flex items-center justify-center">
              <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="stroke-[#F2EFE9]"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="stroke-[#6B705C] transition-all duration-1000 ease-linear"
                  strokeWidth="6"
                  strokeDasharray={276.46}
                  strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-black tracking-tight font-mono text-[#4A4E4D]">
                  {formatTime(secondsLeft)}
                </span>
                <span className="text-[11px] font-mono text-[#6B705C] mt-1">
                  {timerRunning ? 'Deep Focus In Session' : 'Ready to Start'}
                </span>
              </div>
            </div>

            {/* Timer Controls */}
            {commitment ? (
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-6 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{timerRunning ? 'Pause Interval' : 'Resume Session'}</span>
                </button>
                <button
                  onClick={handleCancelFocus}
                  className="px-4 py-2.5 rounded-2xl bg-[#F2EFE9] hover:bg-[#E0DBD0] text-[#4A4E4D] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>End</span>
                </button>
              </div>
            ) : (
              <div className="w-full space-y-4 mt-2">
                <div className="text-left space-y-1.5">
                  <label className="text-xs font-bold text-[#4A4E4D] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#6B705C]" />
                    <span>Single Non-Negotiable Objective:</span>
                  </label>
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g., Solve 5 Thermodynamics problems without checking phone..."
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#E0DBD0] bg-white text-xs text-[#4A4E4D] focus:outline-none focus:ring-2 focus:ring-[#6B705C]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {[15, 25, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => {
                          setTargetMinutes(mins);
                          setSecondsLeft(mins * 60);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                          targetMinutes === mins
                            ? 'bg-[#6B705C] text-white'
                            : 'bg-[#F2EFE9] text-[#4A4E4D] hover:bg-[#E0DBD0]'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleStartFocus}
                    disabled={!goal.trim()}
                    className="px-6 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <Flame className="w-4 h-4 text-amber-300" />
                    <span>Lock In Goal & Begin</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inspirational Grounding Quote */}
          <div className="bg-white p-5 rounded-3xl border border-[#E0DBD0] text-xs text-[#6B705C] italic flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p>"Your focus is your most scarce cognitive currency. When you protect it from distractions, one hour produces the mastery of four."</p>
              <span className="block mt-1 font-mono text-[10px] uppercase font-bold text-[#4A4E4D]">— Deep Work Principle</span>
            </div>
          </div>
        </div>

        {/* Right Column: Ambient Soundboard Mixer */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E0DBD0] shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#6B705C]/15 text-[#6B705C] flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#4A4E4D]">Ambient Soundboard</h2>
                  <p className="text-[11px] text-[#6B705C]">Pure synthesized Web Audio. Zero lag.</p>
                </div>
              </div>

              <button
                onClick={handleToggleMute}
                className="w-8 h-8 rounded-xl bg-[#FAF8F5] border border-[#E0DBD0] flex items-center justify-center text-[#4A4E4D] hover:bg-[#F2EFE9] cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-[#6B705C]" />}
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD0]">
              <div className="flex justify-between text-[11px] font-mono text-[#6B705C]">
                <span>Acoustic Volume</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-[#6B705C] cursor-pointer"
              />
            </div>

            {/* Sound Presets Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {SOUND_TRACKS.map((track) => {
                const isPlaying = activeTrack === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => handleToggleSound(track.id)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between h-24 ${
                      isPlaying
                        ? 'bg-[#6B705C] border-[#6B705C] text-white shadow-md'
                        : 'bg-[#FAF8F5] border-[#E0DBD0] hover:bg-white text-[#4A4E4D]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={isPlaying ? 'text-[#FFE8D6]' : 'text-[#6B705C]'}>
                        {track.icon}
                      </div>
                      {isPlaying ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                      ) : (
                        <Play className="w-3 h-3 text-[#6B705C]/40" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">{track.name}</div>
                      <div className={`text-[10px] line-clamp-1 mt-0.5 ${isPlaying ? 'text-white/80' : 'text-[#6B705C]'}`}>
                        {track.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeTrack && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Playing <strong>{SOUND_TRACKS.find(t => t.id === activeTrack)?.name}</strong></span>
                </div>
                <button
                  onClick={() => handleToggleSound(activeTrack)}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
