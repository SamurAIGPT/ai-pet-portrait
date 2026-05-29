"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  FaCamera, FaSpinner, FaDownload, FaTrashAlt, FaUpload, FaCoins,
  FaChevronRight, FaPlus, FaCheck, FaExclamationTriangle
} from "react-icons/fa";

const STYLE_TEMPLATES = [
  {
    id: "renaissance",
    name: "Renaissance General",
    refUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600",
    prompt: "A professional oil painting portrait of a pet dressed as a Renaissance general, historical military uniform, golden epaulets, majestic, oil painting texture, detailed brush strokes, gallery masterpiece."
  },
  {
    id: "astronaut",
    name: "Astronaut Pet",
    refUrl: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=600",
    prompt: "A high-quality digital art portrait of a pet dressed in an astronaut space suit inside a spaceship cockpit, looking out at Earth in the background, epic lighting, cosmic vibes, detailed space helmet."
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Hero",
    refUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600",
    prompt: "A vibrant cyberpunk style portrait of a pet, neon lights, glowing visor, futuristic jacket, high-tech background, detailed cybernetic enhancements."
  },
  {
    id: "royal",
    name: "Royal Royalty",
    refUrl: "https://images.unsplash.com/photo-1597935258735-e254c1839512?q=80&w=600",
    prompt: "A royal oil painting portrait of a pet wearing a golden crown and velvet robe, holding a scepter, sitting on a majestic throne, detailed jewelry, velvet fabric texture."
  },
  {
    id: "watercolor",
    name: "Watercolor Art",
    refUrl: "https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?q=80&w=600",
    prompt: "A beautiful, soft watercolor portrait of a pet, delicate color splashes, artistic paint drops, textured paper, pastel colors, elegant illustration."
  }
];

export default function StudioPage() {
  const { data: session, update: updateSession } = useSession();
  const [petImage, setPetImage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(STYLE_TEMPLATES[0]);
  const [customPrompt, setCustomPrompt] = useState(STYLE_TEMPLATES[0].prompt);
  
  // Slide-over templates drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Upload/generation UI states
  const [isUploading, setIsUploading] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("idle"); // idle, generating, success, error
  const [generatingError, setGeneratingError] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [creationId, setCreationId] = useState("");

  // Timer states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef(null);

  // Load last creation on mount (if any exists)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const loadSavedCreation = async () => {
        try {
          const res = await fetch("/api/creations");
          if (res.ok) {
            const list = await res.json();
            const last = list[0]; // get most recent
            if (last) {
              setPetImage(last.petImage);
              setResultImage(last.resultImage);
              setCreationId(last.id);
              setCustomPrompt(last.prompt);
              const matchedTemplate = STYLE_TEMPLATES.find(t => t.refUrl === last.referenceImage);
              if (matchedTemplate) setSelectedTemplate(matchedTemplate);
            }
          }
        } catch (e) {
          console.error("Error loading saved creation:", e);
        }
      };
      loadSavedCreation();
    }
  }, []);

  // Timer hook - purely increments without updating state inside effect body synchronously
  useEffect(() => {
    if (generatingStatus === "generating") {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [generatingStatus]);

  const selectStyleTemplate = (template) => {
    setSelectedTemplate(template);
    setCustomPrompt(template.prompt);
  };

  const handleUploadPhoto = async (e) => {
    if (!session?.user) {
      setGeneratingError("Please sign in with Google to upload photos.");
      setGeneratingStatus("error");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setPetImage(data.url);
          setResultImage("");
          setGeneratingStatus("idle");
          setGeneratingError("");
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      console.error(err);
      setGeneratingError("Failed to upload pet photo. Please try again.");
      setGeneratingStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!session?.user) {
      signIn("google");
      return;
    }

    if (!petImage) {
      setGeneratingError("Please upload a pet photo first.");
      setGeneratingStatus("error");
      return;
    }

    // Reset timer and set status
    setElapsedSeconds(0);
    setGeneratingStatus("generating");
    setGeneratingError("");
    setResultImage("");

    try {
      const res = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petImage,
          referenceImage: selectedTemplate.refUrl,
          prompt: customPrompt,
        }),
      });

      if (res.status === 402) {
        setGeneratingError(
          "Insufficient credits. Please purchase a credit pack on the pricing page."
        );
        setGeneratingStatus("error");
        return;
      }

      if (!res.ok) throw new Error("Generation request failed");
      const data = await res.json();

      updateSession(); // refresh user credits badge

      if (data.status === "completed" && data.resultImage) {
        setResultImage(data.resultImage);
        setCreationId(data.id);
        setGeneratingStatus("success");
      } else {
        pollResult(data.id);
      }
    } catch (err) {
      console.error(err);
      setGeneratingError(
        "An error occurred during generation. Please try again."
      );
      setGeneratingStatus("error");
    }
  };

  const pollResult = async (id) => {
    let completed = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!completed && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      attempts++;

      try {
        const res = await fetch(`/api/creations?id=${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed" && data.resultImage) {
            setResultImage(data.resultImage);
            setCreationId(data.id);
            setGeneratingStatus("success");
            completed = true;
          } else if (data.status === "failed") {
            setGeneratingError(
              "AI generation failed. Please review your photo and try again."
            );
            setGeneratingStatus("error");
            completed = true;
          }
        }
      } catch (err) {
        console.error("Error polling database status:", err);
      }
    }

    if (!completed) {
      setGeneratingError(
        "AI processing is taking longer than expected. We will save it in your creations once finished."
      );
      setGeneratingStatus("idle");
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const downloadUrl = `/api/download?url=${encodeURIComponent(resultImage)}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `pet-portrait-${creationId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!creationId) return;
    if (!confirm("Are you sure you want to delete this pet portrait?")) return;

    try {
      const res = await fetch(`/api/creations?id=${creationId}`, { method: "DELETE" });
      if (res.ok) {
        setResultImage("");
        setCreationId("");
        setGeneratingStatus("idle");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden relative bg-zinc-50 font-sans">
      
      {/* Main Studio View Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden p-4 sm:p-6 lg:p-8 gap-6 min-h-0">
        
        {/* Left Input Panel */}
        <div className="w-full md:w-[45%] flex flex-col gap-6 md:overflow-y-auto pr-0 md:pr-1 min-h-0 flex-shrink-0">
          
          {/* Guest Alert Banner */}
          {!session?.user && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 shadow-sm animate-pulse">
              <FaExclamationTriangle className="text-amber-500 text-lg flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Playing as Guest</h4>
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-0.5">
                  You must sign in with Google to upload files, generate pet portraits, and save creations.
                </p>
              </div>
            </div>
          )}

          {/* Heading */}
          <div className="mt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full w-fit">
              Nano-Banana Engine
            </span>
            <h1 className="text-2xl font-black font-heading text-zinc-900 tracking-tight mt-2.5">
              AI Pet Portrait Studio
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium leading-relaxed">
              Use advanced AI technology to transform your pet photos into stunning art portraits.
            </p>
          </div>

          {/* Pet Photo Upload Container */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-md flex flex-col gap-4 relative">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 font-heading">Your Pet Photos</h3>
                <p className="text-[10px] text-zinc-450 font-bold mt-0.5">Upload clear, high-resolution pet photos</p>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-lg shadow-inner">
                {petImage ? "1/1" : "0/1"}
              </span>
            </div>

            {petImage ? (
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 group shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={petImage} alt="Uploaded Pet" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <label className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-800 rounded-lg text-xs font-bold shadow-md cursor-pointer transition-transform duration-200 active:scale-95">
                    Change Photo
                    <input type="file" onChange={handleUploadPhoto} accept="image/*" className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-zinc-200 hover:border-rose-400 rounded-xl aspect-[4/3] flex flex-col items-center justify-center bg-zinc-50/50 p-6 text-center cursor-pointer transition-colors relative group">
                <input
                  type="file"
                  onChange={handleUploadPhoto}
                  accept="image/*"
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                
                {isUploading ? (
                  <>
                    <FaSpinner className="animate-spin text-3xl text-rose-500 mb-3" />
                    <span className="text-xs font-bold text-zinc-650">Uploading photo to CDN...</span>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <FaUpload className="text-lg" />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 font-heading">Upload Your Pet Photo</span>
                    <span className="text-[10px] text-zinc-450 font-bold max-w-[200px] mt-1.5 leading-relaxed">
                      Drag & drop your photo, or click to select (JPG, PNG max 10MB)
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Active Template & Prompt Detail */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-md flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 font-heading">Style Template</h3>
                <p className="text-[10px] text-zinc-450 font-bold mt-0.5">Selected portrait transformation style</p>
              </div>
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-[11px] font-black text-rose-650 hover:text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>Change Style</span> <FaChevronRight className="text-[9px]" />
              </button>
            </div>

            {/* Template Card Showcase */}
            <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 p-3 rounded-xl shadow-sm">
              <div className="h-14 w-14 rounded-lg overflow-hidden border border-zinc-200 flex-shrink-0 bg-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedTemplate.refUrl} alt={selectedTemplate.name} className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="text-[9px] font-black text-rose-650 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase">
                  {selectedTemplate.id} Style
                </span>
                <h4 className="text-xs font-bold text-zinc-850 mt-1">{selectedTemplate.name}</h4>
              </div>
            </div>

            {/* Editable Prompt */}
            <div>
              <label className="text-[10px] font-black text-zinc-550 uppercase tracking-wider block mb-1.5">Art Direction Prompt</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe specific features for the pet portrait..."
                className="w-full text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 focus:border-rose-400 focus:bg-white rounded-xl p-3.5 outline-none resize-none transition-all shadow-inner h-24 leading-relaxed"
              />
            </div>

            {/* Action Trigger Button */}
            <button
              onClick={handleGenerate}
              disabled={generatingStatus === "generating" || isUploading}
              className="w-full flex items-center justify-center gap-2.5 py-4 text-xs font-extrabold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 rounded-2xl shadow-lg shadow-rose-500/20 hover:shadow-rose-600/30 transition-all cursor-pointer mt-1"
            >
              {generatingStatus === "generating" ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Generating Pet Portrait...</span>
                </>
              ) : (
                <>
                  <FaCamera className="text-xs" />
                  <span>Generate Pet Portrait (12 Credits)</span>
                </>
              )}
            </button>

            {generatingError && (
              <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl mt-1 text-center shadow-sm">
                {generatingError}
              </p>
            )}
          </div>

        </div>

        {/* Right Output Panel */}
        <div className="w-full md:w-[55%] flex flex-col bg-white border border-zinc-200 rounded-3xl p-5 shadow-lg relative min-h-[350px] md:h-full overflow-hidden flex-shrink-0">
          
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3.5 mb-4 flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-zinc-800 font-heading">Your Pet Portrait</h3>
              <p className="text-[10px] text-zinc-450 font-bold mt-0.5">Preview and download your transformation</p>
            </div>
            {generatingStatus === "success" && (
              <span className="text-[9px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Completed
              </span>
            )}
            {generatingStatus === "generating" && (
              <span className="text-[9px] font-bold text-rose-650 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                Rendering ({elapsedSeconds}s)
              </span>
            )}
          </div>

          {/* Core Display Box */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-zinc-150 bg-zinc-50/50 flex flex-col items-center justify-center p-6 relative min-h-[220px]">
            
            {resultImage ? (
              <div className="relative w-full h-full max-w-[420px] aspect-[4/5] rounded-xl overflow-hidden border border-zinc-200 shadow-md bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultImage} alt="Simulated Portrait" className="w-full h-full object-cover" />
                
                {/* Original Pet Overlay Context Card */}
                {petImage && (
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-zinc-200 p-1.5 rounded-lg shadow flex items-center gap-2 max-w-[130px]">
                    <div className="h-7 w-7 rounded overflow-hidden border border-zinc-200 bg-zinc-100 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={petImage} alt="Input" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase leading-none">Pet Photo</span>
                  </div>
                )}
              </div>
            ) : generatingStatus === "generating" ? (
              <div className="text-center max-w-sm px-4">
                <div className="h-16 w-16 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-md">
                  <FaSpinner className="animate-spin text-2xl text-rose-500" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800 font-heading">Transforming Pet Photo...</h4>
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed font-medium">
                  Applying the <strong>{selectedTemplate.name}</strong> style template via our AI engine. This usually takes around 8-15 seconds.
                </p>
                <div className="mt-5 text-[10px] font-bold text-rose-650 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full inline-block shadow-inner">
                  Elapsed: {elapsedSeconds} seconds
                </div>
              </div>
            ) : (
              <div className="text-center max-w-sm px-4 py-8">
                <div className="h-16 w-16 bg-zinc-50 text-zinc-400 border border-zinc-200 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <FaCamera className="text-2xl text-zinc-450" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800 font-heading">Ready to Start</h4>
                <p className="text-[11px] text-zinc-450 mt-2 leading-relaxed font-medium">
                  Upload your pet photos, click the generate button to create stunning pet art portraits
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {resultImage && (
            <div className="flex gap-3 mt-4 border-t border-zinc-100 pt-4 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-500/10 cursor-pointer"
              >
                <FaDownload />
                <span>Download HD Portrait</span>
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-3 bg-zinc-100 hover:bg-red-50 hover:text-red-650 border border-zinc-200 hover:border-red-200 text-zinc-650 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Delete portrait"
              >
                <FaTrashAlt />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ─── Collapsible Templates Slide-Out Sidebar ─── */}
      {/* Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[330px] bg-white border-l border-zinc-200 z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4.5 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-zinc-850 font-heading">Choose Style Template</h3>
            <p className="text-[10px] text-zinc-450 font-bold mt-0.5">Select a reference portrait styling</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-zinc-400 hover:text-zinc-800 font-bold text-sm p-1.5 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white overscroll-contain">
          {STYLE_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => selectStyleTemplate(tmpl)}
                className={`border rounded-2xl overflow-hidden shadow-sm hover:shadow hover:border-zinc-350 transition-all flex flex-col h-fit group cursor-pointer ${
                  isSelected ? "ring-2 ring-rose-500 border-rose-500 scale-[1.01]" : "border-zinc-200"
                }`}
              >
                {/* Style Thumbnail */}
                <div className="relative aspect-[16/10] bg-zinc-100 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tmpl.refUrl}
                    alt={tmpl.name}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                  />
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 h-6 w-6 bg-rose-500 border border-rose-400 rounded-full flex items-center justify-center text-white shadow-md">
                      <FaCheck className="text-[10px]" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-3 bg-zinc-50 border-t border-zinc-150 flex items-center justify-between text-xs text-zinc-800 font-bold">
                  <span>{tmpl.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Sticky Vertical Drawer Tab Button ─── */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center gap-2 px-3 py-4.5 bg-gradient-to-b from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-l-2xl shadow-xl transition-all cursor-pointer select-none group border-l border-t border-b border-rose-400"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        title="Open Templates Sidebar"
      >
        <span className="text-[10px] font-black uppercase tracking-widest leading-none group-hover:scale-102 transition-transform">
          Template
        </span>
      </button>

    </div>
  );
}
