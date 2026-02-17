import { motion } from "framer-motion";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPassword() {
    return (
        <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-4 bg-black overflow-x-hidden overflow-y-auto py-12">
            {/* FESTIVAL BACKGROUND */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-yellow-500/10 rounded-full blur-[80px]" />
                <div className="absolute top-[10%] right-[20%] w-[200px] h-[200px] bg-green-500/10 rounded-full blur-[60px]" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            </div>

            <div className="relative z-10 w-full max-w-md mx-auto min-h-full flex items-center justify-center">
                <ResetPasswordForm />
            </div>
        </div>
    );
}
