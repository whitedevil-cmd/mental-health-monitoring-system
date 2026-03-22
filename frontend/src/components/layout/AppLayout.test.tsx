import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '@/components/layout/AppLayout';

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/routePreload', () => ({
  preloadRoute: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignOut.mockClear();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      signOut: mockSignOut,
    });
  });

  it('shows logout in the mobile menu when authenticated', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const mobileMenu = document.getElementById('mobile-navigation-menu');

    expect(mobileMenu).not.toBeNull();
    expect(within(mobileMenu as HTMLElement).getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('hides logout in the mobile menu when logged out', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const mobileMenu = document.getElementById('mobile-navigation-menu');

    expect(mobileMenu).not.toBeNull();
    expect(within(mobileMenu as HTMLElement).queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('keeps the desktop sign out action rendered', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppLayout>
          <div>content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThan(0);
  });
});
