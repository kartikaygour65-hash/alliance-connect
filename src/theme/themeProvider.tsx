import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getCurrentTheme, AppTheme } from "./theme";

type ThemeContextType = {
  theme: AppTheme;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "default",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>("default");

  useEffect(() => {
    const current = getCurrentTheme();
    setTheme(current);

    // add theme class to body
    document.body.setAttribute("data-theme", current);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
