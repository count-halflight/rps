const modelVersions = typeof __TRINITY_ASSET_VERSIONS__ === "undefined"
  ? {} : __TRINITY_ASSET_VERSIONS__;

// Public model/pose filenames stay readable, but changed bytes have a new key
// even while a returning player is still controlled by the previous worker.
// The optional arguments also allow the URL contract to be checked without Vite.
export function assetUrl(path, base = import.meta.env?.BASE_URL || "/", versions = modelVersions) {
  const relative = path.replace(/^\/+/, "");
  const fragmentAt = relative.indexOf("#");
  const fragment = fragmentAt < 0 ? "" : relative.slice(fragmentAt);
  const resource = fragmentAt < 0 ? relative : relative.slice(0, fragmentAt);
  const queryAt = resource.indexOf("?");
  const pathname = queryAt < 0 ? resource : resource.slice(0, queryAt);
  const version = versions[pathname];
  if (typeof version !== "string") return `${base}${relative}`;
  const query = new URLSearchParams(queryAt < 0 ? "" : resource.slice(queryAt + 1));
  query.set("v", version);
  return `${base}${pathname}?${query}${fragment}`;
}
