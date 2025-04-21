// This file provides global setup for tests
import { vi } from 'vitest';
import { CodeFile } from '@/lib/supabase-client';

// Constants that can be used across tests
export const MOCK_DOCUMENT_ID = 'test-document-id';
export const MOCK_BATCH_ID = 'test-batch-id';
export const MOCK_RUN_ID = 1;
export const MOCK_STEP_NUMBER = 1;
export const MOCK_EMBEDDING = Array(1536).fill(0.1);
export const MOCK_METADATA = { key: 'value' };

// Mock code file for testing
export const MOCK_CODE_FILE: CodeFile = {
  language: 'typescript',
  code: 'console.log("Hello world");',
  filename: 'test.ts'
};

// Mock Supabase response
export const MOCK_SUPABASE_RESPONSE = {
  data: [MOCK_CODE_FILE],
  error: null
};

// Mock Supabase client with complete chaining pattern
export const mockSelect = vi.fn().mockReturnValue({
  single: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
});

export const mockInsert = vi.fn().mockReturnValue({
  select: mockSelect,
});

export const mockSupabaseFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  insert: mockInsert,
  upsert: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
  update: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
  delete: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
  eq: vi.fn().mockReturnThis(),
  match: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
});

export const mockSupabaseClient = {
  from: mockSupabaseFrom,
  rpc: vi.fn().mockResolvedValue(MOCK_SUPABASE_RESPONSE),
};

// Mock environment variables required for the application
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-supabase-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-supabase-anon-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock global fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({ data: [MOCK_EMBEDDING] }),
  text: vi.fn().mockResolvedValue('test-response'),
});

// Clean up after all tests
afterAll(() => {
  vi.clearAllMocks();
});
