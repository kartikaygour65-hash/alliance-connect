import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatView } from "@/components/messages/ChatView";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const chatId = searchParams.get('chat');
    if (chatId && user) {
      loadConversationById(chatId);
    }
  }, [searchParams, user]);

  const loadConversationById = async (chatParam: string) => {
    if (!user) return;

    // First, try loading as a conversation ID
    const { data: convo } = await supabase.from('conversations').select('*').eq('id', chatParam).single();

    if (convo) {
      // It's a valid conversation ID — load it directly
      const otherUserId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;
      const { data: profile } = await supabase.from('profiles').select('user_id, username, full_name, avatar_url').eq('user_id', otherUserId).single();

      setSelectedConversation({
        ...convo,
        unread_count: 0,
        other_user: profile || { user_id: otherUserId, username: 'user', full_name: 'AU User' },
      });
      return;
    }

    // Not a conversation ID — treat it as a user ID and find/create conversation
    const targetUserId = chatParam;
    if (targetUserId === user.id) return; // Can't DM yourself

    // Look for an existing conversation between the two users
    const { data: allConvos } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

    const existing = allConvos?.find(c =>
      (c.participant_1 === user.id && c.participant_2 === targetUserId) ||
      (c.participant_1 === targetUserId && c.participant_2 === user.id)
    );

    let conversationToOpen = existing;

    if (!conversationToOpen) {
      // Create a new conversation
      const { data: newConvo, error } = await supabase
        .from('conversations')
        .insert({
          participant_1: user.id,
          participant_2: targetUserId,
          last_message: '',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !newConvo) {
        console.error('Failed to create conversation:', error);
        return;
      }
      conversationToOpen = newConvo;
    }

    // Load the other user's profile
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .eq('user_id', targetUserId)
      .single();

    setSelectedConversation({
      ...conversationToOpen,
      unread_count: 0,
      other_user: otherProfile || { user_id: targetUserId, username: 'user', full_name: 'AU User' },
    });
  };

  const handleSelectConversation = (conversation: any) => {
    setSelectedConversation({ ...conversation, unread_count: 0 });
    setRefreshKey(prev => prev + 1);
  };

  return (
    <AppLayout disableScroll>
      <div className="w-full h-full flex overflow-hidden theme-bg backdrop-blur-3xl">

        {(!isMobile || !selectedConversation) && (
          <div className={`${isMobile ? 'w-full' : 'w-96'} border-r border-white/5 flex flex-col bg-background h-full`}>
            <ConversationList key={refreshKey} onSelectConversation={handleSelectConversation} selectedId={selectedConversation?.id} />
          </div>
        )}

        {selectedConversation && (
          <div className="flex-1 bg-background relative h-full">
            <ChatView
              conversationId={selectedConversation.id}
              otherUser={selectedConversation.other_user}
              onBack={() => setSelectedConversation(null)}
              onMessageRead={() => setRefreshKey(prev => prev + 1)}
            />
          </div>
        )}

      </div>
    </AppLayout>
  );
}