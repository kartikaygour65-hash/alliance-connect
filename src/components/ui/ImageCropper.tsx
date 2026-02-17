import { useState, useCallback } from "react";
import Cropper, { Point, Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
    image: string;
    aspect?: number; // Optional aspect ratio for free cropping
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
    open: boolean;
    title?: string;
}

export function ImageCropper({ image, aspect, onCropComplete, onCancel, open, title }: ImageCropperProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: Point) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener("load", () => resolve(image));
            image.addEventListener("error", (error) => reject(error));
            image.setAttribute("crossOrigin", "anonymous");
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: Area,
    ): Promise<Blob | null> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) return null;

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, "image/jpeg");
        });
    };

    const handleCropSave = async () => {
        if (croppedAreaPixels) {
            const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
            if (croppedBlob) {
                onCropComplete(croppedBlob);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
            <DialogContent className="sm:max-w-xl glass-card border-white/10 dark:bg-black/95">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter gradient-text">
                        {title || "Refine Signal Frame"}
                    </DialogTitle>
                </DialogHeader>
                <div className="relative h-80 w-full mt-4 bg-black rounded-xl overflow-hidden">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteInternal}
                        cropShape="rect"
                        showGrid={true}
                    />
                </div>
                <div className="py-4 space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Zoom</span>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(val) => setZoom(val[0])}
                            className="flex-1"
                        />
                    </div>
                </div>
                <DialogFooter className="flex gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onCancel} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">
                        Discard
                    </Button>
                    <Button onClick={handleCropSave} className="rounded-xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/90">
                        Apply Signal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
