import { useState, useRef } from "react";
import { FileUp, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";
import { api } from "../lib/api";

export default function GdprImportPage() {
  const { lang } = useLangStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.importGdpr(json);
      setResult(res);
    } catch {
      setResult({ created: 0, errors: ["Failed to parse JSON file"] });
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileUp className="text-wf-primary" size={28} />
        <h1 className="text-2xl font-display font-bold text-white">{t("gdpr.title", lang)}</h1>
      </div>

      <div className="max-w-lg">
        <p className="text-gray-400 text-sm mb-2">{t("gdpr.desc", lang)}</p>
        <p className="text-gray-500 text-xs mb-6">{t("gdpr.how", lang)}</p>

        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="hidden"
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="btn-primary flex items-center gap-3 w-full justify-center py-4 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Upload size={20} className="animate-spin" />
              {t("gdpr.importing", lang)}
            </>
          ) : (
            <>
              <Upload size={20} />
              {t("gdpr.upload", lang)}
            </>
          )}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-lg border ${result.created > 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            {result.created > 0 ? (
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">{t("gdpr.success", lang, { n: result.created })}</p>
                  {result.errors.length > 0 && (
                    <p className="text-yellow-400 text-xs mt-1">{t("gdpr.errors", lang, { n: result.errors.length })}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-400" />
                <p className="text-red-400">{result.errors[0] || "Import failed"}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
