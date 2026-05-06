import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Language } from '../i18n'

interface OnboardingProps {
  onComplete: (lang: Language, theme: 'light' | 'dark') => void
}


export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [lang, setLang] = useState<Language>('en')

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300">
      {/* Setup Modal */}
      <div className="w-[460px] bg-bg-surface border border-border-subtle rounded-sm shadow-2xl flex flex-col animate-modal-enter theme-transition">
        
        <div className="px-6 py-4 border-b border-border-subtle bg-bg-primary flex items-center gap-3 theme-transition">
          <ShieldCheck size={20} className="text-accent-blue" />
          <h1 className="text-sm font-semibold text-text-primary">Wirebound Setup</h1>
        </div>

        <div className="p-6">
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Welcome to Wirebound. Please select your preferred display language to initialize the workspace.
          </p>

          <div className="space-y-1.5 border border-border-subtle bg-bg-primary p-2 rounded-sm theme-transition">
            <label className={`group flex items-center gap-3 p-2.5 rounded-sm cursor-pointer transition-all duration-200 active:scale-[0.99] ${lang === 'en' ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' : 'hover:bg-bg-hover text-text-secondary border border-transparent'}`}>
              <input type="radio" name="lang" checked={lang === 'en'} onChange={() => setLang('en')} className="hidden" />
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${lang === 'en' ? 'border-accent-blue' : 'border-border-subtle group-hover:border-accent-blue'}`}>
                {lang === 'en' && <div className="w-1.5 h-1.5 bg-accent-blue rounded-full"></div>}
              </div>
              <span className="text-sm font-medium">English (US)</span>
            </label>
            <label className={`group flex items-center gap-3 p-2.5 rounded-sm cursor-pointer transition-all duration-200 active:scale-[0.99] ${lang === 'id' ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' : 'hover:bg-bg-hover text-text-secondary border border-transparent'}`}>
              <input type="radio" name="lang" checked={lang === 'id'} onChange={() => setLang('id')} className="hidden" />
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${lang === 'id' ? 'border-accent-blue' : 'border-border-subtle group-hover:border-accent-blue'}`}>
                {lang === 'id' && <div className="w-1.5 h-1.5 bg-accent-blue rounded-full"></div>}
              </div>
              <span className="text-sm font-medium">Bahasa Indonesia</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-subtle bg-bg-primary flex justify-end theme-transition">
          <button 
            onClick={() => onComplete(lang, 'dark')}
            className="bg-accent-blue hover:opacity-90 text-white px-6 py-1.5 text-sm font-medium rounded-sm transition-all duration-200 active:scale-[0.96] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e]"
          >
            Finish Setup
          </button>
        </div>


      </div>
    </div>
  )
}

