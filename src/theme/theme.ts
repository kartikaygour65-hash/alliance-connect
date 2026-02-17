export type AppTheme =
  | "default"
  | "valentine"
  | "exam"
  | "diwali"
  | "christmas";

export function getCurrentTheme(): AppTheme {
  const today = new Date();

  const month = today.getMonth() + 1; // convert to 1–12
  const day = today.getDate();

// ❤️ Valentine
if (month === 2 && day >= 10 && day <= 20) return "valentine";

// 🪔 Diwali
if (month === 10 || month === 11) return "diwali";

// 📚 Exam
if (month === 5 || month === 11) return "exam";

// 🎄 Christmas
if (month === 12 && day >= 20) return "christmas";

  return "default";
}
