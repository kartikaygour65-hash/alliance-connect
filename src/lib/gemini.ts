import { GoogleGenerativeAI } from "@google/generative-ai";
import { RateLimiter, isRateLimited } from "@/lib/security";

/**
 * ⚠️ SECURITY NOTE: This API key is exposed in the client bundle because
 * Vite injects all VITE_ prefixed env vars into the build.
 * 
 * MITIGATIONS:
 * 1. Set strict quotas on this key in Google Cloud Console (e.g., 100 req/day)
 * 2. Restrict the key to the Gemini API only (no other Google APIs)
 * 3. Set an HTTP referrer restriction to your domain
 * 4. For production: Move this to a Supabase Edge Function and proxy the call
 *
 * The key is PUBLISHABLE (like the Supabase anon key) — it should have
 * limited permissions and be rate-limited at the provider level.
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/** Rate limit: max 5 menu analyses per 10 minutes (uses security module) */
const menuAnalysisLimiter = new RateLimiter({ maxRequests: 5, windowMs: 10 * 60 * 1000 });

/** Max file size for menu image: 5MB */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// --- BACKUP DATA (Used if AI fails so your demo doesn't break) ---
const BACKUP_MENU = {
  breakfast: ["Masala Dosa", "Sambar", "Coconut Chutney", "Coffee/Tea"],
  lunch: ["Veg Biryani", "Raitha", "White Rice", "Dal Spinach", "Papad"],
  snacks: ["Onion Pakoda", "Tea/Coffee"],
  dinner: ["Chapathi", "Paneer Butter Masala", "White Rice", "Rasam", "Hot Milk"]
};

export async function analyzeMenuWithGemini(file: File) {
  // 1. Rate limit check (uses security module's RateLimiter)
  if (isRateLimited(menuAnalysisLimiter, 'menu_analysis', 'Menu analysis rate limited. Please try again later.')) {
    console.warn("⚠️ Menu analysis rate limited");
    return BACKUP_MENU;
  }

  // 2. File size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.warn("⚠️ File too large for menu analysis (max 5MB)");
    return BACKUP_MENU;
  }

  // 3. File type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    console.warn("⚠️ Invalid file type for menu analysis");
    return BACKUP_MENU;
  }

  // 4. Safety Check: If no key, return backup immediately
  if (!API_KEY || API_KEY === "undefined") {
    console.warn("⚠️ Using Backup Menu (VITE_GEMINI_API_KEY is missing in .env)");
    return BACKUP_MENU;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  try {
    const imagePart = await fileToGenerativePart(file);

    // Get Today's Day Name
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];

    const prompt = `
      You are an expert OCR and Data Analyst. 
      The attached image is a College Mess Menu table/grid.
      
      TODAY IS: ${todayName.toUpperCase()}.

      TASK:
      1. Carefully scan the table for the column or row representing "${todayName}" (it might be abbreviated like "MON", "TUE", etc.).
      2. Identify the meal categories: Breakfast, Lunch, Snacks (or High Tea), and Dinner.
      3. Extract the specific food items for ONLY ${todayName}.
      4. If a meal category is merged with another day or formatted strangely, do your best to isolate only the items for ${todayName}.

      Strict JSON output only:
      {
        "breakfast": ["item"],
        "lunch": ["item"],
        "snacks": ["item"],
        "dinner": ["item"]
      }
    `;

    console.log(`🤖 Contacting Gemini AI for ${todayName}'s menu...`);

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up potential AI chatter or markdown blocks
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedText);

    console.log("✅ AI SUCCESS:", parsedData);
    return parsedData;

  } catch (error: any) {
    console.error("❌ AI FAILED (Using Backup Menu):", error.message);
    // Return backup data instead of crashing the app
    return BACKUP_MENU;
  }
}

/**
 * Converts a File object to a format Gemini can understand
 */
async function fileToGenerativePart(file: File) {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64String = result.split(',')[1];
      if (!base64String) {
        reject(new Error("Failed to process image file"));
        return;
      }
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}