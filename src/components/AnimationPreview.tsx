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

    // 画像のロード
    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            imageRef.current = img;
        };
    }, [imageSrc]);

    // 描画ロジック（再利用のため関数化）
    const drawFrame = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, time: number, type: AnimationType, text: string, duration: number) => {
        // キャンバスをクリア
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // アニメーションパラメータの計算
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;
        let rotation = 0; // ラジアン

        // 周期関数 (0 -> 1)
        // time が duration の倍数のときにちょうど0に戻るようにする
        const t = (time % duration) / duration;
        const rad = t * Math.PI * 2;

        switch (type) {
            case "bounce":
                // 1ループで2回跳ねる
                offsetY = Math.sin(rad * 2) * 20;
                // 跳ねる動きっぽくするために絶対値をとって反転させるなどの工夫もできるが、
                // ここではシンプルなサイン波で上下動させる
                break;
            case "shake":
                // 1ループで4回震える
                offsetX = Math.sin(rad * 4) * 10;
                break;
            case "pulse":
                // 1ループで1回拡大縮小
                scale = 1 + Math.sin(rad) * 0.1;
                break;
            case "swing":
                // 1ループで1回揺れる (左右対称)
                rotation = Math.sin(rad) * 0.2;
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

        // 基本位置へ移動 (中心 + アニメーションのオフセット)
        ctx.translate(centerX + offsetX, centerY + offsetY);

        // swing用の回転処理
        if (type === "swing") {
            // 回転軸を画像の下端に設定
            // 現在位置(0, 0)は画像の中心なので、そこから drawHeight/2 下にずらす
            const pivotOffset = drawHeight / 2;
            ctx.translate(0, pivotOffset);
            ctx.rotate(rotation);
            ctx.translate(0, -pivotOffset);
        }

        // 画像描画 (常に中心基準)
        ctx.drawImage(
            img,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        // テキスト描画
        if (text) {
            ctx.font = "bold 32px 'M PLUS Rounded 1c', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineJoin = "round";
            ctx.lineWidth = 6;

            // テキストの位置（画像の下部）
            // 画像と一緒に動くので、単純にY座標を指定すればよい
            // 画像の下端より少し上に配置
            const textY = drawHeight / 2 - 20;

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
            drawFrame(ctx, img, time, animationType, text, duration);
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

            // 設定: アニメーション
            // LINEスタンプは最大4秒、容量制限300KBなので、フレーム数と色数を抑える
            // const duration = 2000; // stateを使用
            const fps = 8; // 8fps (容量削減のためフレームレートを下げる: 10 -> 8)
            const frameInterval = 1000 / fps;
            const totalFrames = Math.floor(duration / frameInterval);

            for (let i = 0; i < totalFrames; i++) {
                const time = i * frameInterval;
                drawFrame(ctx, imageRef.current, time, animationType, text, duration);

                // フレームデータを取得
                const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data.buffer;
                frames.push(imageData);
                delays.push(frameInterval);
            }

            // APNGエンコード
            // cnum=128: 色数を128に減色して容量を削減（LINEスタンプ推奨は300KB以下）
            // 256だと容量オーバーする場合があるため調整
            let apngBuffer = UPNG.encode(frames, CANVAS_WIDTH, CANVAS_HEIGHT, 128, delays);

            // ループ回数の設定を適用
            // upng-jsはデフォルトで無限ループ(0)になるため、LINEスタンプ用に書き換える
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
            a.download = `sticker_${animationType}_${duration / 1000}s_${Date.now()}.png`;
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
                                className={`px-2 py-1 text-xs rounded border transition-colors ${text === preset
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

                <button
                    onClick={handleExport}
                    disabled={isExporting || animationType === "none" || (loopCount !== 0 && !isLineCompliant)}
                    className={`btn w-full max-w-xs ${loopCount !== 0 && !isLineCompliant ? "btn-error" : "btn-primary"}`}
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <Download size={18} />
                            {loopCount !== 0 && !isLineCompliant ? "Total Duration > 4s" : "Export APNG"}
                        </>
                    )}
                </button>
                <div className="text-xs text-center space-y-1">
                    <p className="text-gray-500">
                        Size: 320x270px • Format: APNG
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
