import { normalizeServiceURL } from "./hjfyClient";
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(window: Window): Promise<void> {
  const doc = window.document;
  const serviceInput = doc.getElementById(
    "arxiv2zh-service-url",
  ) as HTMLInputElement | null;
  const pollInput = doc.getElementById(
    "arxiv2zh-poll-interval",
  ) as HTMLInputElement | null;
  const retentionInput = doc.getElementById(
    "arxiv2zh-history-retention",
  ) as HTMLInputElement | null;
  const openInput = doc.getElementById(
    "arxiv2zh-open-after-single",
  ) as HTMLInputElement | null;
  if (serviceInput) serviceInput.value = String(getPref("serviceURL"));
  if (pollInput) pollInput.value = String(getPref("pollInterval"));
  if (retentionInput)
    retentionInput.value = String(getPref("historyRetentionDays"));
  if (openInput) openInput.checked = Boolean(getPref("openAfterSingle"));

  serviceInput?.addEventListener("change", () => {
    try {
      const value = normalizeServiceURL(serviceInput.value);
      serviceInput.value = value;
      serviceInput.setCustomValidity("");
      setPref("serviceURL", value);
    } catch (error) {
      serviceInput.setCustomValidity(
        error instanceof Error ? error.message : "服务地址无效",
      );
      serviceInput.reportValidity();
    }
  });
  pollInput?.addEventListener("change", () => {
    const value = Math.max(5, Math.round(Number(pollInput.value) || 10));
    pollInput.value = String(value);
    setPref("pollInterval", value);
  });
  retentionInput?.addEventListener("change", () => {
    const value = Math.max(1, Math.round(Number(retentionInput.value) || 30));
    retentionInput.value = String(value);
    setPref("historyRetentionDays", value);
  });
  openInput?.addEventListener("change", () =>
    setPref("openAfterSingle", openInput.checked),
  );
  doc
    .getElementById("arxiv2zh-open-account")
    ?.addEventListener("click", () => addon.data.taskManager?.openAccount());
  doc
    .getElementById("arxiv2zh-clear-session")
    ?.addEventListener("click", () => {
      if (window.confirm("仅清除 hjfy.top 的登录 Cookie？之后需要重新登录。"))
        addon.data.taskManager?.clearSession();
    });
}
