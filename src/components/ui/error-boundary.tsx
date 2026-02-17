
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-red-500/10 p-6 rounded-full mb-6 animate-pulse">
                        <AlertTriangle className="h-16 w-16 text-red-500" />
                    </div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                        System Malfunction
                    </h1>
                    <p className="text-white/60 max-w-md mb-8 font-medium">
                        A critical error has occurred in the Alliance network. Our engineers have been notified.
                        <br />
                        <span className="text-xs opacity-40 mt-2 block font-mono">{this.state.error?.message}</span>
                    </p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="h-12 px-8 rounded-xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/90"
                    >
                        Reboot System
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
