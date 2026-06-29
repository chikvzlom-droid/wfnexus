import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Send, Trash2, Terminal, CheckCircle2, XCircle, Loader2, LogIn, Bell, Webhook, Globe } from "lucide-react";
import { api } from "../lib/api";
import type { NotificationSettings } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const API_BASE = "/api/v1";

export default function SettingsPage() {
  const { lang, setLang } = useLangStore();
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signinMsg, setSigninMsg] = useState<string | null>(null);
  const [ingameName, setIngameName] = useState<string | null>(null);

  const [method, setMethod] = useState("GET");
  const [testPath, setTestPath] = useState("/me");
  const [authFormat, setAuthFormat] = useState("cookie");
  const [testBody, setTestBody] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; body: unknown; error?: string } | null>(null);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ ntfy_topic: "", discord_webhook_url: "" });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [notifTesting, setNotifTesting] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<{ sent: string[]; configured: Record<string, boolean> } | null>(null);

  const checkJwt = async () => {
    try {
      const resp = await fetch(`${API_BASE}/auth/jwt`);
      const data = await resp.json();
      setHasToken(data.has_token);
      setTokenPreview(data.token_preview);
    } catch { setHasToken(false); }
  };

  useEffect(() => { checkJwt(); }, []);

  useEffect(() => {
    api.getNotificationSettings()
      .then(setNotifSettings)
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setSigningIn(true);
    setSigninMsg(null);
    try {
      const resp = await fetch(`${API_BASE}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await resp.json();
      if (data.success) {
        setIngameName(data.ingame_name || "Unknown");
        setSigninMsg(t("settings.signIn.success", lang, { name: data.ingame_name || "Unknown" }));
        setEmail("");
        setPassword("");
        await checkJwt();
      } else {
        setSigninMsg(t("settings.signIn.error", lang, { msg: data.error || "Login failed" }));
      }
    } catch (e: unknown) {
      setSigninMsg(t("settings.signIn.error", lang, { msg: e instanceof Error ? e.message : "Request failed" }));
    }
    finally { setSigningIn(false); }
  };

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const resp = await fetch(`${API_BASE}/auth/jwt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        setSaveMsg(t("settings.jwt.error", lang, { msg: err.detail || resp.statusText }));
      } else {
        setSaveMsg(t("settings.jwt.saved", lang));
        setToken("");
        await checkJwt();
      }
    } catch (e: unknown) {
      setSaveMsg(t("settings.jwt.error", lang, { msg: e instanceof Error ? e.message : "Request failed" }));
    }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await fetch(`${API_BASE}/auth/jwt`, { method: "DELETE" });
      setHasToken(false);
      setTokenPreview(null);
      setIngameName(null);
      setSaveMsg(t("settings.jwt.deleted", lang));
    } catch { setSaveMsg(t("settings.jwt.deleteFailed", lang)); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    let body: Record<string, unknown> | undefined;
    if (testBody.trim()) {
      try { body = JSON.parse(testBody); }
      catch { setTestResult({ status: 0, body: null, error: t("settings.apiTester.invalidJson", lang) }); setTesting(false); return; }
    }
    try {
      const resp = await fetch(`${API_BASE}/auth/test-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path: testPath, body, auth_format: authFormat }),
      });
      const data = await resp.json();
      setTestResult(data);
    } catch (e: unknown) {
      setTestResult({ status: 0, body: null, error: e instanceof Error ? e.message : "Request failed" });
    }
    finally { setTesting(false); }
  };

  const handleSaveNotif = async () => {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const data = await api.updateNotificationSettings(notifSettings);
      setNotifSettings(data);
      setNotifMsg(t("settings.notifications.saved", lang));
    } catch { setNotifMsg(t("settings.notifications.failed", lang)); }
    finally { setNotifSaving(false); }
  };

  const handleTestNotif = async () => {
    setNotifTesting(true);
    setNotifTestResult(null);
    try {
      const data = await api.testNotificationSettings();
      setNotifTestResult(data);
    } catch {}
    finally { setNotifTesting(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("settings.title", lang)}</h2>

      {/* Language selector */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Globe size={18} className="text-wf-primary" />
          {t("settings.language", lang)}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {t("settings.languageDesc", lang)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setLang("en")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              lang === "en"
                ? "bg-wf-primary/20 text-wf-primary border border-wf-primary/40"
                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("ru")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              lang === "ru"
                ? "bg-wf-primary/20 text-wf-primary border border-wf-primary/40"
                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            Русский
          </button>
        </div>
      </div>

      {/* Login card */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <LogIn size={18} className="text-wf-primary" />
          {t("settings.signIn.title", lang)}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {t("settings.signIn.desc", lang)}
        </p>

        <div className="flex flex-col gap-2">
          <input
            className="input"
            type="email"
            placeholder={t("settings.signIn.email", lang)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          />
          <input
            className="input"
            type="password"
            placeholder={t("settings.signIn.password", lang)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          />
          <button
            className="btn-primary flex items-center justify-center gap-2"
            onClick={handleSignIn}
            disabled={signingIn || !email.trim() || !password}
          >
            {signingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {signingIn ? t("settings.signIn.signingIn", lang) : t("settings.signIn.button", lang)}
          </button>
        </div>

        {signinMsg && (
          <p className={`text-sm mt-2 ${signinMsg.startsWith("Error") || signinMsg.startsWith("Ошибка") ? "text-red-400" : "text-green-400"}`}>
            {signinMsg}
          </p>
        )}
      </div>

      {/* JWT card */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Key size={18} className="text-wf-primary" />
          {t("settings.jwt.title", lang)}
        </h3>

        {hasToken && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-green-900/20 border border-green-700/30 text-sm">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-green-300">{ingameName ? `${ingameName} · ` : ""}</span>
            <code className="text-gray-300 text-xs">{tokenPreview}</code>
          </div>
        )}

        {!hasToken && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-sm">
            <XCircle size={16} className="text-yellow-400" />
            <span className="text-yellow-300">{t("settings.jwt.noToken", lang)}</span>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="input pr-10 font-mono text-sm"
              type={showToken ? "text" : "password"}
              placeholder={t("settings.jwt.placeholder", lang)}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving || !token.trim()}>
            <Save size={16} />
            {saving ? t("settings.jwt.saving", lang) : t("settings.jwt.save", lang)}
          </button>
          {hasToken && (
            <button className="btn-secondary flex items-center gap-2 text-red-400" onClick={handleDelete}>
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {saveMsg && (
          <p className={`text-sm mt-2 ${saveMsg.startsWith("Error") || saveMsg.startsWith("Ошибка") ? "text-red-400" : "text-green-400"}`}>
            {saveMsg}
          </p>
        )}
      </div>

      {/* Notifications card */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Bell size={18} className="text-wf-primary" />
          {t("settings.notifications.title", lang)}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {t("settings.notifications.desc", lang)}
        </p>

        {notifLoading ? (
          <p className="text-sm text-gray-500">{t("settings.notifications.loading", lang)}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Webhook size={12} />
                {t("settings.notifications.ntfy", lang)}
              </label>
              <input
                className="input font-mono text-sm"
                placeholder="your-ntfy-topic"
                value={notifSettings.ntfy_topic}
                onChange={(e) => setNotifSettings({ ...notifSettings, ntfy_topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Send size={12} />
                {t("settings.notifications.discord", lang)}
              </label>
              <input
                className="input font-mono text-sm"
                placeholder="https://discord.com/api/webhooks/..."
                value={notifSettings.discord_webhook_url}
                onChange={(e) => setNotifSettings({ ...notifSettings, discord_webhook_url: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleSaveNotif}
                disabled={notifSaving}
              >
                <Save size={16} />
                {notifSaving ? "..." : t("settings.notifications.save", lang)}
              </button>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={handleTestNotif}
                disabled={notifTesting}
              >
                {notifTesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {t("settings.notifications.test", lang)}
              </button>
            </div>
            {notifMsg && (
              <p className={`text-sm ${notifMsg === "Saved" || notifMsg === "Сохранено" ? "text-green-400" : "text-red-400"}`}>{notifMsg}</p>
            )}
            {notifTestResult && (
              <div className="text-sm space-y-1">
                <p className="text-gray-400">{t("settings.notifications.configured", lang, { list: Object.entries(notifTestResult.configured).filter(([, v]) => v).map(([k]) => k).join(", ") || "none" })}</p>
                <p className="text-gray-400">{t("settings.notifications.sent", lang, { list: notifTestResult.sent.length ? notifTestResult.sent.join(", ") : "none" })}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Tester card */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Terminal size={18} className="text-wf-primary" />
          {t("settings.apiTester.title", lang)}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {t("settings.apiTester.desc", lang)}
        </p>

        <div className="flex gap-2 mb-2">
          <select className="input w-24 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select className="input w-32 text-sm" value={authFormat} onChange={(e) => setAuthFormat(e.target.value)}>
            <option value="cookie">Cookie</option>
            <option value="Bearer {token}">Bearer</option>
            <option value="JWT {token}">JWT</option>
            <option value="{token}">Raw</option>
          </select>
          <input
            className="input flex-1 font-mono text-sm"
            placeholder={t("settings.apiTester.placeholder", lang)}
            value={testPath}
            onChange={(e) => setTestPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
          />
          <button className="btn-primary flex items-center gap-2" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t("settings.apiTester.send", lang)}
          </button>
        </div>

        <textarea
          className="input w-full font-mono text-xs h-20 mb-2"
          placeholder={t("settings.apiTester.bodyPlaceholder", lang)}
          value={testBody}
          onChange={(e) => setTestBody(e.target.value)}
        />

        {testResult && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("settings.apiTester.status", lang)}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                testResult.status >= 200 && testResult.status < 300
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}>
                {testResult.status || "N/A"}
              </span>
              {testResult.error && <span className="text-xs text-red-400">{testResult.error}</span>}
            </div>
            <pre className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(testResult.body, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
