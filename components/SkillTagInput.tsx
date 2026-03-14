// SkillTagInput — taxonomy-aware tag input for normalized skills
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiGet } from '../config/api';

interface SkillTagInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Cached taxonomy data (shared across instances)
let _taxonomyCache: Record<string, string[]> | null = null;
let _taxonomyLoading = false;
let _taxonomyListeners: Array<() => void> = [];

function loadTaxonomy() {
  if (_taxonomyCache || _taxonomyLoading) return;
  _taxonomyLoading = true;
  apiGet<Record<string, string[]>>('/api/taxonomy/skills')
    .then(data => {
      // Remove _meta key if present
      const { _meta, ...skills } = data as any;
      _taxonomyCache = skills;
    })
    .catch(() => {
      // Fallback: empty taxonomy, user can still type freely
      _taxonomyCache = {};
    })
    .finally(() => {
      _taxonomyLoading = false;
      _taxonomyListeners.forEach(fn => fn());
      _taxonomyListeners = [];
    });
}

function useTaxonomy(): Record<string, string[]> | null {
  const [tax, setTax] = useState(_taxonomyCache);
  useEffect(() => {
    if (_taxonomyCache) { setTax(_taxonomyCache); return; }
    loadTaxonomy();
    const cb = () => setTax(_taxonomyCache);
    _taxonomyListeners.push(cb);
    return () => { _taxonomyListeners = _taxonomyListeners.filter(f => f !== cb); };
  }, []);
  return tax;
}

export function SkillTagInput({ value, onChange, placeholder = 'e.g. React, Python...', disabled }: SkillTagInputProps) {
  const taxonomy = useTaxonomy();
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // All canonical skill names
  const canonicalSkills = taxonomy ? Object.keys(taxonomy) : [];

  // Filter suggestions based on input
  const updateSuggestions = useCallback((text: string) => {
    if (!text.trim() || !taxonomy) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lower = text.toLowerCase().trim();
    const existing = new Set(value.map(v => v.toLowerCase()));

    // Match against canonical names and their aliases
    const matches: Array<{ canonical: string; score: number }> = [];
    for (const [canonical, aliases] of Object.entries(taxonomy)) {
      if (existing.has(canonical.toLowerCase())) continue;
      const cLower = canonical.toLowerCase();
      // Exact prefix match on canonical = highest score
      if (cLower.startsWith(lower)) {
        matches.push({ canonical, score: 100 - cLower.length });
      } else if (cLower.includes(lower)) {
        matches.push({ canonical, score: 50 - cLower.length });
      } else if (aliases.some(a => a.includes(lower))) {
        matches.push({ canonical, score: 30 });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    setSuggestions(matches.slice(0, 8).map(m => m.canonical));
    setSelectedIdx(-1);
    setShowSuggestions(matches.length > 0);
  }, [taxonomy, value]);

  const addSkill = useCallback((skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    // Normalize: check if it matches any canonical skill
    let canonical = trimmed;
    if (taxonomy) {
      for (const [name, aliases] of Object.entries(taxonomy)) {
        if (name.toLowerCase() === trimmed.toLowerCase() ||
            aliases.some(a => a === trimmed.toLowerCase())) {
          canonical = name;
          break;
        }
      }
    }
    if (!value.some(v => v.toLowerCase() === canonical.toLowerCase())) {
      onChange([...value, canonical]);
    }
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [taxonomy, value, onChange]);

  const removeSkill = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        addSkill(suggestions[selectedIdx]);
      } else if (input.trim()) {
        addSkill(input);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeSkill(value.length - 1);
    } else if (e.key === ',' || e.key === '、') {
      e.preventDefault();
      if (input.trim()) addSkill(input);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1 p-1.5 border rounded min-h-[38px] bg-white cursor-text ${
          disabled ? 'bg-gray-100 opacity-60' : 'border-gray-300 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500'
        }`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((skill, idx) => (
          <span
            key={skill}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
          >
            {skill}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeSkill(idx); }}
                className="ml-0.5 hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); updateSuggestions(e.target.value); }}
          onFocus={() => input.trim() && updateSuggestions(input)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[100px] outline-none text-sm bg-transparent px-1 py-0.5"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <button
              key={s}
              type="button"
              onClick={() => addSkill(s)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                idx === selectedIdx ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
