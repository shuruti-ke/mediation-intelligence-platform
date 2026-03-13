import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  return (
    <select
      value={i18n.language?.split('-')[0] || 'en'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="language-selector"
      title="Language"
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}
