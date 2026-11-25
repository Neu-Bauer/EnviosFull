import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'ocean' | 'midnight' | 'coffee';
type Radius = 'sharp' | 'modern' | 'soft';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  radius: Radius;
  setRadius: (r: Radius) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  
  const location = useLocation();
  
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('wms_theme') as Theme) || 'ocean');
  const [radius, setRadius] = useState<Radius>(() => (localStorage.getItem('wms_radius') as Radius) || 'modern');

  
  useEffect(() => {
    localStorage.setItem('wms_theme', theme);
    
    
    
    
    if (location.pathname === '/login') {
      document.documentElement.setAttribute('data-theme', 'ocean');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    
  }, [theme, location.pathname]); 

  useEffect(() => {
    localStorage.setItem('wms_radius', radius);
    document.documentElement.setAttribute('data-radius', radius);
  }, [radius]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, radius, setRadius }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro do ThemeProvider");
  return context;
};