import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    RotateCcw,
    Zap,
    ZapOff,
    Image as ImageIcon,
    X,
    Circle,
    Maximize2,
    Mic,
    MicOff,
    Settings,
    MoreVertical,
    Minus,
    Plus,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProfessionalCameraProps {
    onCapture: (file: File) => void;
    onClose: () => void;
    aspectRatio?: "16:9" | "4:3" | "1:1" | "portrait" | "landscape";
    mode?: "photo" | "video"; // For future expansion
}

export function ProfessionalCamera({ onCapture, onClose, aspectRatio = "portrait" }: ProfessionalCameraProps) {
    const [isReady, setIsReady] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(1);
    const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("off");
    const [exposure, setExposure] = useState(0);
    const [showFocusRing, setShowFocusRing] = useState(false);
    const [focusPoint, setFocusPoint] = useState({ x: 0, y: 0 });
    const [isCapturing, setIsCapturing] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [activeCapabilities, setActiveCapabilities] = useState<MediaTrackCapabilities | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- CAMERA INITIALIZATION ---
    const startCamera = useCallback(async () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: aspectRatio === "16:9" ? 1.7777777778 : (aspectRatio === "4:3" ? 1.3333333333 : (aspectRatio === "1:1" ? 1 : undefined))
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setIsReady(true);
                    const track = stream.getVideoTracks()[0];
                    const caps = track.getCapabilities() as any;
                    setActiveCapabilities(caps);

                    // Check for Zoom capability
                    if (caps.zoom) {
                        setMinZoom(caps.zoom.min || 1);
                        setMaxZoom(caps.zoom.max || 1);
                        setZoom(caps.zoom.min || 1);
                    }

                    // Check for Torch (Flash) capability
                    if (caps.torch) {
                        setHasTorch(true);
                    }
                };
            }
        } catch (error) {
            console.error("Camera startup error:", error);
            toast.error("Failed to access camera. Please check permissions.");
        }
    }, [facingMode, aspectRatio]);

    useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [startCamera]);

    // --- GESTURE: PINCH TO ZOOM ---
    const lastTouchDistance = useRef<number | null>(null);

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);

            if (lastTouchDistance.current !== null) {
                const delta = dist - lastTouchDistance.current;
                const zoomStep = (maxZoom - minZoom) / 100;
                const newZoom = Math.min(Math.max(zoom + delta * zoomStep, minZoom), maxZoom);
                updateZoom(newZoom);
            }
            lastTouchDistance.current = dist;
        } else if (e.touches.length === 1 && showFocusRing) {
            // Drag up/down to adjust exposure when focus ring is active
            const touch = e.touches[0];
            if (lastTouchY.current !== null) {
                const deltaY = lastTouchY.current - touch.pageY;
                const exposureStep = 0.05;
                const newExposure = Math.min(Math.max(exposure + deltaY * exposureStep, -2), 2);
                updateExposure(newExposure);
            }
            lastTouchY.current = touch.pageY;
        }
    };

    const lastTouchY = useRef<number | null>(null);

    const handleTouchEnd = () => {
        lastTouchDistance.current = null;
        lastTouchY.current = null;
    };

    const updateZoom = async (value: number) => {
        setZoom(value);
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && (activeCapabilities as any)?.zoom) {
            try {
                await track.applyConstraints({ advanced: [{ zoom: value }] } as any);
            } catch (e) {
                console.warn("Hardware zoom error:", e);
            }
        }
    };

    const updateExposure = async (value: number) => {
        setExposure(value);
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && (activeCapabilities as any)?.exposureCompensation) {
            try {
                await track.applyConstraints({ advanced: [{ exposureCompensation: value }] } as any);
            } catch (e) {
                console.warn("Exposure error:", e);
            }
        }
    };

    // --- TAP TO FOCUS & EXPOSURE ---
    const handleTapToFocus = async (e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current || !videoRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = "clientX" in e ? (e as React.MouseEvent).clientX : (e as React.TouchEvent).touches[0].clientX;
        const y = "clientY" in e ? (e as React.MouseEvent).clientY : (e as React.TouchEvent).touches[0].clientY;

        const focusX = x - rect.left;
        const focusY = y - rect.top;

        setFocusPoint({ x: focusX, y: focusY });
        setShowFocusRing(true);
        setTimeout(() => setShowFocusRing(false), 2000);

        const track = streamRef.current?.getVideoTracks()[0];
        if (track && (activeCapabilities as any)?.focusMode) {
            try {
                // Simple mock of focus point as many web browsers don't support focusPoint yet
                // However, we can re-trigger autofocus
                await track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }]
                } as any);
            } catch (e) {
                console.warn("Focus constraint error:", e);
            }
        }
    };

    // --- FLASH TOGGLE ---
    const toggleFlash = async () => {
        const modes: ("off" | "on" | "auto")[] = ["off", "on", "auto"];
        const nextIndex = (modes.indexOf(flashMode) + 1) % modes.length;
        const nextMode = modes[nextIndex];
        setFlashMode(nextMode);

        if (hasTorch) {
            const track = streamRef.current?.getVideoTracks()[0];
            if (track) {
                try {
                    await track.applyConstraints({
                        advanced: [{ torch: nextMode === "on" }]
                    } as any);
                } catch (e) {
                    console.warn("Torch error:", e);
                }
            }
        }
    };

    // --- CAPTURE PHOTO ---
    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current || isCapturing) return;

        setIsCapturing(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Use high quality resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Handle flips for front camera
            if (facingMode === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                    onCapture(file);
                }
                setIsCapturing(false);
            }, 'image/jpeg', 1.0); // Perfect quality
        }
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center overflow-hidden touch-none"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleTapToFocus}
        >
            {/* PREVIEW CONTAINER */}
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                        "max-w-full max-h-full object-contain pointer-events-none transition-transform duration-300",
                        facingMode === 'user' && "scale-x-[-1]"
                    )}
                />

                {/* FOCUS RING ANIMATION */}
                <AnimatePresence>
                    {showFocusRing && (
                        <motion.div
                            initial={{ scale: 1.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute pointer-events-none border-2 border-yellow-400 w-16 h-16 rounded-full flex flex-col items-center"
                            style={{ left: focusPoint.x - 32, top: focusPoint.y - 32 }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-1 h-1 bg-yellow-400 rounded-full" />
                            </div>
                            {/* Exposure Slider indicator next to focus ring */}
                            <div className="absolute left-[70px] h-20 w-1 bg-white/20 rounded-full flex flex-col justify-end overflow-hidden">
                                <div
                                    className="w-full bg-yellow-400 transition-all duration-200"
                                    style={{ height: `${((exposure + 2) / 4) * 100}%` }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* TOP CONTROLS */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 rounded-full"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                    >
                        <X className="h-7 w-7" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 rounded-full"
                        onClick={(e) => { e.stopPropagation(); toggleFlash(); }}
                    >
                        {flashMode === 'off' ? <ZapOff className="h-6 w-6" /> : <Zap className={cn("h-6 w-6", flashMode === 'on' ? "fill-yellow-400 text-yellow-400" : "text-white")} />}
                    </Button>
                </div>

                {/* SIDE ZOOM SLIDER (Native feel) */}
                {maxZoom > minZoom && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 bg-black/40 backdrop-blur-md px-2 py-4 rounded-full border border-white/10 z-10">
                        <button className="text-white/80" onClick={(e) => { e.stopPropagation(); updateZoom(Math.min(zoom + 0.5, maxZoom)); }}><Plus className="h-5 w-5" /></button>
                        <div className="h-32 w-1 bg-white/20 relative rounded-full overflow-hidden">
                            <div
                                className="absolute bottom-0 w-full bg-white transition-all duration-200"
                                style={{ height: `${((zoom - minZoom) / (maxZoom - minZoom)) * 100}%` }}
                            />
                        </div>
                        <button className="text-white/80" onClick={(e) => { e.stopPropagation(); updateZoom(Math.max(zoom - 0.5, minZoom)); }}><Minus className="h-5 w-5" /></button>
                        <span className="text-[10px] font-black text-white">{zoom.toFixed(1)}x</span>
                    </div>
                )}

                {/* SHOOTING UI */}
                <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex items-center justify-around bg-gradient-to-t from-black/60 to-transparent z-10">
                    {/* GALLERY PREVIEW THUMBNAIL (Placeholder) */}
                    <div className="w-12 h-12 rounded-xl border-2 border-white/20 bg-black/40 flex items-center justify-center overflow-hidden">
                        <ImageIcon className="h-6 w-6 text-white/40" />
                    </div>

                    {/* MAIN CAPTURE BUTTON */}
                    <button
                        disabled={!isReady || isCapturing}
                        onClick={(e) => { e.stopPropagation(); handleCapture(); }}
                        className="group relative flex items-center justify-center"
                    >
                        <div className="w-20 h-20 rounded-full border-[6px] border-white active:scale-95 transition-transform" />
                        <div className="absolute w-16 h-16 rounded-full bg-white group-active:scale-90 transition-transform" />
                        {isCapturing && <RefreshCw className="absolute h-8 w-8 text-black animate-spin" />}
                    </button>

                    {/* REVERSE CAMERA */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 rounded-full w-12 h-12 p-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
                            setIsReady(false);
                        }}
                    >
                        <RefreshCw className="h-7 w-7" />
                    </Button>
                </div>

                {/* HIDDEN CANVAS FOR CAPTURE */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
}
