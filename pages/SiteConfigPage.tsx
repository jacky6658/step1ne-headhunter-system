import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { apiGet, apiPut } from '../config/api';
import { Save, Loader2, Eye, Plus, Trash2, ExternalLink, Upload, Palette, Layout, Type, Image } from 'lucide-react';

interface SiteConfigPageProps {
  userProfile: UserProfile;
}

interface SiteConfig {
  slug: string;
  template: string;
  primaryColor: string;
  accentColor: string;
  heroTitle: string;
  heroSubtitle: string;
  avatar: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  socialLinks: {
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    line: string;
  };
  featuredJobIds: number[];
  testimonials: { name: string; role: string; content: string }[];
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
}

const TEMPLATES = [
  { id: 'minimal', name: '極簡風', desc: '乾淨留白、大字體', color: '#3b82f6' },
  { id: 'professional', name: '專業商務', desc: '穩重深藍、卡片式', color: '#1e3a5f' },
  { id: 'creative', name: '創意設計', desc: '大膽漸層、動態效果', color: '#f59e0b' },
  { id: 'modern', name: '現代科技', desc: '暗色+霓虹、Grid 佈局', color: '#06b6d4' },
  { id: 'elegant', name: '優雅質感', desc: '襯線字體、米金色調', color: '#b8860b' },
];

const DEFAULT_CONFIG: SiteConfig = {
  slug: '',
  template: 'minimal',
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  heroTitle: '找到適合你的職涯下一步',
  heroSubtitle: '',
  avatar: '',
  bio: '',
  specialties: [],
  yearsExperience: 0,
  socialLinks: { email: '', phone: '', linkedin: '', github: '', line: '' },
  featuredJobIds: [],
  testimonials: [],
  seoTitle: '',
  seoDescription: '',
  isPublished: false,
};

const SiteConfigPage: React.FC<SiteConfigPageProps> = ({ userProfile }) => {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, [userProfile.displayName]);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/api/users/${encodeURIComponent(userProfile.displayName)}/site-config`);
      if (res.siteConfig) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...res.siteConfig,
          slug: res.siteConfig.slug || userProfile.displayName.toLowerCase().replace(/\s+/g, '-'),
        });
      }
    } catch {
      // 首次設定，使用預設值
      setConfig({
        ...DEFAULT_CONFIG,
        slug: userProfile.displayName.toLowerCase().replace(/\s+/g, '-'),
        socialLinks: {
          ...DEFAULT_CONFIG.socialLinks,
          email: userProfile.contactEmail || '',
          phone: userProfile.contactPhone || '',
        },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await apiPut(`/api/users/${encodeURIComponent(userProfile.displayName)}/site-config`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('儲存失敗，請稍後再試');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('圖片大小不能超過 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setConfig(c => ({ ...c, avatar: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function addSpecialty() {
    const s = newSpecialty.trim();
    if (!s || config.specialties.includes(s)) return;
    setConfig(c => ({ ...c, specialties: [...c.specialties, s] }));
    setNewSpecialty('');
  }

  function removeSpecialty(s: string) {
    setConfig(c => ({ ...c, specialties: c.specialties.filter(x => x !== s) }));
  }

  function addTestimonial() {
    setConfig(c => ({
      ...c,
      testimonials: [...c.testimonials, { name: '', role: '', content: '' }],
    }));
  }

  function updateTestimonial(idx: number, field: string, value: string) {
    setConfig(c => ({
      ...c,
      testimonials: c.testimonials.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  }

  function removeTestimonial(idx: number) {
    setConfig(c => ({ ...c, testimonials: c.testimonials.filter((_, i) => i !== idx) }));
  }

  const siteUrl = `https://site.step1ne.com/consultants/${config.slug}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">我的對外頁面</h1>
          <p className="text-sm text-slate-500 mt-1">設定您的顧問個人頁面，展示職缺並接收履歷投遞</p>
        </div>
        <div className="flex items-center gap-3">
          {config.isPublished && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <ExternalLink size={14} />
              預覽頁面
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? '儲存中...' : saved ? '已儲存 ✓' : '儲存設定'}
          </button>
        </div>
      </div>

      {/* Published toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">頁面狀態</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {config.isPublished ? '頁面已公開，求職者可以瀏覽' : '頁面未公開，僅限預覽'}
            </p>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, isPublished: !c.isPublished }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.isPublished ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              config.isPublished ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        {config.isPublished && (
          <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500 font-mono break-all">
            {siteUrl}
          </div>
        )}
      </div>

      {/* Template selection */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layout size={16} className="text-slate-400" />
          <h3 className="font-bold text-slate-900">模板選擇</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setConfig(c => ({ ...c, template: t.id }))}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                config.template === t.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="w-8 h-8 rounded-lg mb-2" style={{ backgroundColor: t.color }} />
              <div className="text-sm font-bold text-slate-800">{t.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
              {config.template === t.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-slate-400" />
          <h3 className="font-bold text-slate-900">配色</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">主色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={config.primaryColor}
                onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm font-mono border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">強調色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.accentColor}
                onChange={e => setConfig(c => ({ ...c, accentColor: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={config.accentColor}
                onChange={e => setConfig(c => ({ ...c, accentColor: e.target.value }))}
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm font-mono border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type size={16} className="text-slate-400" />
          <h3 className="font-bold text-slate-900">首頁內容</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">site.step1ne.com/consultants/</span>
              <input
                type="text"
                value={config.slug}
                onChange={e => setConfig(c => ({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm font-mono border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Hero 標題</label>
            <input
              type="text"
              value={config.heroTitle}
              onChange={e => setConfig(c => ({ ...c, heroTitle: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              placeholder="例：找到適合你的職涯下一步"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Hero 副標題</label>
            <textarea
              value={config.heroSubtitle}
              onChange={e => setConfig(c => ({ ...c, heroSubtitle: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all resize-none"
              placeholder="一段簡短的自我介紹或標語..."
            />
          </div>
        </div>
      </div>

      {/* Avatar & Bio */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image size={16} className="text-slate-400" />
          <h3 className="font-bold text-slate-900">個人資料</h3>
        </div>
        <div className="space-y-4">
          {/* Avatar */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">頭像</label>
            <div className="flex items-center gap-4">
              {config.avatar ? (
                <img src={config.avatar} alt="Avatar" className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {userProfile.displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <Upload size={14} />
                上傳頭像
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">個人簡介</label>
            <textarea
              value={config.bio}
              onChange={e => setConfig(c => ({ ...c, bio: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all resize-none"
              placeholder="介紹你的專業背景、服務理念..."
            />
          </div>

          {/* Years experience */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">從業年資</label>
              <input
                type="number"
                value={config.yearsExperience}
                onChange={e => setConfig(c => ({ ...c, yearsExperience: parseInt(e.target.value) || 0 }))}
                min={0}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Specialties */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">專長領域</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {config.specialties.map(s => (
                <span key={s} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                  {s}
                  <button onClick={() => removeSpecialty(s)} className="hover:text-red-500">
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpecialty}
                onChange={e => setNewSpecialty(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
                placeholder="輸入專長後按 Enter 或點擊新增"
              />
              <button
                onClick={addSpecialty}
                className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <Plus size={14} />
                新增
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">聯繫方式</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'email', label: 'Email', placeholder: 'you@example.com' },
            { key: 'phone', label: '電話', placeholder: '0912-345-678' },
            { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
            { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...' },
            { key: 'line', label: 'LINE ID', placeholder: '@line-id' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs font-bold text-slate-500 block mb-1">{field.label}</label>
              <input
                type="text"
                value={(config.socialLinks as any)[field.key] || ''}
                onChange={e => setConfig(c => ({
                  ...c,
                  socialLinks: { ...c.socialLinks, [field.key]: e.target.value },
                }))}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">推薦語</h3>
          <button
            onClick={addTestimonial}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus size={12} />
            新增推薦語
          </button>
        </div>
        {config.testimonials.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">尚無推薦語，點擊上方按鈕新增</p>
        ) : (
          <div className="space-y-4">
            {config.testimonials.map((t, idx) => (
              <div key={idx} className="relative p-4 bg-slate-50 rounded-xl">
                <button
                  onClick={() => removeTestimonial(idx)}
                  className="absolute top-3 right-3 text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={t.name}
                    onChange={e => updateTestimonial(idx, 'name', e.target.value)}
                    className="px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:border-indigo-500 transition-all"
                    placeholder="姓名"
                  />
                  <input
                    type="text"
                    value={t.role}
                    onChange={e => updateTestimonial(idx, 'role', e.target.value)}
                    className="px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:border-indigo-500 transition-all"
                    placeholder="職稱"
                  />
                </div>
                <textarea
                  value={t.content}
                  onChange={e => updateTestimonial(idx, 'content', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 focus:border-indigo-500 transition-all resize-none"
                  placeholder="推薦內容..."
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEO */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">SEO 設定</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">SEO 標題</label>
            <input
              type="text"
              value={config.seoTitle}
              onChange={e => setConfig(c => ({ ...c, seoTitle: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
              placeholder={`${userProfile.displayName} - Step1ne 獵頭顧問`}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">SEO 描述</label>
            <textarea
              value={config.seoDescription}
              onChange={e => setConfig(c => ({ ...c, seoDescription: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all resize-none"
              placeholder="簡短描述您的專業服務（160 字以內）..."
            />
          </div>
        </div>
      </div>

      {/* Bottom save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? '儲存中...' : saved ? '已儲存 ✓' : '儲存設定'}
        </button>
      </div>
    </div>
  );
};

export default SiteConfigPage;
