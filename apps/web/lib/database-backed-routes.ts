const DATABASE_BACKED_PREFIXES = [
  "/account",
  "/admin",
  "/brands",
  "/business-center",
  "/categories",
  "/compare",
  "/deals",
  "/electrical",
  "/pos",
  "/products",
  "/search",
  "/shop",
  "/solar",
  "/staff",
];

export function isDatabaseBackedPath(pathname: string) {
  if (pathname === "/") return true;

  return DATABASE_BACKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
