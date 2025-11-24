"use client";

import { useEffect, useRef, useState } from "react";
import UPNG from "upng-js";
import { Download, Loader2 } from "lucide-react";

interface AnimationPreviewProps {
    imageSrc: string;
}

type AnimationType = "none" | "bounce" | "shake" | "pulse" | "swing";

export default function AnimationPreview({ imageSrc }: AnimationPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [animationType, setAnimationType] = useState<AnimationType>("bounce");
    const requestRef = useRef<number | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // LINEスタンプ最大サイズ
    const CANVAS_WIDTH = 320;
    const CANVAS_HEIGHT = 270;

    // 画像のロード
    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            imageRef.current = img;
        };
    }, [imageSrc]);

    // 描画ロジック（再利用のため関数化）
    const drawFrame = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, time: number, type: AnimationType) => {
        // キャンバスをクリア
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // アニメーションパラメータの計算
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;
        let rotation = 0; // ラジアン

        switch (type) {
            case "bounce":
                offsetY = Math.sin(time / 200) * 20;
                break;
            case "shake":
                offsetX = Math.sin(time / 100) * 10;
                break;
            case "pulse":
                scale = 1 + Math.sin(time / 300) * 0.1;
                break;
            case "swing":
                rotation = Math.sin(time / 400) * 0.2;
                break;
            case "none":
            default:
                break;
        }

        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;

        // 画像のアスペクト比を維持して描画サイズを決定
        const maxSize = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.8;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        const drawWidth = img.width * ratio * scale;
        const drawHeight = img.height * ratio * scale;

        ctx.save();

        if (type === "swing") {
            const pivotX = centerX;
            const pivotY = centerY + drawHeight / 2;

            ctx.translate(pivotX, pivotY);
            ctx.rotate(rotation);
            ctx.translate(-pivotX, -pivotY);
        } else {
            ctx.translate(centerX + offsetX, centerY + offsetY);
        }

        if (type === "swing") {
            ctx.drawImage(
                img,
                centerX - drawWidth / 2,
                centerY - drawHeight / 2,
                drawWidth,
                drawHeight
            );
        } else {
            ctx.drawImage(
                img,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
        }

        ctx.restore();
    };

    // アニメーションループ
    const animate = (time: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const img = imageRef.current;

        if (canvas && ctx && img && !isExporting) {
            drawFrame(ctx, img, time, animationType);
        }

        if (!isExporting) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (!isExporting) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [animationType, isExporting]);

    const handleExport = async () => {
        if (!imageRef.current || !canvasRef.current) return;
        setIsExporting(true);

        // 少し待ってUI更新を反映させる
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No context");

            const frames: ArrayBuffer[] = [];
            const delays: number[] = [];

            // 設定: 2秒間のアニメーション、20fps (50ms/frame) -> 40フレーム
            // LINEスタンプは最大4秒、容量制限300KBなので、フレーム数を抑えめにする
            const duration = 2000; // 2秒
            const fps = 15; // 15fps (容量削減のため少し落とす)
            const frameInterval = 1000 / fps;
            const totalFrames = Math.floor(duration / frameInterval);

            for (let i = 0; i < totalFrames; i++) {
                const time = i * frameInterval;
                drawFrame(ctx, imageRef.current, time, animationType);

                // フレームデータを取得
                const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data.buffer;
                frames.push(imageData);
                delays.push(frameInterval);
            }

            // APNGエンコード (cnum=0: フルカラー)
            const apngBuffer = UPNG.encode(frames, CANVAS_WIDTH, CANVAS_HEIGHT, 0, delays);

            // ダウンロード
            const blob = new Blob([apngBuffer], { type: "image/png" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `sticker_${animationType}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full items-center">
            {/* 表示サイズを50% (max-w-[50%]) に制限 */}
            <div className="aspect-[320/270] w-full max-w-[50%] bg-checker rounded-lg overflow-hidden border border-gray-800 relative shadow-lg">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="w-full h-full object-contain"
                />
                {isExporting && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-xs font-medium">Generating APNG...</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 w-full items-center">
                <div className="flex gap-2 justify-center flex-wrap">
                    {(["none", "bounce", "shake", "pulse", "swing"] as AnimationType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => setAnimationType(type)}
                            disabled={isExporting}
                            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${animationType === type
                                    ? "bg-primary text-white"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleExport}
                    disabled={isExporting || animationType === "none"}
                    className="btn btn-primary w-full max-w-xs"
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <Download size={18} />
                            Export APNG
                        </>
                    )}
                </button>
                <p className="text-xs text-gray-500">
                    Size: 320x270px • Length: 2s • Format: APNG
                </p>
            </div>
        </div>
    );
}
