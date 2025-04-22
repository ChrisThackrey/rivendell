import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as RTL from '@testing-library/react'
const { screen, fireEvent } = RTL as any
import SolutionCard from '@/components/solution-card'
import '@testing-library/jest-dom'

// Mocks
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

// Mock child components
vi.mock('@/components/ui/code-block', () => ({
  CodeBlock: ({ children }: any) => <div data-testid="code-block">{children}</div>,
  CodeBlockCode: ({ code }: any) => <div data-testid="code-block-code">{code || 'Empty Code'}</div>,
  CodeBlockTabs: ({ files }: any) => (
    <div data-testid="code-block-tabs">
      {files.map((file: any, i: number) => (
        <div key={i} data-testid="tab">{file.filename}</div>
      ))}
    </div>
  )
}))

vi.mock('@/components/hooks/use-expandable', () => ({
  useExpandable: () => ({
    isExpanded: true, // Always expanded for testing
    toggleExpand: vi.fn(),
    animatedHeight: { get: () => 1 }
  })
}))

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({ 
    success: true, 
    files: [{ filename: 'test.js', language: 'javascript', code: 'console.log("test")', hasContent: true }] 
  })
})

describe('SolutionCard', () => {
  const defaultProps = {
    id: 'test-id',
    title: 'Test Solution',
    description: 'Test description',
    type: 'accepted' as const,
    model: 'GPT-4o',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with no code files', () => {
    render(<SolutionCard {...defaultProps} />)
    
    expect(screen.getByText('Test Solution')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument()
  })

  it('should render with empty code files', () => {
    const codeFiles = [
      { filename: 'empty.js', language: 'javascript', code: '' }
    ]
    
    render(<SolutionCard {...defaultProps} codeFiles={codeFiles} />)
    
    // Should still render the empty filename
    const viewCodeBtn = screen.getByText('View Code')
    fireEvent.click(viewCodeBtn)
    
    expect(screen.getByTestId('code-block')).toBeInTheDocument()
    expect(screen.getByTestId('tab')).toHaveTextContent('empty.js')
  })

  it('should render with valid code files', () => {
    const codeFiles = [
      { filename: 'test.js', language: 'javascript', code: 'console.log("hello")' }
    ]
    
    render(<SolutionCard {...defaultProps} codeFiles={codeFiles} />)
    
    const viewCodeBtn = screen.getByText('View Code')
    fireEvent.click(viewCodeBtn)
    
    expect(screen.getByTestId('code-block')).toBeInTheDocument()
    expect(screen.getByTestId('code-block-code')).toBeInTheDocument()
    expect(screen.getByTestId('tab')).toHaveTextContent('test.js')
  })

  it('should display file tree when provided', () => {
    const fileTree = `
project-root/
- package.json [MODIFIED]
- src/
  - index.js [NEW]
    `
    
    const codeFiles = [
      { filename: 'test.js', language: 'javascript', code: 'console.log("hello")' }
    ]
    
    render(<SolutionCard {...defaultProps} codeFiles={codeFiles} />)
    
    const viewCodeBtn = screen.getByText('View Code')
    fireEvent.click(viewCodeBtn)
    
    // The file tree should be displayed in the modal
    expect(screen.getByText('Project Structure')).toBeInTheDocument()
    
    // The entire file tree content should be visible in a pre tag
    const preElement = document.querySelector('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement?.textContent).toContain('package.json [MODIFIED]')
    expect(preElement?.textContent).toContain('index.js [NEW]')
  })
})
