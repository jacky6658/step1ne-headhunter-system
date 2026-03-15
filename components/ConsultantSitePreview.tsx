import React from 'react';
import { Mail, Phone, Linkedin, Github, MessageCircle, Star, MapPin, Briefcase, ExternalLink, Award, Users, ChevronRight } from 'lucide-react';

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

interface ConsultantSitePreviewProps {
  config: SiteConfig;
  displayName: string;
}

// ===================== Template Renderers =====================

function MinimalTemplate({ config, displayName }: ConsultantSitePreviewProps) {
  return (
    <div className="min-h-full bg-white text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Hero */}
      <section className="py-20 px-8 text-center max-w-3xl mx-auto">
        {config.avatar ? (
          <img src={config.avatar} alt={displayName} className="w-24 h-24 rounded-full mx-auto mb-6 object-cover shadow-md" />
        ) : (
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-white text-2xl font-bold shadow-md"
            style={{ backgroundColor: config.accentColor }}>
            {displayName.substring(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-4xl font-bold mb-2" style={{ color: config.primaryColor }}>{displayName}</h1>
        <p className="text-xl text-gray-500 mb-4">{config.heroTitle || '找到適合你的職涯下一步'}</p>
        {config.heroSubtitle && <p className="text-base text-gray-400 max-w-lg mx-auto">{config.heroSubtitle}</p>}
        {config.yearsExperience > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-600">
            <Briefcase size={14} /> {config.yearsExperience} 年獵頭經驗
          </div>
        )}
      </section>

      {/* Bio */}
      {config.bio && (
        <section className="py-12 px-8 max-w-2xl mx-auto">
          <p className="text-base text-gray-600 leading-relaxed text-center">{config.bio}</p>
        </section>
      )}

      {/* Specialties */}
      {config.specialties.length > 0 && (
        <section className="py-12 px-8 max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold mb-6" style={{ color: config.primaryColor }}>專長領域</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {config.specialties.map((s, i) => (
              <span key={i} className="px-4 py-2 rounded-full text-sm font-medium border"
                style={{ borderColor: config.accentColor, color: config.accentColor }}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.testimonials.length > 0 && (
        <section className="py-12 px-8 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold mb-8 text-center" style={{ color: config.primaryColor }}>客戶推薦</h2>
          <div className="grid gap-6">
            {config.testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-gray-600 italic mb-4">「{t.content}」</p>
                <div className="text-sm">
                  <span className="font-bold text-gray-800">{t.name}</span>
                  {t.role && <span className="text-gray-400 ml-2">— {t.role}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="py-12 px-8 max-w-2xl mx-auto text-center border-t border-gray-100">
        <h2 className="text-lg font-bold mb-6" style={{ color: config.primaryColor }}>聯繫我</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {config.socialLinks.email && (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              <Mail size={14} /> {config.socialLinks.email}
            </span>
          )}
          {config.socialLinks.phone && (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              <Phone size={14} /> {config.socialLinks.phone}
            </span>
          )}
          {config.socialLinks.linkedin && (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              <Linkedin size={14} /> LinkedIn
            </span>
          )}
          {config.socialLinks.line && (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              <MessageCircle size={14} /> {config.socialLinks.line}
            </span>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-300">
        Powered by Step1ne Headhunter System
      </footer>
    </div>
  );
}

function ProfessionalTemplate({ config, displayName }: ConsultantSitePreviewProps) {
  return (
    <div className="min-h-full" style={{ fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: '#f8fafc' }}>
      {/* Navy Header */}
      <header className="text-white py-16 px-8" style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.primaryColor}dd)` }}>
        <div className="max-w-4xl mx-auto flex items-center gap-8">
          {config.avatar ? (
            <img src={config.avatar} alt={displayName} className="w-28 h-28 rounded-2xl object-cover border-4 border-white/20 shadow-xl" />
          ) : (
            <div className="w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold border-4 border-white/20 shadow-xl"
              style={{ backgroundColor: config.accentColor }}>
              {displayName.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            <p className="text-lg opacity-80">{config.heroTitle}</p>
            {config.yearsExperience > 0 && (
              <div className="mt-3 flex items-center gap-4 text-sm opacity-70">
                <span className="flex items-center gap-1"><Award size={14} /> {config.yearsExperience} 年經驗</span>
                <span className="flex items-center gap-1"><Users size={14} /> 專業獵頭顧問</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
        {/* Bio Card */}
        {config.bio && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4" style={{ color: config.primaryColor }}>關於我</h2>
            <p className="text-gray-600 leading-relaxed">{config.bio}</p>
          </div>
        )}

        {/* Specialties + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {config.specialties.length > 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-4" style={{ color: config.primaryColor }}>專長領域</h2>
              <div className="space-y-2">
                {config.specialties.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50">
                    <ChevronRight size={14} style={{ color: config.accentColor }} />
                    <span className="text-sm text-gray-700 font-medium">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4" style={{ color: config.primaryColor }}>聯繫資訊</h2>
            <div className="space-y-3">
              {config.socialLinks.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}15`, color: config.accentColor }}><Mail size={14} /></div>
                  {config.socialLinks.email}
                </div>
              )}
              {config.socialLinks.phone && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}15`, color: config.accentColor }}><Phone size={14} /></div>
                  {config.socialLinks.phone}
                </div>
              )}
              {config.socialLinks.linkedin && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}15`, color: config.accentColor }}><Linkedin size={14} /></div>
                  LinkedIn
                </div>
              )}
              {config.socialLinks.line && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accentColor}15`, color: config.accentColor }}><MessageCircle size={14} /></div>
                  {config.socialLinks.line}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Testimonials */}
        {config.testimonials.length > 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-6" style={{ color: config.primaryColor }}>客戶推薦</h2>
            <div className="grid gap-4">
              {config.testimonials.map((t, i) => (
                <div key={i} className="p-5 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex gap-1 mb-2">
                    {[1,2,3,4,5].map(n => <Star key={n} size={12} className="fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-gray-600 text-sm mb-3">「{t.content}」</p>
                  <p className="text-xs font-bold text-gray-800">{t.name} <span className="font-normal text-gray-400">· {t.role}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="py-6 text-center text-xs text-gray-300">Powered by Step1ne</footer>
    </div>
  );
}

function CreativeTemplate({ config, displayName }: ConsultantSitePreviewProps) {
  return (
    <div className="min-h-full text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)` }}>
      {/* Hero */}
      <section className="py-20 px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 30% 40%, ${config.accentColor}, transparent 50%), radial-gradient(circle at 70% 60%, #f59e0b, transparent 50%)` }} />
        <div className="relative z-10">
          {config.avatar ? (
            <img src={config.avatar} alt={displayName} className="w-28 h-28 rounded-full mx-auto mb-6 object-cover border-4 shadow-2xl" style={{ borderColor: config.accentColor }} />
          ) : (
            <div className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-bold shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${config.accentColor}, #f59e0b)` }}>
              {displayName.substring(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-5xl font-black mb-3" style={{ background: `linear-gradient(135deg, ${config.accentColor}, #f59e0b)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {displayName}
          </h1>
          <p className="text-xl text-gray-300 mb-2">{config.heroTitle}</p>
          {config.heroSubtitle && <p className="text-sm text-gray-400 max-w-lg mx-auto">{config.heroSubtitle}</p>}
          {config.yearsExperience > 0 && (
            <div className="mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-full border border-white/10 bg-white/5 backdrop-blur">
              <span className="text-3xl font-black" style={{ color: config.accentColor }}>{config.yearsExperience}</span>
              <span className="text-sm text-gray-300 text-left">年<br/>專業經驗</span>
            </div>
          )}
        </div>
      </section>

      {/* Bio */}
      {config.bio && (
        <section className="py-12 px-8 max-w-2xl mx-auto">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
            <p className="text-gray-300 leading-relaxed text-center">{config.bio}</p>
          </div>
        </section>
      )}

      {/* Specialties */}
      {config.specialties.length > 0 && (
        <section className="py-12 px-8 max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold mb-6" style={{ color: config.accentColor }}>✦ 專長領域</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {config.specialties.map((s, i) => (
              <span key={i} className="px-5 py-2.5 rounded-full text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${config.accentColor}30, ${config.accentColor}10)`, border: `1px solid ${config.accentColor}40`, color: config.accentColor }}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.testimonials.length > 0 && (
        <section className="py-12 px-8 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold mb-8 text-center" style={{ color: config.accentColor }}>✦ 客戶見證</h2>
          <div className="grid gap-4">
            {config.testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                <p className="text-gray-300 italic mb-4">「{t.content}」</p>
                <p className="text-sm"><span className="font-bold" style={{ color: config.accentColor }}>{t.name}</span> <span className="text-gray-500">· {t.role}</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="py-12 px-8 max-w-2xl mx-auto text-center">
        <h2 className="text-lg font-bold mb-6" style={{ color: config.accentColor }}>✦ 聯繫</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {config.socialLinks.email && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
              <Mail size={14} style={{ color: config.accentColor }} /> {config.socialLinks.email}
            </span>
          )}
          {config.socialLinks.phone && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
              <Phone size={14} style={{ color: config.accentColor }} /> {config.socialLinks.phone}
            </span>
          )}
          {config.socialLinks.linkedin && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
              <Linkedin size={14} style={{ color: config.accentColor }} /> LinkedIn
            </span>
          )}
          {config.socialLinks.line && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
              <MessageCircle size={14} style={{ color: config.accentColor }} /> {config.socialLinks.line}
            </span>
          )}
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-gray-600">Powered by Step1ne</footer>
    </div>
  );
}

function ModernTemplate({ config, displayName }: ConsultantSitePreviewProps) {
  return (
    <div className="min-h-full" style={{ fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: '#0a0a0a', color: '#e4e4e7' }}>
      {/* Hero with grid bg */}
      <section className="py-20 px-8 relative" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #18181b 100%)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center gap-6 mb-8">
            {config.avatar ? (
              <img src={config.avatar} alt={displayName} className="w-20 h-20 rounded-xl object-cover" style={{ boxShadow: `0 0 20px ${config.accentColor}40` }} />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold text-black"
                style={{ background: config.accentColor, boxShadow: `0 0 20px ${config.accentColor}40` }}>
                {displayName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{displayName}</h1>
              <p className="text-sm mt-1" style={{ color: config.accentColor }}>Headhunter Consultant</p>
            </div>
          </div>
          <h2 className="text-4xl font-black mb-4 leading-tight">{config.heroTitle}</h2>
          {config.heroSubtitle && <p className="text-gray-400 max-w-xl">{config.heroSubtitle}</p>}

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {config.yearsExperience > 0 && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="text-2xl font-black" style={{ color: config.accentColor }}>{config.yearsExperience}+</div>
                <div className="text-xs text-zinc-500 mt-1">年經驗</div>
              </div>
            )}
            {config.specialties.length > 0 && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="text-2xl font-black" style={{ color: config.accentColor }}>{config.specialties.length}</div>
                <div className="text-xs text-zinc-500 mt-1">專長領域</div>
              </div>
            )}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="text-2xl font-black" style={{ color: config.accentColor }}>∞</div>
              <div className="text-xs text-zinc-500 mt-1">職涯可能</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      {config.bio && (
        <section className="py-12 px-8 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: config.accentColor }}>About</h3>
            <p className="text-zinc-400 leading-relaxed">{config.bio}</p>
          </div>
        </section>
      )}

      {/* Skills grid */}
      {config.specialties.length > 0 && (
        <section className="py-8 px-8 max-w-4xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: config.accentColor }}>Skills & Expertise</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {config.specialties.map((s, i) => (
              <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.accentColor }} />
                {s}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.testimonials.length > 0 && (
        <section className="py-12 px-8 max-w-4xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: config.accentColor }}>Testimonials</h3>
          <div className="grid gap-4">
            {config.testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <p className="text-zinc-400 mb-3">「{t.content}」</p>
                <p className="text-sm"><span className="font-bold text-zinc-200">{t.name}</span> <span className="text-zinc-600">· {t.role}</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="py-12 px-8 max-w-4xl mx-auto border-t border-zinc-800">
        <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: config.accentColor }}>Contact</h3>
        <div className="flex flex-wrap gap-4">
          {config.socialLinks.email && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400">
              <Mail size={14} style={{ color: config.accentColor }} /> {config.socialLinks.email}
            </span>
          )}
          {config.socialLinks.phone && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400">
              <Phone size={14} style={{ color: config.accentColor }} /> {config.socialLinks.phone}
            </span>
          )}
          {config.socialLinks.linkedin && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400">
              <Linkedin size={14} style={{ color: config.accentColor }} /> LinkedIn
            </span>
          )}
          {config.socialLinks.line && (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400">
              <MessageCircle size={14} style={{ color: config.accentColor }} /> LINE
            </span>
          )}
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-zinc-700">Powered by Step1ne</footer>
    </div>
  );
}

function ElegantTemplate({ config, displayName }: ConsultantSitePreviewProps) {
  return (
    <div className="min-h-full" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", backgroundColor: '#faf9f6', color: '#2c2c2c' }}>
      {/* Elegant header */}
      <header className="py-6 px-8 border-b" style={{ borderColor: '#e8e2d6' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xl tracking-wider" style={{ color: config.accentColor, fontWeight: 700 }}>{displayName}</span>
          <span className="text-xs tracking-widest uppercase text-gray-400">Headhunter Consultant</span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-8 max-w-3xl mx-auto text-center">
        {config.avatar ? (
          <img src={config.avatar} alt={displayName} className="w-32 h-32 rounded-full mx-auto mb-8 object-cover border-4" style={{ borderColor: config.accentColor + '40' }} />
        ) : (
          <div className="w-32 h-32 rounded-full mx-auto mb-8 flex items-center justify-center text-3xl font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${config.accentColor}, ${config.accentColor}bb)` }}>
            {displayName.substring(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-4xl mb-4" style={{ color: config.primaryColor, fontWeight: 400, letterSpacing: '0.02em' }}>{config.heroTitle}</h1>
        {config.heroSubtitle && <p className="text-base text-gray-500 max-w-md mx-auto italic">{config.heroSubtitle}</p>}
        {config.yearsExperience > 0 && (
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2"><Briefcase size={14} style={{ color: config.accentColor }} /> {config.yearsExperience} 年經驗</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-2"><Award size={14} style={{ color: config.accentColor }} /> 專業顧問</span>
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="max-w-xs mx-auto flex items-center gap-4 py-4">
        <div className="flex-1 h-px" style={{ backgroundColor: config.accentColor + '30' }} />
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.accentColor + '40' }} />
        <div className="flex-1 h-px" style={{ backgroundColor: config.accentColor + '30' }} />
      </div>

      {/* Bio */}
      {config.bio && (
        <section className="py-12 px-8 max-w-2xl mx-auto">
          <p className="text-base text-gray-600 leading-loose text-center italic">{config.bio}</p>
        </section>
      )}

      {/* Specialties */}
      {config.specialties.length > 0 && (
        <section className="py-12 px-8 max-w-2xl mx-auto text-center">
          <h2 className="text-sm uppercase tracking-[0.2em] mb-8" style={{ color: config.accentColor }}>專長領域</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {config.specialties.map((s, i) => (
              <span key={i} className="px-5 py-2 text-sm border rounded-full" style={{ borderColor: config.accentColor + '40', color: '#666' }}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.testimonials.length > 0 && (
        <section className="py-12 px-8 max-w-2xl mx-auto">
          <h2 className="text-sm uppercase tracking-[0.2em] mb-8 text-center" style={{ color: config.accentColor }}>推薦與評價</h2>
          <div className="space-y-8">
            {config.testimonials.map((t, i) => (
              <div key={i} className="text-center">
                <p className="text-gray-600 italic leading-relaxed mb-3">「{t.content}」</p>
                <p className="text-sm">
                  <span className="font-bold text-gray-800">{t.name}</span>
                  {t.role && <span className="text-gray-400"> — {t.role}</span>}
                </p>
                {i < config.testimonials.length - 1 && (
                  <div className="mt-8 w-8 h-px mx-auto" style={{ backgroundColor: config.accentColor + '30' }} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact Footer */}
      <section className="py-12 px-8 mt-8" style={{ borderTop: `1px solid ${config.accentColor}20`, backgroundColor: '#f5f3ee' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-sm uppercase tracking-[0.2em] mb-6" style={{ color: config.accentColor }}>聯繫方式</h2>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            {config.socialLinks.email && <span className="flex items-center gap-2"><Mail size={13} /> {config.socialLinks.email}</span>}
            {config.socialLinks.phone && <span className="flex items-center gap-2"><Phone size={13} /> {config.socialLinks.phone}</span>}
            {config.socialLinks.linkedin && <span className="flex items-center gap-2"><Linkedin size={13} /> LinkedIn</span>}
            {config.socialLinks.line && <span className="flex items-center gap-2"><MessageCircle size={13} /> {config.socialLinks.line}</span>}
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-gray-300 italic">Powered by Step1ne</footer>
    </div>
  );
}

// ===================== Main Preview Component =====================

export default function ConsultantSitePreview({ config, displayName }: ConsultantSitePreviewProps) {
  const templates: Record<string, React.FC<ConsultantSitePreviewProps>> = {
    minimal: MinimalTemplate,
    professional: ProfessionalTemplate,
    creative: CreativeTemplate,
    modern: ModernTemplate,
    elegant: ElegantTemplate,
  };

  const Template = templates[config.template] || MinimalTemplate;
  return <Template config={config} displayName={displayName} />;
}
