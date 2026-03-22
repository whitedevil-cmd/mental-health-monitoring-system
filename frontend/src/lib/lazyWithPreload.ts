import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type LoadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

export const lazyWithPreload = <T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LoadableComponent<T> => {
  const Component = lazy(loader) as LoadableComponent<T>;
  Component.preload = loader;
  return Component;
};
