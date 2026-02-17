import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string | null) {
  if (!name) return "AU";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const FORBIDDEN_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt",
  "nigga", "nigger", "faggot", "slut", "whore"
];

export function censorText(text: string): string {
  let censored = text;
  FORBIDDEN_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censored = censored.replace(regex, "****");
  });
  return censored;
}