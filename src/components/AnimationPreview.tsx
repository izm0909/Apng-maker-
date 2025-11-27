"use client";

import { useEffect, useRef, useState } from "react";
import UPNG from "upng-js";
import { Download, Loader2 } from "lucide-react";
import { setApngLoopCount } from "@/utils/apngUtils";

interface AnimationPreviewProps {
    imageSrc: string;
}

type AnimationType = "none" | "bounce" | "shake" | "pulse" | "swing";

const PRESET_TEXTS = [
    "おはよ", "ありがとう", "OK", "おつかれ",
    "おやすみ", "HAHA", "ふふふ…", "なんでやねん！",
    "えらい！", "ごめんて", "それな！", "は？",
    "じーっ", "既読", "らぶ", "ぺこり"
];

export default function AnimationPreview({ imageSrc }: AnimationPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [animationType, setAnimationType] = useState<AnimationType>("bounce");
    const [text, setText] = useState<string>("");
    const [loopCount, setLoopCount] = useState<number>(4); // Default to 4 for LINE stickers
    const [duration, setDuration] = useState<number>(1000); // Default to 1s (to match 4 loops limit)
    const requestRef = useRef<number | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // LINEスタンプ最大サイズ
    const CANVAS_WIDTH = 320;
    const CANVAS_HEIGHT = 270;

    // 合計再生時間の計算 (ms)
    // ループ回数0（無限）の場合はWeb用なので制限なしとみなす（表示上は1ループ分を表示）
    const totalDuration = loopCount === 0 ? duration : duration * loopCount;
    const isLineCompliant = totalDuration <= 4000 && (totalDuration % 1000 === 0);

    // 画像のロードとクリーンアップ（透過漏れ対策）
    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            // オフスクリーンキャンバスでアルファ値のクリーンアップを行う
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // アルファ値の閾値処理
                // LINEスタンプのリジェクト対策：半透明のゴミ（透過漏れ）を完全に消去する
                // アルファ値が 50 (約20%) 未満のピクセルを完全に透明にする
                // アルファ値の閾値処理 & エッジ収縮（Erosion）
                // LINEスタンプのリジェクト対策：
                // 1. 半透明のゴミを消去
                // 2. 「白いフリンジ（縁取り）」を消すために、輪郭を1ピクセル内側に削る

                const width = canvas.width;
                const height = canvas.height;
                const threshold = 60; // ゴミとみなす閾値

                // 処理前のデータをコピー（参照用）
                const originalData = new Uint8ClampedArray(data);

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;

                        // 1. ゴミ除去: もともと薄い部分は消す
                        if (originalData[idx + 3] < threshold) {
                            data[idx + 3] = 0;
                            continue;
                        }

                        // 2. エッジ収縮: 周囲4近傍のいずれかが透明（閾値以下）なら、自分も消す
                        // これにより、背景削除で残りやすい境界線の白いノイズを削り取る
                        let isEdge = false;

                        // 左
                        if (x > 0 && originalData[idx - 4 + 3] < threshold) isEdge = true;
                        // 右
                        else if (x < width - 1 && originalData[idx + 4 + 3] < threshold) isEdge = true;
                        // 上
                        else if (y > 0 && originalData[idx - width * 4 + 3] < threshold) isEdge = true;
                        // 下
                        else if (y < height - 1 && originalData[idx + width * 4 + 3] < threshold) isEdge = true;

                        if (isEdge) {
                            // エッジ部分は透明にする（白いフリンジ対策）
                            data[idx + 3] = 0;
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);

                // 加工済みの画像をセット
                const cleanedImg = new Image();
                cleanedImg.src = canvas.toDataURL();
                cleanedImg.onload = () => {
                    imageRef.current = cleanedImg;
                };
            } else {
                imageRef.current = img;
            }
        };
    }, [imageSrc]);

    // 描画ロジック（再利用のため関数化）
    const drawFrame = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, time: number, type: AnimationType, text: string, duration: number, width: number, height: number) => {
        // キャンバスをクリア
        ctx.clearRect(0, 0, width, height);

        // アニメーションパラメータの計算
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;
        let rotation = 0; // ラジアン

        // 周期関数 (0 -> 1)
        const t = (time % duration) / duration;
        const rad = t * Math.PI * 2;

        switch (type) {
            case "bounce":
                offsetY = Math.sin(rad * 2) * 20;
                break;
            case "shake":
                offsetX = Math.sin(rad * 4) * 10;
                break;
            case "pulse":
                scale = 1 + Math.sin(rad) * 0.1;
                break;
            case "swing":
                rotation = Math.sin(rad) * 0.2;
                break;
            case "none":
            default:
                break;
        }

        const centerX = width / 2;
        const centerY = height / 2;

        // 画像のアスペクト比を維持して描画サイズを決定
        const maxSize = Math.min(width, height) * 0.8;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        const drawWidth = img.width * ratio * scale;
        const drawHeight = img.height * ratio * scale;

        ctx.save();

        // 基本位置へ移動
        ctx.translate(centerX + offsetX, centerY + offsetY);

        // swing用の回転処理
        if (type === "swing") {
            const pivotOffset = drawHeight / 2;
            ctx.translate(0, pivotOffset);
            ctx.rotate(rotation);
            ctx.translate(0, -pivotOffset);
        }

        // 画像描画
        ctx.drawImage(
            img,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        // テキスト描画
        if (text) {
            // フォントサイズもキャンバスサイズに合わせて調整（基準320pxに対して32px）
            const fontSize = Math.round(32 * (width / 320));
            ctx.font = `bold ${fontSize}px 'M PLUS Rounded 1c', sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(2, 6 * (width / 320));

            const textY = drawHeight / 2 - (20 * (width / 320));

            ctx.strokeStyle = "white";
            ctx.strokeText(text, 0, textY);
            ctx.fillStyle = "#1e293b"; // Dark slate
            ctx.fillText(text, 0, textY);
        }

        ctx.restore();
    };

    // アニメーションループ
    const animate = (time: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const img = imageRef.current;

        if (canvas && ctx && img && !isExporting) {
            drawFrame(ctx, img, time, animationType, text, duration, CANVAS_WIDTH, CANVAS_HEIGHT);
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
    }, [animationType, isExporting, text, duration]);

    const handleExport = async (targetWidth: number = CANVAS_WIDTH, targetHeight: number = CANVAS_HEIGHT, isMain: boolean = false) => {
        if (!imageRef.current) return;
        setIsExporting(true);

        // 少し待ってUI更新を反映させる
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // オフスクリーンキャンバス（または一時キャンバス）を作成
            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No context");

            const frames: ArrayBuffer[] = [];
            const delays: number[] = [];

            const fps = 8;
            const frameInterval = 1000 / fps;
            const totalFrames = Math.floor(duration / frameInterval);

            for (let i = 0; i < totalFrames; i++) {
                const time = i * frameInterval;
                drawFrame(ctx, imageRef.current, time, animationType, text, duration, targetWidth, targetHeight);

                // フレームデータを取得
                const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight).data.buffer;
                frames.push(imageData);
                delays.push(frameInterval);
            }

            // APNGエンコード
            // cnum: 0 (lossless) に設定して、減色による透過ノイズ（透過漏れの原因）を防ぐ
            let apngBuffer = UPNG.encode(frames, targetWidth, targetHeight, 0, delays);

            // ループ回数の設定を適用
            if (loopCount !== 0) {
                const result = setApngLoopCount(apngBuffer, loopCount);
                apngBuffer = result.buffer;
                console.log("APNG Patch Info:\n" + result.debugInfo);
            }

            // ダウンロード
            const blob = new Blob([apngBuffer], { type: "image/png" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const prefix = isMain ? "main" : "sticker";
            a.download = `${prefix}_${animationType}_${Date.now()}.png`;
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
            {/* 表示サイズをレスポンシブに調整 */}
            <div className="aspect-[320/270] w-full md:max-w-[60%] lg:max-w-[50%] bg-checker rounded-lg overflow-hidden border border-gray-800 relative shadow-lg">
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
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full">
                    {(["none", "bounce", "shake", "pulse", "swing"] as AnimationType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => setAnimationType(type)}
                            disabled={isExporting}
                            className={`py-3 rounded text-sm font-medium capitalize transition-colors ${animationType === type
                                ? "bg-primary text-white"
                                : "bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* テキスト設定 */}
                <div className="w-full space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <label className="text-sm font-medium text-gray-300">Add Text</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Enter text..."
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        />
                        {text && (
                            <button
                                onClick={() => setText("")}
                                className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {PRESET_TEXTS.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setText(preset)}
                                className={`px-3 py-2 text-sm rounded border transition-colors ${text === preset
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                                    }`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 設定 (ループ回数 & 再生時間) */}
                <div className="w-full grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Loop Count</label>
                        <select
                            value={loopCount}
                            onChange={(e) => setLoopCount(Number(e.target.value))}
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary"
                        >
                            <option value={0}>Infinite (Web)</option>
                            <option value={1}>1 Time (LINE)</option>
                            <option value={2}>2 Times (LINE)</option>
                            <option value={3}>3 Times (LINE)</option>
                            <option value={4}>4 Times (LINE)</option>
                        </select>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Duration</label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary"
                        >
                            <option value={1000}>1 Second</option>
                            <option value={2000}>2 Seconds</option>
                            <option value={3000}>3 Seconds</option>
                            <option value={4000}>4 Seconds</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={() => handleExport(CANVAS_WIDTH, CANVAS_HEIGHT, false)}
                        disabled={isExporting || animationType === "none" || (loopCount !== 0 && !isLineCompliant)}
                        className={`btn w-full ${loopCount !== 0 && !isLineCompliant ? "btn-error" : "btn-primary"}`}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                {loopCount !== 0 && !isLineCompliant ? "Total Duration > 4s" : "Export Sticker (320x270)"}
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => handleExport(240, 240, true)}
                        disabled={isExporting || animationType === "none" || (loopCount !== 0 && !isLineCompliant)}
                        className={`btn w-full btn-outline ${loopCount !== 0 && !isLineCompliant ? "btn-error" : "border-gray-600 text-gray-300 hover:bg-gray-800"}`}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Export Main (240x240)
                            </>
                        )}
                    </button>
                </div>

                <div className="text-xs text-center space-y-1">
                    <p className="text-gray-500">
                        Format: APNG
                    </p>
                    <p className={`${isLineCompliant ? "text-green-500" : "text-red-500"} font-medium`}>
                        Total Duration: {totalDuration / 1000}s
                        {loopCount !== 0 && !isLineCompliant && " (Must be ≤ 4s for LINE)"}
                    </p>
                </div>
            </div>
        </div>
    );
}
