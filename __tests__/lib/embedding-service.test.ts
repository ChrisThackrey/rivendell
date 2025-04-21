import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mock, mockReset } from "vitest-mock-extended";
import {
  MOCK_DOCUMENT_ID,
  MOCK_BATCH_ID,
  MOCK_EMBEDDING,
  MOCK_RUN_ID,
} from "../setup";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateEmbedding,
  storeDocumentWithEmbedding,
  searchSimilarDocuments,
} from "../../lib/embedding-service";

// Mock the fetch function
global.fetch = vi.fn();

// Mock dependencies
vi.mock("../../lib/supabase-client", () => ({
  supabase: mock<SupabaseClient>(),
}));

// Import the mocked supabase client
import { supabase } from "../../lib/supabase-client";

describe("Embedding Service Tests", () => {
  const mockDocumentContent = "Test document content";
  const mockDocumentMetadata = {
    model: "test-model",
    temperature: 0.7,
    runtime: "10ms",
    cost: 0.01,
    runId: MOCK_RUN_ID,
  };

  beforeEach(() => {
    // Reset fetch mock
    vi.mocked(fetch).mockReset();

    // Set up supabase mock returns
    const mockSupabase = supabase as any;

    // Mock insert operation
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.single.mockResolvedValue({
      data: { id: MOCK_DOCUMENT_ID },
      error: null,
    });

    // Mock rpc calls
    mockSupabase.rpc.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.resetAllMocks();
    mockReset(supabase);
  });

  describe("generateEmbedding", () => {
    it("should generate embedding for text content", async () => {
      // Mock successful fetch response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ embedding: MOCK_EMBEDDING }),
        clone: vi.fn().mockReturnValue({
          text: vi
            .fn()
            .mockResolvedValueOnce(
              JSON.stringify({ embedding: MOCK_EMBEDDING }),
            ),
        }),
      } as unknown as Response);

      const result = await generateEmbedding(mockDocumentContent);

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalled();
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toMatch(/\/api\/embeddings/);
      expect(JSON.parse(options?.body as string)).toEqual({
        text: mockDocumentContent,
      });

      // Verify result
      expect(result).toEqual(MOCK_EMBEDDING);
    });

    it("should handle API errors gracefully", async () => {
      // Mock failed fetch response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValueOnce({ error: "API Error" }),
        clone: vi.fn().mockReturnValue({
          text: vi
            .fn()
            .mockResolvedValueOnce(JSON.stringify({ error: "API Error" })),
        }),
      } as unknown as Response);

      const result = await generateEmbedding(mockDocumentContent);

      // Should return null on API error
      expect(result).toBeNull();
    });

    it("should handle invalid response format", async () => {
      // Mock successful fetch but invalid response format
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ notEmbedding: "invalid" }),
        clone: vi.fn().mockReturnValue({
          text: vi
            .fn()
            .mockResolvedValueOnce(JSON.stringify({ notEmbedding: "invalid" })),
        }),
      } as unknown as Response);

      const result = await generateEmbedding(mockDocumentContent);

      // Should return null on invalid response
      expect(result).toBeNull();
    });
  });

  describe("storeDocumentWithEmbedding", () => {
    // Simplified test
    it("should store a document with embedding successfully", async () => {
      // Use the already mocked global fetch instead of mocking generateEmbedding

      const result = await storeDocumentWithEmbedding(
        mockDocumentContent,
        mockDocumentMetadata,
        MOCK_BATCH_ID,
      );

      // Verify database operation was called
      expect(supabase.from).toHaveBeenCalled();

      // Verify result
      expect(result).toBe(MOCK_DOCUMENT_ID);
    });
  });

  describe("searchSimilarDocuments", () => {
    // Simplified test
    it("should search for similar documents successfully", async () => {
      const queryText = "Search query";
      const matchThreshold = 0.8;
      const matchCount = 5;

      // Mock fetch to provide embedding
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ embedding: MOCK_EMBEDDING }),
        clone: vi.fn().mockReturnValue({
          text: vi
            .fn()
            .mockResolvedValueOnce(
              JSON.stringify({ embedding: MOCK_EMBEDDING }),
            ),
        }),
      } as unknown as Response);

      const mockResults = [
        {
          id: "doc1",
          content: "Similar content 1",
          metadata: { title: "Doc 1" },
          similarity: 0.95,
        },
      ];

      // Mock RPC call
      const mockSupabase = supabase as any;
      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await searchSimilarDocuments(
        queryText,
        matchThreshold,
        matchCount,
      );

      // Verify RPC call
      expect(supabase.rpc).toHaveBeenCalledWith(
        "match_documents",
        expect.objectContaining({
          match_threshold: matchThreshold,
          match_count: matchCount,
        }),
      );

      // Verify results
      expect(result).toEqual(mockResults);
    });
  });
});
