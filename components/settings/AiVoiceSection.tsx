"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { Loader2, Plus, X, Edit2 } from "lucide-react";

interface AiVoiceSectionProps {
  onToast: (message: string, type?: "success" | "error") => void;
}

type Tone = "formal" | "friendly" | "casual";

interface ChipInputHandle {
  finalizeDraft: () => void;
}

const ChipInput = forwardRef<
  ChipInputHandle,
  {
    chips: string[];
    onChange: (chips: string[]) => void;
    placeholder: string;
    colorClass: string;
    accentColor: string;
  }
>(function ChipInput(
  { chips, onChange, placeholder, colorClass, accentColor },
  ref
) {
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const add = () => {
    const val = draft.trim();
    if (!val || chips.length >= 20 || val.length > 120) return;
    onChange([...chips, val]);
    setDraft("");
  };

  useImperativeHandle(ref, () => ({
    finalizeDraft: add,
  }));

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft(chips[index]);
  };

  const saveEdit = (index: number) => {
    const val = editDraft.trim();
    if (!val || val.length > 120) {
      setEditingIndex(null);
      setEditDraft("");
      return;
    }
    const updated = [...chips];
    updated[index] = val;
    onChange(updated);
    setEditingIndex(null);
    setEditDraft("");
  };

  const deleteChip = (index: number) => {
    onChange(chips.filter((_, j) => j !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[36px]">
        {chips.map((chip, i) => (
          <div
            key={i}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${colorClass} hover:shadow-md`}
          >
            {editingIndex === i ? (
              <input
                autoFocus
                type="text"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(i);
                  if (e.key === "Escape") { setEditingIndex(null); setEditDraft(""); }
                }}
                maxLength={120}
                className={`text-xs bg-transparent border-b border-current outline-none flex-1 min-w-[100px] ${accentColor}`}
              />
            ) : (
              <span className="flex-1">{chip}</span>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingIndex !== i && (
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="p-0.5 rounded hover:bg-white/30 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => editingIndex === i ? setEditingIndex(null) : deleteChip(i)}
                className="p-0.5 rounded hover:bg-white/30 transition-colors"
                title="Delete"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
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
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || chips.length >= 20}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all duration-200"
          title="Add rule"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default function AiVoiceSection({ onToast }: AiVoiceSectionProps) {
  const { t, locale } = useLanguage();
  const av = (t.settings as Record<string, unknown>).aiVoice as Record<string, string>;

  const dosRef = useRef<ChipInputHandle>(null);
  const dontsRef = useRef<ChipInputHandle>(null);

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
      onToast(av.saved, "success");
    } catch {
      onToast("Failed to save tone", "error");
    }
  };

  const handleSave = async () => {
    dosRef.current?.finalizeDraft();
    dontsRef.current?.finalizeDraft();

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
        onToast(av.saved, "success");
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

  const labelClass = "text-xs font-semibold text-slate-600 uppercase tracking-widest";

  if (!loaded) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{av.title}</h1>
        <p className="text-sm text-slate-500">{av.subtitle}</p>
      </div>

      {/* Writing Tone Section */}
      <div className="space-y-4">
        <label className={labelClass}>{av.toneLabel}</label>
        <div className="grid grid-cols-3 gap-3">
          {(["formal", "friendly", "casual"] as Tone[]).map((tn) => (
            <button
              key={tn}
              type="button"
              onClick={() => handleToneChange(tn)}
              className={`relative px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                tone === tn
                  ? "bg-blue-500 text-white shadow-lg scale-[1.02]"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {toneLabels[tn]}
              {tone === tn && <div className="absolute inset-0 rounded-lg ring-2 ring-blue-500 ring-offset-2" />}
            </button>
          ))}
        </div>
      </div>

      {/* Writing Instructions Section */}
      <div className="space-y-3">
        <label className={labelClass}>{av.instructionsLabel}</label>
        <div className="space-y-2">
          <textarea
            value={writingInstructions}
            onChange={(e) => setWritingInstructions(e.target.value)}
            placeholder={av.instructionsPlaceholder}
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all resize-none"
          />
          <div className="flex justify-end text-xs text-slate-400">
            {writingInstructions.length} / 1000
          </div>
        </div>
      </div>

      {/* Do's and Don'ts Sections */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className={labelClass}>{av.dosLabel}</label>
          <ChipInput
            ref={dosRef}
            chips={aiDos}
            onChange={setAiDos}
            placeholder={av.dosPlaceholder}
            colorClass="bg-green-50 text-green-700 border border-green-200"
            accentColor="text-green-600"
          />
          <p className="text-xs text-slate-400 pt-1">
            {aiDos.length} / 20 rules
          </p>
        </div>
        <div className="space-y-3">
          <label className={labelClass}>{av.dontsLabel}</label>
          <ChipInput
            ref={dontsRef}
            chips={aiDonts}
            onChange={setAiDonts}
            placeholder={av.dontsPlaceholder}
            colorClass="bg-red-50 text-red-700 border border-red-200"
            accentColor="text-red-600"
          />
          <p className="text-xs text-slate-400 pt-1">
            {aiDonts.length} / 20 rules
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            saving
              ? "bg-slate-200 text-slate-600 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
          }`}
        >
          {saving ? av.saving : av.save}
        </button>
        <p className="text-xs text-slate-400">All changes saved automatically</p>
      </div>

      {/* Live Preview Section */}
      <div className="space-y-4 border-t border-slate-200 pt-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{av.previewTitle}</h2>
          <p className="text-sm text-slate-500">{av.previewHint}</p>
        </div>
        <button
          onClick={handlePreview}
          disabled={previewLoading}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            previewLoading
              ? "bg-slate-200 text-slate-600 cursor-not-allowed"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95"
          }`}
        >
          {previewLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {previewLoading ? av.previewGenerating : av.previewButton}
        </button>
        {previewText && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm font-mono text-xs">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Generated Email Preview</p>
            <div className="bg-white p-3 rounded border border-slate-200 text-slate-800 leading-relaxed">
              {previewText.split('\n').map((line, idx) => (
                <div key={idx}>
                  {line.startsWith('Subject:') ? (
                    <div className="font-bold text-slate-900 mb-2">{line}</div>
                  ) : line.trim() === '' ? (
                    <div className="h-1" />
                  ) : (
                    <div>{line}</div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              ✓ Your AI Voice settings have been applied to this preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
