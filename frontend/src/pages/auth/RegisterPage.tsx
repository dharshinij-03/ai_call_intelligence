import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ErrorBanner } from '../../components/Spinner';
import { DEPARTMENTS, type Department, type UserRole } from '../../lib/types';
import { Eye, EyeOff, Shield, ArrowRight, User, Mail, Phone, Lock, Briefcase, Key } from 'lucide-react';

const ROLE_INFO: Record<UserRole, { label: string; description: string }> = {
  citizen: { label: 'Citizen', description: 'File and track complaints' },
  operator: { label: 'Operator', description: 'Manage incoming calls' },
  officer: { label: 'Field Officer', description: 'Resolve assigned complaints' },
  admin: { label: 'Administrator', description: 'Full portal access' },
};

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('citizen');
  const [department, setDepartment] = useState<Department | ''>('');
  const [bootstrapKey, setBootstrapKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        phone_number: phone || undefined,
        role,
        department: role === 'officer' && department ? department : undefined,
        admin_bootstrap_key: role !== 'citizen' ? bootstrapKey : undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4" style={{ background: '#f1f5f9' }}>
      <div className="w-full max-w-lg animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <Shield className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500">
            Citizens can register freely. Staff accounts require a bootstrap key.
          </p>
        </div>

        <div className="card p-8" style={{ borderRadius: '20px' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full name */}
            <div>
              <label className="form-label" htmlFor="fullname">
                <span className="flex items-center gap-1.5"><User size={13} /> Full name</span>
              </label>
              <input
                id="fullname"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="Jane Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className="form-label" htmlFor="reg-email">
                  <span className="flex items-center gap-1.5"><Mail size={13} /> Email</span>
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="you@example.com"
                />
              </div>
              {/* Phone */}
              <div>
                <label className="form-label" htmlFor="phone">
                  <span className="flex items-center gap-1.5"><Phone size={13} /> Phone <span className="text-slate-400 font-normal">(optional)</span></span>
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                  placeholder="+1 555 000 0000"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="form-label" htmlFor="reg-password">
                <span className="flex items-center gap-1.5"><Lock size={13} /> Password</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="At least 8 characters"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="form-label">
                <span className="flex items-center gap-1.5"><Briefcase size={13} /> Account role</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['citizen', 'operator', 'officer', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="text-left p-3 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: role === r ? '#6366f1' : '#e2e8f0',
                      background: role === r ? '#eef2ff' : 'white',
                    }}
                  >
                    <div className="text-xs font-bold" style={{ color: role === r ? '#4f46e5' : '#374151' }}>
                      {ROLE_INFO[r].label}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: role === r ? '#6366f1' : '#94a3b8' }}>
                      {ROLE_INFO[r].description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Department — only for officer */}
            {role === 'officer' && (
              <div className="animate-fade-in-up">
                <label className="form-label" htmlFor="department">Department</label>
                <select
                  id="department"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="form-select"
                >
                  <option value="" disabled>Select your department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Bootstrap key — all non-citizen */}
            {role !== 'citizen' && (
              <div className="animate-fade-in-up">
                <label className="form-label" htmlFor="bootstrap">
                  <span className="flex items-center gap-1.5"><Key size={13} /> Admin bootstrap key</span>
                </label>
                <input
                  id="bootstrap"
                  required
                  type="password"
                  value={bootstrapKey}
                  onChange={(e) => setBootstrapKey(e.target.value)}
                  className="form-input"
                  placeholder="Ask your administrator"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Required to create staff accounts — contact the portal administrator.
                </p>
              </div>
            )}

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
                    className="w-4 h-4 border-2 border-white/30 rounded-full"
                    style={{ borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }}
                  />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
