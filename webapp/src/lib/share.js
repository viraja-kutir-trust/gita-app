/**
 * Share text. Desktop app on macOS: the system share menu. Browsers with the Web
 * Share API: its sheet. Otherwise the text goes to the clipboard and `notify`
 * says so. Returns "shared" | "copied".
 */
export async function shareText(text, notify) {
  const desktop = window.gitaDesktop;
  if (desktop?.share && (await desktop.share(text))) return "shared";
  if (!desktop && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "shared";
    }
  }
  await copyText(text);
  notify?.("Copied — paste it wherever you'd like to share it");
  return "copied";
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
