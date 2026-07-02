import React, { useState } from 'react';
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { loginWithEmail } from '../utils/auth';

interface LoginProps {
  onLoginSuccess: () => void;
  initialError?: string;
}

export default function Login({ onLoginSuccess, initialError = '' }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('enter_email'));
      return;
    }

    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      onLoginSuccess();
    } catch {
      setError(t('invalid_creds'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8" id="login-page">
      {/* Absolute top language selector during login */}
      <div className="absolute top-4 right-4 flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm" id="login-language-selector">
        <button
          type="button"
          onClick={() => setLanguage('ES')}
          className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
            language === 'ES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="login-btn-lang-es"
        >
          ES
        </button>
        <button
          type="button"
          onClick={() => setLanguage('EN')}
          className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
            language === 'EN'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="login-btn-lang-en"
        >
          EN
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center justify-center bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-600/20">
            <Activity size={32} className="stroke-[2.5]" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-800 tracking-tight">
          {t('login_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w">
          {t('login_subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit} id="login-form">
            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start space-x-3" id="login-error-alert">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-red-800">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                {t('email_label')}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="ejemplo@amavita.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                {t('pass_label')}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition cursor-pointer shadow-blue-600/20"
                id="btn-submit-login"
                disabled={submitting}
              >
                {submitting ? 'Signing in...' : t('login_btn')}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
