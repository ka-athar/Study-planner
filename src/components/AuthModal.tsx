import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { setActiveUserEmail, getActiveUserEmail } from '../lib/db';
import { setCachedGmailToken } from '../lib/gmailService';
import { setCachedWorkspaceToken } from '../lib/googleAuthService';
import { X, Mail, Lock, User, Sparkles, Smartphone, Laptop, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailChanged?: (newEmail: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onEmailChanged }) => {
  const [authTab, setAuthTab] = useState<'account' | 'cross_device'>('account');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [crossDeviceEmail, setCrossDeviceEmail] = useState(getActiveUserEmail());
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedGmailToken(credential.accessToken);
        setCachedWorkspaceToken(credential.accessToken);
      }
      if (result.user.email) {
        setActiveUserEmail(result.user.email);
        if (onEmailChanged) onEmailChanged(result.user.email);
      }
      setSuccessMsg('Google Account & Gmail linked successfully!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        console.warn("Google Auth popup was blocked by browser:", err);
        setError('Pop-up window was blocked by your browser inside the preview frame. Please click "Open in New Tab" below to sign in cleanly.');
      } else {
        console.warn("Google Auth error:", err);
        setError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCred.user, { displayName });
        }
        if (userCred.user.email) {
          setActiveUserEmail(userCred.user.email);
          if (onEmailChanged) onEmailChanged(userCred.user.email);
        }
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (userCred.user.email) {
          setActiveUserEmail(userCred.user.email);
          if (onEmailChanged) onEmailChanged(userCred.user.email);
        }
      }
      onClose();
    } catch (err: any) {
      console.error("Email auth error:", err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectCrossDeviceEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crossDeviceEmail || !crossDeviceEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setActiveUserEmail(crossDeviceEmail.trim().toLowerCase());
    if (onEmailChanged) onEmailChanged(crossDeviceEmail.trim().toLowerCase());
    setSuccessMsg(`Cross-device sync connected to ${crossDeviceEmail.trim().toLowerCase()}!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface border border-theme rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-primary">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-primary p-1.5 rounded-xl hover:bg-theme-accent transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-theme-accent border border-theme text-primary flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-primary">
            Cloud & Cross-Device Sync
          </h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Seamlessly access your syllabus, test scores, flashcards, and daily goals across all your phones, laptops, and tablets.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-theme-accent p-1 mb-4 border border-theme text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setAuthTab('account'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
              authTab === 'account' ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            Google / Password
          </button>
          <button
            type="button"
            onClick={() => { setAuthTab('cross_device'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authTab === 'cross_device' ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Connect by Email</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs space-y-2">
            <p>{error}</p>
            {isInIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab to Link Google</span>
              </a>
            )}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {authTab === 'cross_device' ? (
          /* Instant Cross-Device Sync by Email */
          <form onSubmit={handleConnectCrossDeviceEmail} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-theme-accent/60 border border-theme space-y-2 text-xs">
              <div className="font-semibold text-primary flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-500" />
                <span>Same Email = Same Data Across Devices</span>
              </div>
              <p className="text-muted text-[11px] leading-relaxed">
                Enter your student email below. Any phone, iPad, or computer using this same email address will instantly load and sync all your study materials in real-time.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary mb-1">Active Study Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="email"
                  required
                  value={crossDeviceEmail}
                  onChange={(e) => setCrossDeviceEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sync All Devices With This Email</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Standard Auth Form */
          <>
            {/* Google Auth Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-theme-accent hover:opacity-90 text-primary font-semibold text-xs rounded-xl transition border border-theme shadow-2xs disabled:opacity-50 mb-3 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.1 0-5.74-2.09-6.68-4.91H1.36v3.15C3.33 21.31 7.42 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.36C.49 8.29 0 10.09 0 12s.49 3.71 1.36 5.44l3.96-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.42 0 3.33 2.69 1.36 6.56l3.96 3.15c.94-2.82 3.58-4.96 6.68-4.96z"
                />
              </svg>
              <span>Continue with Google Account</span>
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-theme"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-surface px-2 text-muted font-mono">or email password</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-semibold text-primary mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Student Name"
                      className="w-full pl-9 pr-3 py-2 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-theme-accent/30 border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-semibold text-xs rounded-xl transition shadow-sm disabled:opacity-50 mt-1 cursor-pointer"
              >
                {loading ? 'Processing...' : isSignUp ? 'Create & Sync Account' : 'Sign In & Sync'}
              </button>
            </form>

            <div className="mt-3 pt-3 border-t border-theme flex items-center justify-between text-xs text-muted">
              <span>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary font-semibold hover:underline cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
