import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SellerGuard from '../SellerGuard'
import { useAuth } from '@/hooks/useAuth'

// Mock the useAuth hook
vi.mock('@/hooks/useAuth')
const mockUseAuth = vi.mocked(useAuth)

// Mock child component
const TestComponent = () => <div data-testid="seller-content">Seller Dashboard</div>

describe('SellerGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is authenticated as seller', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: '123', 
        email: 'seller@example.com', 
        firstName: 'Test', 
        lastName: 'Seller',
        isSeller: true
      } as any,
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <SellerGuard>
        <TestComponent />
      </SellerGuard>
    )

    expect(screen.getByTestId('seller-content')).toBeInTheDocument()
  })

  it('renders upgrade prompt when user is authenticated but not a seller', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: '123', 
        email: 'user@example.com', 
        firstName: 'Test', 
        lastName: 'User',
        isSeller: false
      } as any,
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <SellerGuard>
        <TestComponent />
      </SellerGuard>
    )

    expect(screen.getByText('Seller Access Required')).toBeInTheDocument()
    expect(screen.getByText(/You need seller permissions to access this page/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to home/i })).toBeInTheDocument()
    expect(screen.queryByTestId('seller-content')).not.toBeInTheDocument()
  })

  it('renders login prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })

    render(
      <SellerGuard>
        <TestComponent />
      </SellerGuard>
    )

    expect(screen.getByText('Seller Access Required')).toBeInTheDocument()
    expect(screen.getByText(/Please log in to access the seller dashboard/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to home/i })).toBeInTheDocument()
    expect(screen.queryByTestId('seller-content')).not.toBeInTheDocument()
  })

  it('renders loading state when authentication is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    })

    render(
      <SellerGuard>
        <TestComponent />
      </SellerGuard>
    )

    // Should show loading state, not login prompt or protected content
    expect(screen.queryByText('Seller Access Required')).not.toBeInTheDocument()
    expect(screen.queryByTestId('seller-content')).not.toBeInTheDocument()
  })

  it('shows go to home button when user is not a seller', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: '123', 
        email: 'user@example.com', 
        firstName: 'Test', 
        lastName: 'User',
        isSeller: false
      } as any,
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <SellerGuard>
        <TestComponent />
      </SellerGuard>
    )

    const homeButton = screen.getByRole('button', { name: /go to home/i })
    expect(homeButton).toBeInTheDocument()
    
    // The button should be a link to home page
    const linkElement = homeButton.closest('a')
    expect(linkElement).toHaveAttribute('href', '/')
  })
})