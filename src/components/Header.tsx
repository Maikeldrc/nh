import { useState } from 'react';
import { User } from '../types';
import { Shield, User as UserIcon, LogOut, ChevronDown, Stethoscope, Eye, ClipboardCheck, KeyRound, X } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { changeOwnPassword } from '../utils/auth';
import { PRODUCT_NAME } from '../utils/branding';
import appLogo from '../assets/amavita-logo.png';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
}

export default function Header({ currentUser, onLogout }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const roleMeta = getRoleMeta(currentUser.role, t);

  const openPasswordModal = () => {
    setDropdownOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordModalOpen(true);
  };

  const submitPasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!currentPassword) {
      setPasswordError(l('Ingresa tu contraseña actual.', 'Enter your current password.'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(l('La nueva contraseña debe tener al menos 8 caracteres.', 'The new password must be at least 8 characters.'));
      return;
    }
    if (/\s/.test(newPassword)) {
      setPasswordError(l('La nueva contraseña no debe contener espacios.', 'The new password cannot contain spaces.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(l('Las contraseñas no coinciden.', 'Passwords do not match.'));
      return;
    }
    setIsChangingPassword(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(l('Contraseña actualizada correctamente.', 'Password updated successfully.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setPasswordError(messageForPasswordError(message, l));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200" id="app-header">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Brand Section */}
          <div className="flex items-center space-x-3" id="brand-logo">
            <img src={appLogo} alt="" aria-hidden="true" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
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
                      onClick={openPasswordModal}
                      className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer font-medium"
                      id="change-own-password-button"
                    >
                      <KeyRound size={14} className="mr-2 text-blue-600" />
                      {l('Cambiar contraseña', 'Change password')}
                    </button>
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

    {passwordModalOpen && (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/45 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{l('Cambiar contraseña', 'Change password')}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">{currentUser.email}</p>
            </div>
            <button type="button" onClick={() => setPasswordModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-600">
              {l('Contraseña actual', 'Current password')}
              <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              {l('Nueva contraseña', 'New password')}
              <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              {l('Confirmar nueva contraseña', 'Confirm new password')}
              <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
            </label>
            <p className="text-[11px] font-semibold text-slate-500">{l('Usa al menos 8 caracteres y evita espacios.', 'Use at least 8 characters and avoid spaces.')}</p>
            {passwordError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{passwordError}</div>}
            {passwordSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{passwordSuccess}</div>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
            <button type="button" onClick={() => setPasswordModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              {l('Cerrar', 'Close')}
            </button>
            <button type="button" disabled={isChangingPassword} onClick={() => void submitPasswordChange()} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60">
              {isChangingPassword ? l('Actualizando...', 'Updating...') : l('Actualizar contraseña', 'Update password')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function messageForPasswordError(message: string, l: (es: string, en: string) => string): string {
  if (message.includes('auth/wrong-password') || message.includes('auth/invalid-credential')) {
    return l('La contraseña actual no es correcta.', 'The current password is not correct.');
  }
  if (message.includes('auth/weak-password')) {
    return l('La nueva contraseña es demasiado débil.', 'The new password is too weak.');
  }
  if (message.includes('auth/requires-recent-login')) {
    return l('Por seguridad, cierra sesión e inicia sesión nuevamente antes de cambiar la contraseña.', 'For security, sign out and sign in again before changing your password.');
  }
  return l('No se pudo actualizar la contraseña.', 'Unable to update the password.');
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
