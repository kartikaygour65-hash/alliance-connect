import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";

export function ConversationList({ onSelectConversation, selectedId }: any) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchConversations();
            const cleanup = setupRealtime();
            return cleanup;
        }
    }, [user]);

    const fetchConversations = async () => {
        const { data: convos } = await supabase
            .from("conversations")
            .select("*")
            .or(`participant_1.eq.${user?.id},participant_2.eq.${user?.id}`);

        if (!convos || convos.length === 0) return setLoading(false);

        const otherUserIds = convos.map(c => c.participant_1 === user?.id ? c.participant_2 : c.participant_1);
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, full_name, avatar_url, show_activity").in("user_id", otherUserIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // FIXED: Fetch the absolute truth straight from the direct_messages table!
        const convoIds = convos.map(c => c.id);
        const { data: messagesData } = await supabase
            .from('direct_messages')
            .select('*')
            .in('conversation_id', convoIds)
            .order('created_at', { ascending: false });

        const unreadCounts: Record<string, number> = {};
        const latestMessages: Record<string, any> = {};

        messagesData?.forEach((msg: any) => {
            if (!msg.is_read && msg.sender_id !== user?.id) {
                unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] || 0) + 1;
            }

            // Always grab the exact real-time from the newest message
            if (!latestMessages[msg.conversation_id]) {
                latestMessages[msg.conversation_id] = {
                    last_message_at: msg.created_at,
                    last_message: msg.message_type === 'text' ? msg.content : "Sent a message"
                };
            }
        });

        const mappedConvos = convos.map(c => ({
            ...c,
            other_user: profileMap.get(c.participant_1 === user?.id ? c.participant_2 : c.participant_1) || { full_name: 'AU User', username: 'user' },
            unread_count: unreadCounts[c.id] || 0,
            // Force UI to use direct_messages time, ignoring conversation table lag
            last_message_at: latestMessages[c.id]?.last_message_at || c.last_message_at,
            last_message: latestMessages[c.id]?.last_message || c.last_message
        })).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());

        setConversations(mappedConvos);
        setLoading(false);
    };

    const setupRealtime = () => {
        const channel = supabase.channel('conversation-list-update')
            // FIXED: Listen directly to direct_messages, matching ChatView logic
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
                const newMsg = payload.new;

                setConversations(prev => {
                    const updated = prev.map(c => {
                        if (c.id === newMsg.conversation_id) {
                            return {
                                ...c,
                                last_message_at: newMsg.created_at, // Postgres absolute time
                                last_message: newMsg.message_type === 'text' ? newMsg.content : "Sent a message",
                                unread_count: newMsg.sender_id !== user?.id ? c.unread_count + 1 : c.unread_count
                            };
                        }
                        return c;
                    });
                    return updated.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => fetchConversations())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, () => fetchConversations())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

    return (
        <div className="h-full overflow-y-auto flex-1 custom-scrollbar bg-background">
            {conversations.length === 0 ? (
                <div className="text-center p-8 opacity-50 text-xs font-black uppercase tracking-widest italic">No Transmissions</div>
            ) : (
                conversations.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => onSelectConversation(c)}
                        className={`w-full p-4 flex gap-3 hover:bg-white/5 border-b border-white/5 transition-all relative ${selectedId === c.id ? 'bg-white/5' : ''}`}
                    >
                        <div className="relative">
                            <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                                <AvatarImage src={c.other_user.avatar_url} />
                                <AvatarFallback className="theme-bg font-bold">{getInitials(c.other_user.full_name)}</AvatarFallback>
                            </Avatar>
                            {c.other_user.show_activity && (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                            )}
                        </div>

                        <div className="text-left flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                                <p className={`text-sm truncate uppercase tracking-tight ${c.unread_count > 0 ? 'font-black text-white' : 'font-bold text-zinc-400'}`}>
                                    {c.other_user.full_name}
                                </p>
                                {c.last_message_at && (
                                    <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">
                                        {format(new Date(c.last_message_at), "h:mm a")}
                                    </span>
                                )}
                            </div>

                            <div className="flex justify-between items-center">
                                <p className={`text-xs truncate max-w-[85%] ${c.unread_count > 0 ? 'text-white font-bold' : 'text-zinc-500 font-medium'}`}>
                                    {c.last_message || "Sent a message"}
                                </p>

                                {c.unread_count > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="h-5 w-5 flex items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full border border-black shadow-lg"
                                    >
                                        {c.unread_count}
                                    </motion.span>
                                )}
                            </div>
                        </div>

                        {selectedId === c.id && (
                            <motion.div layoutId="activeConvo" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                        )}
                    </button>
                ))
            )}
        </div>
    );
}