"use client";

import { useState, useEffect } from "react";
import { Zap, Image as ImageIcon, Download, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import AnimationPreview from "@/components/AnimationPreview";
import { removeBackground } from "@imgly/background-removal";

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isBgRemovalEnabled, setIsBgRemovalEnabled] = useState(true);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (originalImage) URL.revokeObjectURL(originalImage);
      if (processedImage) URL.revokeObjectURL(processedImage);
    };
  }, [originalImage, processedImage]);

  const handleImageSelected = async (file: File) => {
    setError(null);
    setIsProcessing(true);

    // オリジナル画像のプレビュー作成
    const objectUrl = URL.createObjectURL(file);
    setOriginalImage(objectUrl);
    setProcessedImage(null);

    try {
      if (isBgRemovalEnabled) {
        console.log("Starting background removal...");
        // 背景削除処理
        // note: 初回実行時はアセットのダウンロードに時間がかかる場合があります
        const blob = await removeBackground(file, {
          progress: (key: string, current: number, total: number) => {
            console.log(`Progress: ${key} ${current}/${total}`);
          }
        });

        const processedUrl = URL.createObjectURL(blob);
        setProcessedImage(processedUrl);
        console.log("Background removal complete!");
      } else {
        // 背景削除をスキップ（そのまま使用）
        // fileをそのまま使うか、objectUrlを使う
        // ここでは一貫性のためobjectUrlを使用（ただし、AnimationPreview側でCORSエラーが出ないように注意が必要だが、
        // createObjectURLで作ったURLは同一オリジン扱いになるので基本OK）
        setProcessedImage(objectUrl);
      }
    } catch (err) {
      console.error("Background removal failed:", err);
      setError("Failed to remove background. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setError(null);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-[rgba(255,255,255,0.08)]">
        <div className="container h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap size={20} color="white" fill="white" />
            </div>
            <span className="font-bold text-xl tracking-tight">APNG Maker</span>
          </div>
          <nav className="flex gap-4 text-sm text-gray-400">
            <button className="hover:text-white transition-colors">How to use</button>
            <button className="hover:text-white transition-colors">GitHub</button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container py-12 flex flex-col items-center gap-8">

        {!originalImage ? (
          // 初期状態: アップローダー表示
          <div className="flex flex-col items-center justify-center text-center gap-8 w-full max-w-4xl animate-in fade-in zoom-in duration-500">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-5xl font-extrabold leading-tight">
                Bring your stickers to <span className="text-primary">Life</span>
              </h1>
              <p className="text-lg text-gray-400">
                Upload a single image, remove the background automatically, and add motion to create LINE animated stickers.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBgRemovalEnabled}
                  onChange={(e) => setIsBgRemovalEnabled(e.target.checked)}
                  className="toggle toggle-primary toggle-sm"
                />
                <span className="text-sm font-medium text-gray-300">Auto Background Removal</span>
              </label>
            </div>

            <ImageUploader onImageSelected={handleImageSelected} isProcessing={isProcessing} />

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
              {[
                { icon: <ImageIcon />, title: "Auto BG Removal", desc: "AI-powered background removal instantly." },
                { icon: <Zap />, title: "Instant Animation", desc: "Apply preset motions like Bounce, Shake, and more." },
                { icon: <Download />, title: "LINE Ready", desc: "Export as APNG optimized for LINE stickers." },
              ].map((feature, i) => (
                <div key={i} className="card p-6 text-left space-y-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // 編集・プレビューモード
          <div className="w-full max-w-6xl flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Workspace</h2>
              <button onClick={handleReset} className="btn btn-secondary text-sm">
                <RefreshCw size={16} /> Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Original & Processed Preview */}
              <div className="space-y-6">
                <div className="card bg-black/20 p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Background Removal</h3>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    {/* Original */}
                    <div className="space-y-2">
                      <div className="aspect-square rounded-lg overflow-hidden border border-gray-800 bg-gray-900/50 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
                        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">Original</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center text-gray-600 rotate-90 md:rotate-0">
                      {isProcessing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    </div>

                    {/* Processed */}
                    <div className="space-y-2">
                      <div className="aspect-square rounded-lg overflow-hidden border border-gray-800 bg-checker relative">
                        {isProcessing ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm gap-2">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <span className="text-xs text-gray-300">Removing BG...</span>
                          </div>
                        ) : processedImage ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={processedImage} alt="Processed" className="w-full h-full object-contain" />
                            <div className="absolute bottom-2 left-2 bg-primary/80 px-2 py-1 rounded text-xs text-white">Removed</div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">Waiting...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Animation Controls */}
              <div className="space-y-6">
                <div className="card h-full flex flex-col p-6 gap-4 border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={20} className="text-primary" />
                    <h3 className="text-lg font-bold">Animation Studio</h3>
                  </div>

                  {processedImage ? (
                    <AnimationPreview imageSrc={processedImage} />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 opacity-50">
                      <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center">
                        <Zap size={32} className="text-gray-600" />
                      </div>
                      <p className="text-gray-500">Process an image to start animating</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
