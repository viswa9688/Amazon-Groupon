import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthGuard from '../AuthGuard'
import { useAuth } from '@/hooks/useAuth'

// Mock the useAuth hook
vi.mock('@/hooks/useAuth')
const mockUseAuth = vi.mocked(useAuth)

// Mock child component
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: '123', 
        email: 'test@example.com', 
        firstName: 'Test', 
        lastName: 'User',
        isSeller: false
      } as any,
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <AuthGuard>
        <TestComponent />
      </AuthGuard>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('shows loading spinner when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })

    render(
      <AuthGuard>
        <TestComponent />
      </AuthGuard>
    )

    // Should show loading spinner while redirecting
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders loading spinner when authentication is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    })

    render(
      <AuthGuard>
        <TestComponent />
      </AuthGuard>
    )

    // Should show loading state, not login prompt or protected content
    expect(screen.queryByText('Please log in to access this page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to login automatically when not authenticated', () => {
    // Mock window.location
    const mockLocation = {
      href: '',
      pathname: '/seller/dashboard',
      search: '?test=1',
    }
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    })

    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })

    render(
      <AuthGuard>
        <TestComponent />
      </AuthGuard>
    )

    // Should automatically redirect to login with current path
    expect(mockLocation.href).toBe('/api/login?redirect=%2Fseller%2Fdashboard%3Ftest%3D1')
  })
})