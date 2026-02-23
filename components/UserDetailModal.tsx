import React from 'react';
import { UserProfile, Role } from '../types';
import { Shield, User, Mail, Calendar, MessageSquare, X, Clock } from 'lucide-react';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentUser?: UserProfile;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUser
}) => {
  if (!isOpen) return null;

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '未知';
    }
  };

  const isCurrentUser = currentUser?.uid === user.uid;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-md" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 sm:p-8 border-b">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-slate-300 hover:text-slate-900 p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl object-cover border-4 border-slate-200 shadow-xl"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-black border-4 border-slate-200 shadow-xl">
                  {getInitials(user.displayName)}
                </div>
              )}
              {user.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-green-500 border-4 border-white rounded-full shadow-lg"></div>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">{user.displayName}</h3>
              <div className="flex items-center justify-center gap-2">
                {user.role === Role.ADMIN ? (
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm text-purple-600 font-black uppercase tracking-widest bg-purple-50 px-3 py-1.5 rounded-full">
                    <Shield size={12} className="sm:w-4 sm:h-4" />
                    管理員
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full">
                    <User size={12} className="sm:w-4 sm:h-4" />
                    內部員工
                  </span>
                )}
                {user.isOnline && (
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm text-green-600 font-black uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    在線
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-4 sm:space-y-6">
          {user.status && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-indigo-600" />
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">個人狀態</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-indigo-900">{user.status}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Mail size={18} className="text-slate-400" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Email</p>
                <p className="text-sm sm:text-base font-bold text-slate-700">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Calendar size={18} className="text-slate-400" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">加入時間</p>
                <p className="text-sm sm:text-base font-bold text-slate-700">
                  {formatDate(user.createdAt)}
                </p>
              </div>
            </div>

            {user.lastSeen && !user.isOnline && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Clock size={18} className="text-slate-400" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">最後上線</p>
                  <p className="text-sm sm:text-base font-bold text-slate-700">
                    {formatDate(user.lastSeen)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
