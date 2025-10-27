import { Language, getCurrentLanguage, getStrings } from '@/constants/locale';
import { useEffect, useState } from 'react';

export const useLocale = () => {
    const [language, setLanguage] = useState<Language>(getCurrentLanguage());
    const [strings] = useState(() => getStrings(language));

    // For now, language is hardcoded to Italian
    // In the future, this could be stored in AsyncStorage or a context
    useEffect(() => {
        // This is where we would load the saved language preference
        // For now, we keep it hardcoded to Italian
    }, []);

    const changeLanguage = (newLanguage: Language) => {
        setLanguage(newLanguage);
        // In the future, this would save to AsyncStorage
        // AsyncStorage.setItem('selectedLanguage', newLanguage);
    };

    return {
        language,
        strings,
        changeLanguage,
    };
};
