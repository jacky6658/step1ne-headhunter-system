import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { updateUserProfile } from '../services/userService';
import { X, Upload, User, MessageSquare, Save, Loader2 } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdate
}) => {
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [status, setStatus] = useState(userProfile.status || '');
  const [avatar, setAvatar] = useState(userProfile.avatar || '');
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile.displayName);
      setStatus(userProfile.status || '');
      setAvatar(userProfile.avatar || '');
    }
  }, [isOpen, userProfile]);

  const processImageFile = (file: File) => {
    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      return;
    }

    // 檢查檔案大小（限制 2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('圖片大小不能超過 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatar(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert('請輸入暱稱');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserProfile(userProfile.uid, {
        displayName: displayName.trim(),
        status: status.trim() || undefined,
        avatar: avatar || undefined
      });

      if (updated) {
        // 更新 localStorage 中的 profile
        localStorage.setItem('caseflow_profile', JSON.stringify(updated));
        onUpdate(updated);
        onClose();
      }
    } catch (err) {
      console.error('更新失敗', err);
      alert('更新失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.length === 0) return '??';
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-md">
      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/20 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 md:p-8 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl sm:rounded-2xl">
              <User size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">個人化設定</h3>
              <p className="text-[10px] sm:text-xs text-slate-500">自訂您的個人資料</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-900 p-1.5 sm:p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
          {/* 大頭照上傳 */}
          <div className="space-y-2 sm:space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">
              大頭照
            </label>
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl sm:rounded-2xl p-4 sm:p-6 cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 scale-105'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Avatar"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl object-cover border-2 border-slate-200"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-black border-2 border-slate-200">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg">
                    <Upload size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <p className="text-sm sm:text-base font-bold text-slate-700 mb-1">
                    {isDragging ? '放開以上傳' : '拖曳圖片至此或點擊上傳'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400">支援 JPG、PNG，最大 2MB</p>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* 暱稱 */}
          <div className="space-y-2 sm:space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block">
              暱稱
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-800 transition-all"
              placeholder="請輸入您的暱稱"
            />
          </div>

          {/* 狀態 */}
          <div className="space-y-2 sm:space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
              <MessageSquare size={10} className="sm:w-3 sm:h-3" />
              個人狀態
            </label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-800 transition-all"
              placeholder="例如：在線、忙碌、離開等"
            />
            <p className="text-[10px] sm:text-xs text-slate-400">讓團隊成員了解您目前的狀態</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 md:p-8 border-t flex gap-2 sm:gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 text-slate-600 font-black hover:bg-slate-50 rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base active:scale-95"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-xl sm:rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base active:scale-95"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <span>儲存中...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                <span>儲存變更</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsModal;
