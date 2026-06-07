"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { Loader2, Plus, X } from "lucide-react";

interface AiVoiceSectionProps {
  onToast: (message: string, type?: "success" | "error") => void;
}

type Tone = "formal" | "friendly" | "casual";

function ChipInput({
  chips,
  onChange,
  placeholder,
  colorClass,
}: {
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder: string;
  colorClass: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const val = draft.trim();
    if (!val || chips.length >= 20 || val.length > 120) return;
    onChange([...chips, val]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {chips.map((chip, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}
          >
            {chip}
            <button
              type="button"
              onClick={() => onChange(chips.filter((_, j) => j !== i))}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
          maxLength={120}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || chips.length >= 20}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AiVoiceSection({ onToast }: AiVoiceSectionProps) {
  const { t, locale } = useLanguage();
  const av = (t.settings as Record<string, unknown>).aiVoice as Record<string, string>;

  const [loaded, setLoaded] = useState(false);
  const [tone, setTone] = useState<Tone>("formal");
  const [writingInstructions, setWritingInstructions] = useState("");
  const [aiDos, setAiDos] = useState<string[]>([]);
  const [aiDonts, setAiDonts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => {
        if (data.brand) {
          setTone((data.brand.tone as Tone) || "formal");
          setWritingInstructions(data.brand.writingInstructions || "");
          setAiDos(data.brand.aiDos || []);
          setAiDonts(data.brand.aiDonts || []);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleToneChange = async (newTone: Tone) => {
    try {
      const res = await fetch("/api/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: newTone }),
      });
      if (!res.ok) {
        const err = await res.json();
        onToast(err.error || "Failed to save tone", "error");
        return;
      }
      setTone(newTone);
    } catch {
      onToast("Failed to save tone", "error");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writingInstructions, aiDos, aiDonts }),
      });
      if (!res.ok) {
        const err = await res.json();
        onToast(err.error || "Save failed", "error");
      } else {
        onToast(av.saved);
      }
    } catch {
      onToast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewText("");
    try {
      const res = await fetch("/api/ai/voice-preview", { method: "POST" });
      const data = await res.json();
      setPreviewText(data.message || data.error || "No output");
    } catch {
      setPreviewText("Preview generation failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const toneLabels: Record<Tone, string> = {
    formal: t.onboarding.toneFormal,
    friendly: t.onboarding.toneFriendly,
    casual: t.onboarding.toneCasual,
  };

  const labelClass = "text-xs font-semibold text-slate-500 uppercase tracking-wider";
  const cardClass = "rounded-2xl border border-slate-100 bg-white shadow-sm p-6 space-y-6";

  if (!loaded) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div>
        <h2 className="text-base font-bold text-slate-900">{av.title}</h2>
        <p className="text-xs text-slate-400 mt-1">{av.subtitle}</p>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <label className={labelClass}>{av.toneLabel}</label>
        <div className="flex gap-2">
          {(["formal", "friendly", "casual"] as Tone[]).map((tn) => (
            <button
              key={tn}
              type="button"
              onClick={() => handleToneChange(tn)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                tone === tn
                  ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {toneLabels[tn]}
            </button>
          ))}
        </div>
      </div>

      {/* Writing Instructions */}
      <div className="space-y-2">
        <label className={labelClass}>{av.instructionsLabel}</label>
        <textarea
          value={writingInstructions}
          onChange={(e) => setWritingInstructions(e.target.value)}
          placeholder={av.instructionsPlaceholder}
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
        <div className="text-right text-xs text-slate-400">{writingInstructions.length}/1000</div>
      </div>

      {/* Do's and Don'ts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className={labelClass}>{av.dosLabel}</label>
          <ChipInput
            chips={aiDos}
            onChange={setAiDos}
            placeholder={av.dosPlaceholder}
            colorClass="bg-emerald-50 text-emerald-700 border border-emerald-200"
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>{av.dontsLabel}</label>
          <ChipInput
            chips={aiDonts}
            onChange={setAiDonts}
            placeholder={av.dontsPlaceholder}
            colorClass="bg-red-50 text-red-700 border border-red-200"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {saving ? av.saving : av.save}
      </button>

      {/* Live Preview */}
      <div className="border-t border-slate-100 pt-6 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{av.previewTitle}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{av.previewHint}</p>
        </div>
        <button
          onClick={handlePreview}
          disabled={previewLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {previewLoading ? av.previewGenerating : av.previewButton}
        </button>
        {previewText && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {previewText}
          </div>
        )}
      </div>
    </div>
  );
}
