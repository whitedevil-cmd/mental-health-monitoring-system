const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/voice': () => import('@/pages/Voice'),
  '/insights': () => import('@/pages/Insights'),
  '/history': () => import('@/pages/History'),
  '/profile': () => import('@/pages/Profile'),
  '/portfolio': () => import('@/pages/Founder'),
  '/founder': () => import('@/pages/Founder'),
  '/support': () => import('@/pages/Support'),
  '/privacy': () => import('@/pages/Privacy'),
};

export const preloadRoute = (path: string): void => {
  const preload = routePreloaders[path];
  if (!preload) {
    return;
  }

  void preload();
};
