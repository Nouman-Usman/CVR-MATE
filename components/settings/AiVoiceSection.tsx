"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { Loader2, Plus, X, Edit2, Check } from "lucide-react";

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
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {chips.map((chip, i) => (
          <div
            key={i}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${colorClass} hover:shadow-sm hover:-translate-y-0.5`}
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
                className={`text-sm bg-transparent border-b border-current outline-none flex-1 min-w-[100px] font-medium ${accentColor}`}
              />
            ) : (
              <span className="flex-1 text-sm">{chip}</span>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              {editingIndex !== i && (
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="p-1 rounded hover:bg-white/40 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => editingIndex === i ? setEditingIndex(null) : deleteChip(i)}
                className="p-1 rounded hover:bg-white/40 transition-colors"
                title="Delete"
              >
                <X className="w-3.5 h-3.5" />
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
          className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition-all"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || chips.length >= 20}
          className="px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all duration-200 shrink-0"
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
  const [autoSaving, setAutoSaving] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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
        setInitialLoadDone(true);
      })
      .catch(() => {
        setLoaded(true);
        setInitialLoadDone(true);
      });
  }, []);

  // Auto-save do's and don'ts on change
  useEffect(() => {
    if (!initialLoadDone) return;

    setAutoSaving(true);
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/brand", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiDos, aiDonts }),
        });
      } catch (err) {
        console.error("Auto-save failed:", err);
      } finally {
        setAutoSaving(false);
      }
    }, 300); // Debounce 300ms to avoid rapid saves

    return () => clearTimeout(timer);
  }, [aiDos, aiDonts, initialLoadDone]);

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

  const labelClass = "text-xs font-semibold text-slate-700 uppercase tracking-widest";

  if (!loaded) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{locale === "da" ? "Indlæser..." : "Loading..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{av.title}</h1>
        <p className="text-sm md:text-base text-slate-600">{av.subtitle}</p>
      </div>

      {/* Section 1: Tone */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/50 to-white p-6 md:p-8 space-y-4">
        <div>
          <label className={labelClass}>{av.toneLabel}</label>
          <p className="text-xs text-slate-500 mt-1">{locale === "da" ? "Velg din foretrukne tone" : "Choose your preferred tone"}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {(["formal", "friendly", "casual"] as Tone[]).map((tn) => (
            <button
              key={tn}
              type="button"
              onClick={() => handleToneChange(tn)}
              className={`relative px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                tone === tn
                  ? "bg-blue-500 text-white shadow-md hover:shadow-lg hover:bg-blue-600"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {toneLabels[tn]}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Writing Instructions */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/50 to-white p-6 md:p-8 space-y-3">
        <label className={labelClass}>{av.instructionsLabel}</label>
        <div className="space-y-3">
          <textarea
            value={writingInstructions}
            onChange={(e) => setWritingInstructions(e.target.value)}
            placeholder={av.instructionsPlaceholder}
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition-all resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{locale === "da" ? "Retningslinjer for hvordan AI skal skrive" : "Guidelines for how AI should write"}</span>
            <span className="text-xs text-slate-400">{writingInstructions.length} / 1000</span>
          </div>
        </div>
      </div>

      {/* Section 3: Do's and Don'ts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Do's */}
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50/50 to-white p-6 md:p-8 space-y-4">
          <div>
            <label className={`${labelClass} text-green-700`}>{av.dosLabel}</label>
            <p className="text-xs text-slate-500 mt-1">{locale === "da" ? "Hvad AI bør gøre" : "What AI should do"}</p>
          </div>
          <ChipInput
            ref={dosRef}
            chips={aiDos}
            onChange={setAiDos}
            placeholder={av.dosPlaceholder}
            colorClass="bg-green-100 text-green-700 border border-green-300"
            accentColor="text-green-700"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{aiDos.length} / 20 {locale === "da" ? "regler" : "rules"}</p>
            {autoSaving && <Loader2 className="w-3 h-3 animate-spin text-green-600" />}
          </div>
        </div>

        {/* Don'ts */}
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50/50 to-white p-6 md:p-8 space-y-4">
          <div>
            <label className={`${labelClass} text-red-700`}>{av.dontsLabel}</label>
            <p className="text-xs text-slate-500 mt-1">{locale === "da" ? "Hvad AI ikke bør gøre" : "What AI should avoid"}</p>
          </div>
          <ChipInput
            ref={dontsRef}
            chips={aiDonts}
            onChange={setAiDonts}
            placeholder={av.dontsPlaceholder}
            colorClass="bg-red-100 text-red-700 border border-red-300"
            accentColor="text-red-700"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{aiDonts.length} / 20 {locale === "da" ? "regler" : "rules"}</p>
            {autoSaving && <Loader2 className="w-3 h-3 animate-spin text-red-600" />}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-500">{locale === "da" ? "Ændringer gemmes automatisk" : "Changes saved automatically"}</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            saving
              ? "bg-slate-200 text-slate-600 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {av.saving}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {av.save}
            </>
          )}
        </button>
      </div>

      {/* Section 4: Live Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg md:text-xl font-semibold text-slate-900">{av.previewTitle}</h2>
          <p className="text-sm text-slate-600">{av.previewHint}</p>
        </div>
        <button
          onClick={handlePreview}
          disabled={previewLoading}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            previewLoading
              ? "bg-slate-200 text-slate-600 cursor-not-allowed"
              : "border border-blue-300 text-blue-700 hover:bg-blue-50 active:scale-95"
          }`}
        >
          {previewLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {previewLoading ? av.previewGenerating : av.previewButton}
        </button>
        {previewText && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden shadow-sm">
            <div className="bg-white border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{locale === "da" ? "E-mail eksempel" : "Email Example"}</p>
            </div>
            <div className="p-5 md:p-6 space-y-4 text-slate-800 leading-relaxed text-sm">
              {previewText.split('\n').map((line, idx) => (
                <div key={idx}>
                  {line.startsWith('Subject:') ? (
                    <div className="font-bold text-slate-900 mb-4 pb-3 border-b border-slate-200">{line.replace('Subject: ', '')}</div>
                  ) : line.trim() === '' ? (
                    <div className="h-2" />
                  ) : (
                    <div>{line}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-blue-50/50 border-t border-slate-200 px-5 py-3">
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-600" />
                {locale === "da" ? "AI Voice indstillinger anvendt" : "AI Voice settings applied"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
