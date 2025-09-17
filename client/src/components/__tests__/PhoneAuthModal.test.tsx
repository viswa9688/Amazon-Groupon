import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PhoneAuthModal from '../PhoneAuthModal'
import { apiRequest, queryClient } from '@/lib/queryClient'

// Mock the dependencies
vi.mock('@/lib/queryClient')
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockApiRequest = vi.mocked(apiRequest)
const mockQueryClient = vi.mocked(queryClient)

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const testQueryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={testQueryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('PhoneAuthModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryClient.invalidateQueries = vi.fn()
  })

  it('renders phone input step initially', () => {
    renderWithQueryClient(
      <PhoneAuthModal open={true} onClose={mockOnClose} />
    )

    expect(screen.getByText('Sign In with Phone')).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithQueryClient(
      <PhoneAuthModal open={false} onClose={mockOnClose} />
    )

    expect(screen.queryByText('Sign In with Phone')).not.toBeInTheDocument()
  })

  it('sends OTP when phone number is submitted', async () => {
    const user = userEvent.setup()
    mockApiRequest.mockResolvedValueOnce({} as any)

    renderWithQueryClient(
      <PhoneAuthModal open={true} onClose={mockOnClose} />
    )

    const phoneInput = screen.getByLabelText(/phone number/i)
    const sendButton = screen.getByRole('button', { name: /send code/i })

    await user.type(phoneInput, '+1234567890')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/send-otp', {
        phoneNumber: '+1234567890'
      })
    })
  })

  it('shows OTP step after successful phone submission', async () => {
    const user = userEvent.setup()
    mockApiRequest.mockResolvedValueOnce({} as any)

    renderWithQueryClient(
      <PhoneAuthModal open={true} onClose={mockOnClose} />
    )

    const phoneInput = screen.getByLabelText(/phone number/i)
    const sendButton = screen.getByRole('button', { name: /send code/i })

    await user.type(phoneInput, '+1234567890')
    await user.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Enter Verification Code')).toBeInTheDocument()
      expect(screen.getByText('We sent a 6-digit code to +1234567890')).toBeInTheDocument()
    })
  })

  it('verifies OTP and calls onSuccess when provided', async () => {
    const user = userEvent.setup()
    // Mock successful OTP send
    mockApiRequest.mockResolvedValueOnce({} as any)
    // Mock successful OTP verify
    mockApiRequest.mockResolvedValueOnce({} as any)

    renderWithQueryClient(
      <PhoneAuthModal 
        open={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    )

    // Enter phone number
    const phoneInput = screen.getByLabelText(/phone number/i)
    await user.type(phoneInput, '+1234567890')
    await user.click(screen.getByRole('button', { name: /send code/i }))

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText('Enter Verification Code')).toBeInTheDocument()
    })

    // Enter OTP
    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/verify-otp', {
        phoneNumber: '+1234567890',
        otp: '123456'
      })
      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('redirects to sanitized URL when redirectTo is provided', async () => {
    const user = userEvent.setup()
    mockApiRequest.mockResolvedValueOnce({} as any) // OTP send
    mockApiRequest.mockResolvedValueOnce({} as any) // OTP verify

    // Mock window.location
    const mockLocation = { href: '' }
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    })

    renderWithQueryClient(
      <PhoneAuthModal 
        open={true} 
        onClose={mockOnClose}
        redirectTo="/dashboard"
      />
    )

    // Complete the authentication flow
    const phoneInput = screen.getByLabelText(/phone number/i)
    await user.type(phoneInput, '+1234567890')
    await user.click(screen.getByRole('button', { name: /send code/i }))

    await waitFor(() => {
      expect(screen.getByText('Enter Verification Code')).toBeInTheDocument()
    })

    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      expect(mockLocation.href).toBe('/dashboard')
    })
  })

  it('prevents open redirect attacks', async () => {
    const user = userEvent.setup()
    mockApiRequest.mockResolvedValueOnce({} as any) // OTP send
    mockApiRequest.mockResolvedValueOnce({} as any) // OTP verify

    // Mock window.location
    const mockLocation = { href: '' }
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    })

    renderWithQueryClient(
      <PhoneAuthModal 
        open={true} 
        onClose={mockOnClose}
        redirectTo="https://malicious.com"
      />
    )

    // Complete the authentication flow
    const phoneInput = screen.getByLabelText(/phone number/i)
    await user.type(phoneInput, '+1234567890')
    await user.click(screen.getByRole('button', { name: /send code/i }))

    await waitFor(() => {
      expect(screen.getByText('Enter Verification Code')).toBeInTheDocument()
    })

    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => {
      // Should redirect to safe default instead of malicious URL
      expect(mockLocation.href).toBe('/browse')
    })
  })

  it('allows going back from OTP step to phone step', async () => {
    const user = userEvent.setup()
    mockApiRequest.mockResolvedValueOnce({} as any)

    renderWithQueryClient(
      <PhoneAuthModal open={true} onClose={mockOnClose} />
    )

    // Navigate to OTP step
    const phoneInput = screen.getByLabelText(/phone number/i)
    await user.type(phoneInput, '+1234567890')
    await user.click(screen.getByRole('button', { name: /send code/i }))

    await waitFor(() => {
      expect(screen.getByText('Enter Verification Code')).toBeInTheDocument()
    })

    // Click back button
    const backButton = screen.getByRole('button', { name: /back/i })
    await user.click(backButton)

    expect(screen.getByText('Sign In with Phone')).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
  })
})