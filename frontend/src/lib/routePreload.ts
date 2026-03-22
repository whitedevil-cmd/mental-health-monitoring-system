const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/voice': () => import('@/pages/Voice'),
  '/insights': () => import('@/pages/Insights'),
  '/history': () => import('@/pages/History'),
  '/profile': () => import('@/pages/Profile'),
};

export const preloadRoute = (path: string): void => {
  const preload = routePreloaders[path];
  if (!preload) {
    return;
  }

  void preload();
};
