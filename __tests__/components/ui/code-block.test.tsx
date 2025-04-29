import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as RTL from '@testing-library/react'
const { screen } = RTL as any
import { CodeBlock, CodeBlockCode, CodeBlockTabs } from '@/components/ui/code-block'
import '@testing-library/jest-dom'

// Mock codeToHtml from shiki
vi.mock('shiki', () => ({
  codeToHtml: vi.fn().mockResolvedValue('<pre><code>Mock highlighted code</code></pre>')
}))

describe('CodeBlock Components', () => {
  describe('CodeBlockCode', () => {
    it('should handle empty code properly', async () => {
      render(<CodeBlockCode code="" />)
      
      // Wait for the component to update with the fallback message
      const codeElement = await screen.findByText('// No code content available')
      expect(codeElement).toBeInTheDocument()
    })

    it('should handle undefined code properly', async () => {
      render(<CodeBlockCode code={undefined as any} />)
      
      // Wait for the component to update with the fallback message
      const codeElement = await screen.findByText('// No code content available')
      expect(codeElement).toBeInTheDocument()
    })

    it('should handle whitespace-only code properly', async () => {
      render(<CodeBlockCode code="   \n   " />)
      
      // Wait for the component to update with the fallback message
      const codeElement = await screen.findByText('// No code content available')
      expect(codeElement).toBeInTheDocument()
    })
  })

  describe('CodeBlockTabs', () => {
    it('should render tabs for files with empty content', () => {
      const files = [
        { filename: 'test1.js', code: '', language: 'javascript' },
        { filename: 'test2.js', code: '', language: 'javascript' }
      ]
      
      render(<CodeBlockTabs files={files} />)
      
      // Should render the filenames as tabs
      expect(screen.getByText('test1.js')).toBeInTheDocument()
      expect(screen.getByText('test2.js')).toBeInTheDocument()
    })
  })
})
