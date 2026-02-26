import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { updateUserProfile } from '../services/userService';
import { apiPut, apiGet } from '../config/api';
import { X, Upload, User, MessageSquare, Save, Loader2, Phone, Mail, Hash, Eye, EyeOff, Github, Search } from 'lucide-react';

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
  const [contactPhone, setContactPhone] = useState(userProfile.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(userProfile.contactEmail || '');
  const [lineId, setLineId] = useState(userProfile.lineId || '');
  const [telegramHandle, setTelegramHandle] = useState(userProfile.telegramHandle || '');
  const [githubToken, setGithubToken] = useState(userProfile.githubToken || '');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [braveApiKey, setBraveApiKey] = useState(userProfile.braveApiKey || '');
  const [showBraveKey, setShowBraveKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile.displayName);
      setStatus(userProfile.status || '');
      setAvatar(userProfile.avatar || '');
      setContactPhone(userProfile.contactPhone || '');
      setContactEmail(userProfile.contactEmail || '');
      setLineId(userProfile.lineId || '');
      setTelegramHandle(userProfile.telegramHandle || '');
      setGithubToken(userProfile.githubToken || '');
      setBraveApiKey(userProfile.braveApiKey || '');
      // 從後端載入最新聯絡資訊
      apiGet<any>(`/api/users/${encodeURIComponent(userProfile.displayName)}/contact`)
        .then(res => {
          if (res.success && res.data) {
            if (res.data.contactPhone) setContactPhone(res.data.contactPhone);
            if (res.data.contactEmail) setContactEmail(res.data.contactEmail);
            if (res.data.lineId) setLineId(res.data.lineId);
            if (res.data.telegramHandle) setTelegramHandle(res.data.telegramHandle);
            if (res.data.githubToken) setGithubToken(res.data.githubToken);
            if (res.data.braveApiKey) setBraveApiKey(res.data.braveApiKey);
          }
        })
        .catch(() => {/* 後端不可用時靜默降級 */});
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
      const contactData = {
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        lineId: lineId.trim() || undefined,
        telegramHandle: telegramHandle.trim() || undefined,
        githubToken: githubToken.trim() || undefined,
        braveApiKey: braveApiKey.trim() || undefined,
      };

      // 同步儲存到後端（供 AIbot 使用）
      await apiPut(`/api/users/${encodeURIComponent(displayName.trim())}/contact`, {
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        lineId: lineId.trim(),
        telegramHandle: telegramHandle.trim(),
        githubToken: githubToken.trim(),
        braveApiKey: braveApiKey.trim(),
      }).catch(() => {/* 後端不可用時靜默降級 */});

      const updated = await updateUserProfile(userProfile.uid, {
        displayName: displayName.trim(),
        status: status.trim() || undefined,
        avatar: avatar || undefined,
        ...contactData,
      });

      if (updated) {
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

          {/* 顧問聯絡資訊 */}
          <div className="space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
              <Phone size={10} className="sm:w-3 sm:h-3" />
              聯絡資訊（供 AIbot 代發信件使用）
            </label>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all"
                  placeholder="工作電話（如 0912-345-678）"
                />
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all"
                  placeholder="工作 Email"
                />
              </div>
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all"
                  placeholder="LINE ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all"
                  placeholder="Telegram 帳號（如 @username）"
                />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400">這些資訊會同步到後端，AIbot 代發信件時可自動帶入您的聯絡方式</p>
          </div>

          {/* GitHub Token */}
          <div className="space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
              <Github size={10} className="sm:w-3 sm:h-3" />
              GitHub Token（人才搜尋用）
            </label>
            <div className="flex items-center gap-2">
              <Github size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 relative">
                <input
                  type={showGithubToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all font-mono"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showGithubToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400">
              不填則使用無認證模式（60次/小時）。填入後可提升至 5000次/小時。
              {' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:underline"
              >
                申請 Token →
              </a>
            </p>
          </div>

          {/* Brave Search API Key */}
          <div className="space-y-3">
            <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
              <Search size={10} className="sm:w-3 sm:h-3" />
              Brave Search API Key（LinkedIn 搜尋備援）
            </label>
            <div className="flex items-center gap-2">
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                braveApiKey
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {braveApiKey ? '🦁 Brave 備援已啟用' : '未設定（使用 Google/Bing 兩層備援）'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Search size={14} className="text-orange-500 shrink-0" />
              <div className="flex-1 relative">
                <input
                  type={showBraveKey ? 'text' : 'password'}
                  value={braveApiKey}
                  onChange={(e) => setBraveApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-xl text-sm text-slate-800 transition-all font-mono"
                  placeholder="BSA-xxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowBraveKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showBraveKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400">
              官方搜尋 API，不怕 CAPTCHA 封鎖。設定後成為第三層備援（Google → Bing → Brave）。免費 2000 次/月。
              {' '}
              <a
                href="https://api.search.brave.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:underline"
              >
                申請 API Key →
              </a>
            </p>
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
