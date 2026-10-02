/**
 * The checks run on an upgrade request before any Redis lookup, kept free of
 * I/O so they can be tested alone.
 */

/** Splits a comma-separated variable, lower-cased, without blanks. */
export const parseList = (value) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const stripPort = (host) => {
  if (host.startsWith("[")) {
    const ipv6End = host.indexOf("]");
    return ipv6End === -1 ? host : host.slice(1, ipv6End);
  }

  return host.split(":")[0] ?? host;
};

/**
 * Same rules as the backend's BACKEND_ALLOWED_HOSTS: an empty list or `*`
 * allows every host, and a leading dot also matches subdomains.
 */
export const isHostAllowed = (requestHost, allowedHosts) => {
  if (allowedHosts.length === 0 || allowedHosts.includes("*")) {
    return true;
  }
  if (!requestHost) {
    return false;
  }

  const normalizedHost = requestHost.trim().toLowerCase();
  const hostname = stripPort(normalizedHost);

  return allowedHosts.some((allowedHost) => {
    if (allowedHost === normalizedHost || allowedHost === hostname) {
      return true;
    }

    if (allowedHost.startsWith(".")) {
      const suffix = allowedHost.slice(1);
      return hostname === suffix || hostname.endsWith(allowedHost);
    }

    return false;
  });
};

/**
 * A browser always sends `Origin` on a websocket upgrade, and a page on another
 * site must not be able to open one: the ticket would be its own, but nothing
 * else about the connection should be. A client without `Origin` is not a
 * browser, and has its own ticket to show.
 */
export const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin || allowedOrigins.length === 0) {
    return true;
  }

  const normalize = (value) => value.trim().toLowerCase().replace(/\/$/, "");
  return allowedOrigins.map(normalize).includes(normalize(origin));
};

/**
 * What a ticket stored by the backend says, or null when it is not one: the
 * key is shared with nobody else, but a malformed value must still never open
 * a socket.
 */
export const parseTicket = (raw) => {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.userId !== "string" || !value.userId) {
      return null;
    }
    return { userId: value.userId, admin: value.admin === true };
  } catch {
    return null;
  }
};
