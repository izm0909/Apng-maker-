"use client";

import { useState, useCallback } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";

interface ImageUploaderProps {
    onImageSelected: (file: File) => void;
    isProcessing: boolean;
}

export default function ImageUploader({ onImageSelected, isProcessing }: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            if (isProcessing) return;

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                onImageSelected(file);
            }
        },
        [onImageSelected, isProcessing]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                onImageSelected(file);
            }
        },
        [onImageSelected]
    );

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
        w-full max-w-xl aspect-video rounded-xl border-2 border-dashed transition-all duration-300
        flex flex-col items-center justify-center gap-4 cursor-pointer relative overflow-hidden
        ${isDragging
                    ? "border-primary bg-[rgba(59,130,246,0.1)] scale-[1.02]"
                    : "border-gray-700 bg-[rgba(30,41,59,0.5)] hover:border-gray-500"
                }
        ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
      `}
        >
            <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />

            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 ${isDragging ? "scale-110 bg-primary" : "bg-gray-800"}`}>
                {isDragging ? (
                    <ImageIcon size={32} className="text-white" />
                ) : (
                    <Upload size={32} className="text-gray-400 group-hover:text-primary" />
                )}
            </div>

            <div className="space-y-1 text-center pointer-events-none">
                <p className="font-medium text-lg text-white">
                    {isDragging ? "Drop to upload" : "Drop your image here"}
                </p>
                <p className="text-sm text-gray-400">
                    or click to browse (PNG, JPG, WEBP)
                </p>
            </div>
        </div>
    );
}
