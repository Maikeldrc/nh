import { useState } from 'react';
import { User, UserRole } from '../types';
import { SEED_USERS } from '../data';
import { Shield, User as UserIcon, LogOut, ChevronDown, Check, Activity, Award, Globe } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { PRODUCT_NAME } from '../utils/branding';

interface HeaderProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}

export default function Header({ currentUser, onUserChange, onLogout }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const handleUserSelect = (user: User) => {
    onUserChange(user);
    setDropdownOpen(false);
  };

  return (
    <header className="bg-white border-b border-slate-200" id="app-header">
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
                  {currentUser.role === 'ADMIN' ? 'A' : 'E'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 leading-none">{currentUser.name}</p>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {currentUser.role === 'ADMIN' ? (
                      <Shield size={10} className="text-emerald-600" />
                    ) : (
                      <UserIcon size={10} className="text-blue-600" />
                    )}
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {currentUser.role === 'ADMIN' ? t('admin') : t('nurse')}
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
                  {/* Header info */}
                  <div className="px-4 py-3 bg-slate-50 rounded-t-lg">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('change_user')}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t('ideal_for_testing')}</p>
                  </div>

                  {/* Users List */}
                  <div className="py-1">
                    {SEED_USERS.map((user) => {
                      const isSelected = user.id === currentUser.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className={`flex items-center justify-between w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition cursor-pointer ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700'
                          }`}
                          id={`switch-to-user-${user.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              user.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-100 text-blue-900'
                            }`}>
                              {user.role === 'ADMIN' ? 'A' : 'E'}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-slate-900 leading-tight">{user.name}</p>
                              <p className="text-[10px] text-slate-500 leading-none">
                                {user.role === 'ADMIN' ? t('general_access') : t('nurse_visits')}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-blue-600" />}
                        </button>
                      );
                    })}
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
