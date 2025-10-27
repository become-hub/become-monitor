import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCE_KEY = 'theme_preference';

export function useThemePreference() {
    const deviceColorScheme = useDeviceColorScheme();
    const [themePreference, setThemePreference] = useState<ThemePreference>('system');
    const [isLoading, setIsLoading] = useState(true);

    // Carica la preferenza salvata all'avvio
    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const savedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
                if (savedPreference && ['light', 'dark', 'system'].includes(savedPreference)) {
                    setThemePreference(savedPreference as ThemePreference);
                }
            } catch (error) {
                console.error('Errore nel caricamento della preferenza tema:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadThemePreference();
    }, []);

    // Salva la preferenza quando cambia
    const updateThemePreference = async (preference: ThemePreference) => {
        try {
            await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
            setThemePreference(preference);
        } catch (error) {
            console.error('Errore nel salvataggio della preferenza tema:', error);
        }
    };

    // Determina il tema effettivo basato sulla preferenza
    const getEffectiveTheme = (): 'light' | 'dark' => {
        if (themePreference === 'system') {
            return deviceColorScheme ?? 'light';
        }
        return themePreference;
    };

    return {
        themePreference,
        effectiveTheme: getEffectiveTheme(),
        isLoading,
        updateThemePreference,
    };
}
