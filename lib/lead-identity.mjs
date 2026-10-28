export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeProfileUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const aliases = { "m.facebook.com": "facebook.com", "fb.com": "facebook.com", "m.instagram.com": "instagram.com" };
  if (!["facebook.com", "m.facebook.com", "fb.com", "instagram.com", "m.instagram.com"].includes(host)) return null;
  url.port = "";
  const canonicalHost = aliases[host] || host;
  let segments;
  try { segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  const lowerSegments = segments.map(segment => segment.toLowerCase());
  if (canonicalHost === "facebook.com" && lowerSegments[0] === "profile.php") {
    const ids = url.searchParams.getAll("id");
    if (ids.length !== 1 || !/^\d+$/.test(ids[0])) return null;
    url.pathname = "/profile.php";
    url.search = "";
    url.searchParams.set("id", ids[0]);
  } else if (canonicalHost === "facebook.com") {
    const reserved = ["posts", "reel", "reels", "p", "stories", "watch", "photo.php", "video.php", "groups", "events", "marketplace"];
    if (lowerSegments.length === 3 && lowerSegments[0] === "people" && /^\d+$/.test(segments[2])) {
      url.pathname = "/profile.php";
      url.search = "";
      url.searchParams.set("id", segments[2]);
    } else if (segments.length !== 1 || reserved.includes(lowerSegments[0]) || !/^[a-z0-9._-]+$/.test(lowerSegments[0])) return null;
  } else if (segments.length !== 1 || ["p", "reel", "reels", "stories", "explore", "accounts"].includes(lowerSegments[0]) || !/^[a-z0-9._]+$/.test(lowerSegments[0])) return null;
  url.hostname = canonicalHost;
  url.protocol = "https:";
  url.hash = "";
  if (!(canonicalHost === "facebook.com" && url.pathname.toLowerCase() === "/profile.php")) {
    url.search = "";
    url.pathname = `/${segments.map(segment => segment.toLowerCase()).join("/")}`;
  }
  url.searchParams.sort();
  return url.toString().replace(/\/$/, "");
}
