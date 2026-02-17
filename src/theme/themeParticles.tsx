import { useEffect, useState } from "react";
import { getCurrentTheme } from "./theme";

export default function ThemeParticles() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    setTheme(getCurrentTheme());
  }, []);

  if (theme === "valentine") {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-pink-400 animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              fontSize: `${12 + Math.random() * 20}px`,
            }}
          >
            ❤️
          </span>
        ))}
      </div>
    );
  }

  if (theme === "exam") {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20 text-4xl">
        📚 ✏️ 📝
      </div>
    );
  }

  return null;
}
