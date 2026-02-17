import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyEmail() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    return (
        <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-4 bg-black overflow-x-hidden overflow-y-auto py-12">
            {/* FESTIVAL BACKGROUND */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-md mx-auto min-h-full flex items-center justify-center"
            >
                <div className="glass-card p-8 rounded-2xl text-center">
                    {loading ? (
                        <div className="py-8">
                            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
                            <p className="text-muted-foreground">Verifying your account...</p>
                        </div>
                    ) : user ? (
                        <>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                                className="w-20 h-20 rounded-full bg-green-500/20 mx-auto mb-6 flex items-center justify-center"
                            >
                                <CheckCircle className="h-10 w-10 text-green-500" />
                            </motion.div>

                            <h1 className="text-3xl font-black italic tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                                VERIFIED!
                            </h1>

                            <p className="text-muted-foreground text-lg mb-8">
                                Your email has been successfully verified. Welcome to the Alliance One community!
                            </p>

                            <Button
                                onClick={() => navigate("/onboarding")}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:opacity-90 transition-all font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 group"
                            >
                                Enter AUConnect
                                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 rounded-full bg-red-500/20 mx-auto mb-6 flex items-center justify-center">
                                <XCircle className="h-10 w-10 text-red-500" />
                            </div>

                            <h1 className="text-3xl font-black italic tracking-tighter mb-4 text-red-500 uppercase">
                                Verification Failed
                            </h1>

                            <p className="text-muted-foreground mb-8">
                                We couldn't verify your email. The link might be expired or already used.
                            </p>

                            <Button
                                onClick={() => navigate("/auth")}
                                variant="outline"
                                className="w-full h-12 rounded-xl font-bold uppercase tracking-widest border-white/10 hover:bg-white/5"
                            >
                                Back to Sign In
                            </Button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
