import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import type { Language } from '@shared/api.interface';
import { translations, type Translations } from '@/i18n/translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LANGUAGE_KEY = 'flow_language';

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // 已保存优先；否则跟随浏览器语言（其余回退英文）
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null;
    if (saved === 'zh' || saved === 'en' || saved === 'es' || saved === 'pt') return saved;
    if (typeof navigator !== 'undefined') {
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith('zh')) return 'zh';
      if (nav.startsWith('es')) return 'es';
      if (nav.startsWith('pt')) return 'pt';
    }
    return 'en';
  });

  // 同步 <html lang>，供屏幕阅读器与浏览器翻译使用
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const t: Translations = useMemo(
    () => translations[language],
    [language],
  );

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const context: LanguageContextValue | undefined =
    useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
