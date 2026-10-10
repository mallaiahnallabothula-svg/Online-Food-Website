import { useLanguage } from './LanguageContext';
import { translateUi } from '../utils/uiCopy';
export function useUiText() {
  const { language } = useLanguage();
  return (text: string) => translateUi(text, language);
}
