import { useState } from 'react';
import { User } from '../types';
import { Shield, User as UserIcon, LogOut, ChevronDown, Activity, Stethoscope, Eye, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { PRODUCT_NAME } from '../utils/branding';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
}

export default function Header({ currentUser, onLogout }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const roleMeta = getRoleMeta(currentUser.role, t);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200" id="app-header">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Brand Section */}
          <div className="flex items-center space-x-3" id="brand-logo">
            <div className="flex items-center justify-center bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <Activity size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-800">{PRODUCT_NAME}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold tracking-wider">{t('at_service_of')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Elegant pill switcher for Language ES / EN */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner" id="language-switcher">
              <button
                type="button"
                onClick={() => setLanguage('ES')}
                className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
                  language === 'ES'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
                id="btn-lang-es"
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
                  language === 'EN'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
                id="btn-lang-en"
              >
                EN
              </button>
            </div>

            {/* User Context Switcher Dropdown */}
            <div className="relative" id="user-controls-dropdown">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer text-left"
                id="user-profile-button"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                  {roleMeta.initial}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 leading-none">{currentUser.name}</p>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {roleMeta.icon}
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {roleMeta.label}
                    </span>
                  </div>
                </div>
                <ChevronDown size={14} className="text-slate-500 ml-1" />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 rounded-lg bg-white shadow-xl ring-1 ring-black/5 z-50 divide-y divide-slate-100 border border-slate-200"
                  id="user-picker-menu"
                >
                  <div className="px-4 py-3 bg-slate-50 rounded-t-lg">
                    <p className="text-xs font-semibold text-slate-800">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{currentUser.email}</p>
                  </div>

                  {/* Footer and Signout */}
                  <div className="py-1">
                    <button
                      onClick={onLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition cursor-pointer font-medium"
                      id="logout-button"
                    >
                      <LogOut size={14} className="mr-2" />
                      {t('sign_out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function getRoleMeta(role: User['role'], t: (key: string) => string) {
  switch (role) {
    case 'ADMIN':
      return { initial: 'A', label: t('admin'), icon: <Shield size={10} className="text-emerald-600" /> };
    case 'PHYSICIAN':
      return { initial: 'P', label: t('physician'), icon: <Stethoscope size={10} className="text-violet-600" /> };
    case 'AUXILIARY_PERSONNEL':
      return { initial: 'A', label: t('auxiliary_personnel'), icon: <UserIcon size={10} className="text-blue-600" /> };
    case 'AUDITOR':
      return { initial: 'A', label: t('auditor'), icon: <ClipboardCheck size={10} className="text-slate-600" /> };
    case 'VIEWER':
      return { initial: 'V', label: t('viewer'), icon: <Eye size={10} className="text-slate-600" /> };
    case 'NURSE':
    default:
      return { initial: 'N', label: t('nurse'), icon: <UserIcon size={10} className="text-blue-600" /> };
  }
}
