import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ErrorBanner } from '../../components/Spinner';
import { Eye, EyeOff, Shield, ArrowRight, Phone, FileText, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { icon: Phone, text: 'Call-based complaint submission' },
  { icon: FileText, text: 'Real-time status tracking' },
  { icon: CheckCircle2, text: 'AI-powered complaint routing' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('citizen2@example.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#f1f5f9' }}
    >
      {/* Left panel - branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        }}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Decorative blobs */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #14b8a6, transparent)' }}
        />

        {/* Logo */}
        <div className="relative animate-slide-in-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Complaint Tracker</div>
              <div className="text-indigo-300 text-sm">Civic Management Portal</div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Civic Complaints,<br />
            <span style={{ color: '#a5b4fc' }}>Resolved Faster</span>
          </h1>
          <p className="text-indigo-200 text-base leading-relaxed mb-10">
            AI-powered complaint management that routes citizen issues directly to the right department, every time.
          </p>

          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-fade-in-up"
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <f.icon size={16} className="text-indigo-300" />
                </div>
                <span className="text-indigo-100 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-indigo-300/60 text-xs animate-fade-in" style={{ animationDelay: '500ms' }}>
          © 2025 CivicTech Solutions. All rights reserved.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className="w-full max-w-md animate-fade-in-up"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Complaint Tracker</div>
              <div className="text-slate-400 text-xs">Civic Management Portal</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-500 text-sm">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0" htmlFor="password">Password</label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter your password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full justify-center py-3 text-base"
              style={{ width: '100%', borderRadius: '12px', fontSize: '15px' }}
            >
              {submitting ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white/30 rounded-full flex-shrink-0"
                    style={{ borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            New citizen?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
