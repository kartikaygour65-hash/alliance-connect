import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const SettingsContext = createContext<any>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    story_replies: true,
  });

  useEffect(() => {
    if (user) {
      supabase.from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            // Map SQL columns to state
            setSettings({
              likes: data.likes,
              comments: data.comments,
              follows: data.follows,
              messages: data.messages,
              story_replies: data.story_replies,
            });
          }
        });
    }
  }, [user]);

  const updateSetting = async (key: string, value: any) => {
    if (!user) return;
    
    // Optimistic UI Update
    setSettings(prev => ({ ...prev, [key]: value }));

    const { error } = await supabase
      .from("notification_settings")
      .upsert({ 
        user_id: user.id, 
        [key]: value,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'user_id' });

    if (error) {
      toast.error("Sync failed");
      setSettings(prev => ({ ...prev, [key]: !value })); // Rollback
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);