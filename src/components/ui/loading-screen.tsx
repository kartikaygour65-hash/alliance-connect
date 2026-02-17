
import { Loader2 } from "lucide-react";

export function LoadingScreen() {
    return (
        <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center gap-4 fixed inset-0 z-50">
            <div className="relative">
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse" />
                <Loader2 className="h-10 w-10 text-white animate-spin relative z-10" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Initializing System</span>
        </div>
    );
}
