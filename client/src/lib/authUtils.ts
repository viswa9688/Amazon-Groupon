export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin(): void {
  // Redirect to browse page which will show the login modal
  const currentPath = window.location.pathname + window.location.search;
  const redirectUrl = `/browse?redirect=${encodeURIComponent(currentPath)}`;
  window.location.href = redirectUrl;
}