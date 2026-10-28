export function expectedOrigin(requestUrl, hostHeader) {
  const request = new URL(requestUrl);
  if (!/^https?:$/.test(request.protocol) || !hostHeader || /[\r\n/@?#]/.test(hostHeader)) throw new Error("Invalid request origin.");
  let host;
  try { host = new URL(`${request.protocol}//${hostHeader}`); } catch { throw new Error("Invalid request origin."); }
  if (host.username || host.password || host.pathname !== "/" || host.search || host.hash) throw new Error("Invalid request origin.");
  return host.origin;
}
