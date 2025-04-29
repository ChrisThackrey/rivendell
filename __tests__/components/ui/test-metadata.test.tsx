import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import * as RTL from '@testing-library/react';
const { screen, fireEvent } = RTL as any;
import { TestMetadata } from '@/components/ui/test-metadata';
import '@testing-library/jest-dom';

// Mock shiki's codeToHtml function
vi.mock('shiki', () => ({
  codeToHtml: vi.fn().mockResolvedValue(`
    <pre><code><span class="line">Mocked code content</span></code></pre>
  `)
}));

// Mock CodeBlockCode component
vi.mock('@/components/ui/code-block', () => {
  const React = require('react');
  return {
    CodeBlockCode: ({ code, language }: any) => (
      <div data-testid="code-block-code">
        <div data-testid="code-content">{code || ''}</div>
        <div data-testid="language">{language || 'javascript'}</div>
        <div data-testid="metadata-section">Metadata Section</div>
      </div>
    )
  };
});

// Mock UI components
vi.mock('@/components/ui/card', () => {
  const React = require('react');
  return {
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
    CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
    CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
    CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  };
});

vi.mock('@/components/ui/tabs', () => {
  const React = require('react');
  return {
    Tabs: ({ children, defaultValue }: any) => <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>,
    TabsContent: ({ children, value }: any) => <div data-testid="tabs-content" data-value={value}>{children}</div>,
    TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
    TabsTrigger: ({ children, value }: any) => (
      <button data-testid="tab" data-value={value} role="tab">
        {children}
      </button>
    ),
  };
});

vi.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: ({ children, value, onValueChange }: any) => (
      <div data-testid="select" data-value={value} onClick={() => onValueChange && onValueChange('python')}>
        {children}
      </div>
    ),
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: any) => (
      <div data-testid="select-item" data-value={value}>
        {children}
      </div>
    ),
    SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: ({ children }: any) => <div data-testid="select-value">{children}</div>,
  };
});

vi.mock('@/components/ui/switch', () => {
  const React = require('react');
  return {
    Switch: ({ checked, onCheckedChange }: any) => (
      <input 
        type="checkbox" 
        data-testid="switch" 
        checked={checked} 
        onChange={() => onCheckedChange && onCheckedChange(!checked)} 
      />
    ),
  };
});

vi.mock('@/components/ui/label', () => {
  const React = require('react');
  return {
    Label: ({ children, htmlFor }: any) => (
      <label data-testid="label" htmlFor={htmlFor}>
        {children}
      </label>
    ),
  };
});

vi.mock('@/components/ui/input', () => {
  const React = require('react');
  return {
    Input: ({ value, onChange, id, type = 'text' }: any) => (
      <input
        data-testid="input"
        id={id}
        type={type}
        value={value}
        onChange={onChange ? (e: any) => onChange(e) : undefined}
      />
    ),
  };
});

vi.mock('@/components/ui/textarea', () => {
  const React = require('react');
  return {
    Textarea: ({ value, onChange, id, className }: any) => (
      <textarea
        data-testid="textarea"
        id={id}
        className={className}
        value={value}
        onChange={onChange ? (e: any) => onChange(e) : undefined}
      />
    ),
  };
});

vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: ({ children, onClick }: any) => (
      <button data-testid="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

describe('TestMetadata Component', () => {
  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
  });

  it('renders the basic structure correctly', () => {
    render(<TestMetadata />);
    
    // Check main structure
    expect(screen.getAllByTestId('card')).toHaveLength(2);
    expect(screen.getAllByTestId('card-header')).toHaveLength(2);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('code-block-code')).toBeInTheDocument();
    
    // Check tabs are present
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0].textContent).toBe('Code');
    expect(tabs[1].textContent).toBe('Metadata');
    expect(tabs[2].textContent).toBe('Changes Highlight');
    expect(tabs[3].textContent).toBe('Display Options');
  });
  
  it('shows correct default code content', () => {
    render(<TestMetadata />);
    
    const codeContent = screen.getByTestId('code-content');
    expect(codeContent.textContent).toBe("console.log('Hello world');");
  });
  
  it('shows code editing controls', () => {
    render(<TestMetadata />);
    
    // Language select should be present
    expect(screen.getAllByTestId('label').find((el: unknown) => (el as HTMLElement).textContent === 'Language')).toBeInTheDocument();
    expect(screen.getByTestId('select')).toBeInTheDocument();
    
    // Code textarea should be present
    expect(screen.getAllByTestId('label').find((el: unknown) => (el as HTMLElement).textContent === 'Code')).toBeInTheDocument();
    
    // Find the textarea with id="code"
    const codeTextarea = Array.from(screen.getAllByTestId('textarea')).find(
      (el) => (el as HTMLTextAreaElement).id === 'code'
    );
    expect(codeTextarea).toBeInTheDocument();
  });
  
  it('handles code input changes', () => {
    render(<TestMetadata />);
    
    // Find textarea with id="code" and change its value
    const textarea = Array.from(screen.getAllByTestId('textarea')).find(
      (el) => (el as HTMLTextAreaElement).id === 'code'
    );
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'const newCode = true;' } });
    }
    
    // Code content in preview should update
    const codeContent = screen.getByTestId('code-content');
    expect(codeContent.textContent).toBe('const newCode = true;');
  });
  
  it('handles language changes', () => {
    render(<TestMetadata />);
    
    // Initial state should be javascript
    expect(screen.getByTestId('language').textContent).toBe('javascript');
    
    // Click on the select
    fireEvent.click(screen.getByTestId('select'));
    
    // Our mocked select automatically changes to 'python'
    expect(screen.getByTestId('language').textContent).toBe('python');
  });
  
  it('handles metadata display toggle', () => {
    render(<TestMetadata />);
    
    // Find the metadata-related elements
    const metadataSwitches = screen.getAllByTestId('switch');
    const showMetadataSwitch = Array.from(metadataSwitches).find(
      (el) => (el as HTMLInputElement).closest('div')?.textContent?.includes('Show Metadata')
    );
    
    // Toggle should exist and default to checked
    expect(showMetadataSwitch).toBeInTheDocument();
    if (showMetadataSwitch) {
      expect(showMetadataSwitch).toBeChecked();
      
      // Click to toggle off
      fireEvent.click(showMetadataSwitch);
      expect(showMetadataSwitch).not.toBeChecked();
    }
  });
  
  it('handles metadata field changes', () => {
    render(<TestMetadata />);
    
    // Find metadata-related inputs
    const inputs = screen.getAllByTestId('input');
    const modelInput = Array.from(inputs).find(
      (el) => (el as HTMLInputElement).id === 'model'
    );
    
    // Change value
    if (modelInput) {
      fireEvent.change(modelInput, { target: { value: 'claude-3' } });
    }
    
    // Find all the textareas
    const textareas = screen.getAllByTestId('textarea');
    const descriptionTextarea = Array.from(textareas).find(
      (el) => (el as HTMLTextAreaElement).id === 'description'
    );
    
    // Change description
    if (descriptionTextarea) {
      fireEvent.change(descriptionTextarea, { 
        target: { value: 'Updated description' } 
      });
    }
  });
  
  it('handles changes highlight toggle and configuration', () => {
    render(<TestMetadata />);
    
    // Find all switches
    const switches = screen.getAllByTestId('switch');
    
    // Find changes tab and click it
    const changesTab = screen.getAllByTestId('tab').find(
      (el: unknown) => (el as HTMLElement).textContent === 'Changes Highlight'
    );
    if (changesTab) {
      fireEvent.click(changesTab);
    }
    
    // Find the changes highlight switch (should be the first switch in the changes tab)
    const changesSwitch = screen.getAllByTestId('switch')[0];
    
    // Should exist and default to unchecked
    expect(changesSwitch).toBeInTheDocument();
    expect(changesSwitch).not.toBeChecked();
    
    // Click to toggle on
    fireEvent.click(changesSwitch);
    expect(changesSwitch).toBeChecked();
  });
});