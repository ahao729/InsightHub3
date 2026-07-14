/**
 * InsightHub MCP Server Tests
 *
 * Tests: buildToolDefinitions, callBackend, handleToolCall,
 *        tool name parsing, error handling, PACKAGES config
 *
 * Uses Node's built-in test runner for ESM compatibility.
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// ── Mock fetch globally ──
const originalFetch = globalThis.fetch;
let mockFetchResponse = null;
let lastFetchUrl = null;

function mockFetch(url, opts) {
  lastFetchUrl = url;
  if (mockFetchResponse instanceof Error) {
    return Promise.reject(mockFetchResponse);
  }
  return Promise.resolve({
    ok: mockFetchResponse.ok ?? true,
    status: mockFetchResponse.status ?? 200,
    statusText: mockFetchResponse.statusText ?? "OK",
    json: () => Promise.resolve(mockFetchResponse.body ?? { success: true, data: {} }),
    text: () => Promise.resolve(mockFetchResponse.text ?? ""),
  });
}

// ── Apply mock before importing the module under test ──
globalThis.fetch = mockFetch;

const {
  buildToolDefinitions,
  callBackend,
  handleToolCall,
  PACKAGES,
} = await import("./index.js");

beforeEach(() => {
  mockFetchResponse = { ok: true, status: 200, body: { success: true, data: { results: [] } } };
  lastFetchUrl = null;
});

afterEach(() => {
  globalThis.fetch = mockFetch;
});

/* ══════════════════════════════════════════════
   PACKAGES configuration
   ══════════════════════════════════════════════ */
describe("PACKAGES", () => {
  it("should contain 8 data packages", () => {
    assert.equal(PACKAGES.length, 8);
  });

  it("each package has required fields", () => {
    for (const pkg of PACKAGES) {
      assert.ok(pkg.id, `Package missing id: ${JSON.stringify(pkg)}`);
      assert.ok(pkg.label, `Package ${pkg.id} missing label`);
      assert.ok(pkg.description, `Package ${pkg.id} missing description`);
    }
  });

  it("contains expected package IDs", () => {
    const ids = PACKAGES.map((p) => p.id);
    assert.ok(ids.includes("startup-intel"));
    assert.ok(ids.includes("ai-geo"));
    assert.ok(ids.includes("enterprise-risk"));
    assert.ok(ids.includes("finance-macro"));
    assert.ok(ids.includes("web3-crypto"));
    assert.ok(ids.includes("policy-bidding"));
    assert.ok(ids.includes("patent-tech"));
    assert.ok(ids.includes("education"));
  });
});

/* ══════════════════════════════════════════════
   buildToolDefinitions
   ══════════════════════════════════════════════ */
describe("buildToolDefinitions", () => {
  it("should return 24 tools (3 per package × 8 packages)", () => {
    const tools = buildToolDefinitions();
    assert.equal(tools.length, 24);
  });

  it("each package generates search, detail, and stats tools", () => {
    const tools = buildToolDefinitions();
    const toolNames = tools.map((t) => t.name);

    for (const pkg of PACKAGES) {
      assert.ok(
        toolNames.includes(`${pkg.id}-search`),
        `Missing ${pkg.id}-search`
      );
      assert.ok(
        toolNames.includes(`${pkg.id}-detail`),
        `Missing ${pkg.id}-detail`
      );
      assert.ok(
        toolNames.includes(`${pkg.id}-stats`),
        `Missing ${pkg.id}-stats`
      );
    }
  });

  it("search tools have correct input schema with required query", () => {
    const tools = buildToolDefinitions();
    const searchTools = tools.filter((t) => t.name.endsWith("-search"));

    for (const tool of searchTools) {
      assert.equal(tool.inputSchema.type, "object");
      assert.ok(tool.inputSchema.properties.query);
      assert.ok(tool.inputSchema.required.includes("query"));
      assert.ok(tool.inputSchema.properties.page);
      assert.ok(tool.inputSchema.properties.pageSize);
    }
  });

  it("detail tools have correct input schema with required id", () => {
    const tools = buildToolDefinitions();
    const detailTools = tools.filter((t) => t.name.endsWith("-detail"));

    for (const tool of detailTools) {
      assert.equal(tool.inputSchema.type, "object");
      assert.ok(tool.inputSchema.properties.id);
      assert.ok(tool.inputSchema.required.includes("id"));
    }
  });

  it("stats tools have empty properties schema", () => {
    const tools = buildToolDefinitions();
    const statsTools = tools.filter((t) => t.name.endsWith("-stats"));

    for (const tool of statsTools) {
      assert.equal(tool.inputSchema.type, "object");
      assert.deepEqual(tool.inputSchema.properties, {});
    }
  });

  it("each tool has a description", () => {
    const tools = buildToolDefinitions();
    for (const tool of tools) {
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.ok(tool.description.length > 10);
    }
  });
});

/* ══════════════════════════════════════════════
   callBackend
   ══════════════════════════════════════════════ */
describe("callBackend", () => {
  it("constructs correct URL for search action", async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      body: { success: true, data: { results: [{ id: "1" }] } },
    };

    await callBackend("startup-intel", "search", {
      query: "AI startup",
      page: 2,
      pageSize: 20,
    });

    const calledUrl = globalThis.fetch.mock?.calls?.[0]?.[0] ?? lastFetchUrl;
    // Verify the URL contains the right path and query params
    // URL.searchParams encodes spaces as '+' (form-encoded), not '%20'
    assert.ok(calledUrl.includes("/startup-intel/search"));
    const parsedUrl = new URL(calledUrl);
    assert.equal(parsedUrl.searchParams.get("q"), "AI startup");
    assert.equal(parsedUrl.searchParams.get("page"), "2");
    assert.equal(parsedUrl.searchParams.get("limit"), "20");
  });

  it("constructs correct URL for detail action", async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      body: { success: true, data: { id: "abc-123" } },
    };

    await callBackend("finance-macro", "detail", { id: "abc-123" });

    const calledUrl = lastFetchUrl;
    assert.ok(calledUrl.includes("/finance-macro/abc-123"));
  });

  it("constructs correct URL for stats action", async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      body: { success: true, data: { total: 100 } },
    };

    await callBackend("enterprise-risk", "stats", {});

    const calledUrl = lastFetchUrl;
    assert.ok(calledUrl.includes("/enterprise-risk/stats"));
  });

  it("returns data directly when no meta", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: { count: 42 } },
    };

    const result = await callBackend("ai-geo", "stats", {});
    assert.deepEqual(result, { count: 42 });
  });

  it("returns { data, meta } when meta is present", async () => {
    mockFetchResponse = {
      ok: true,
      body: {
        success: true,
        data: [{ id: 1 }],
        meta: { total: 100, page: 1 },
      },
    };

    const result = await callBackend("ai-geo", "search", { query: "test" });
    assert.deepEqual(result, {
      data: [{ id: 1 }],
      meta: { total: 100, page: 1 },
    });
  });

  it("throws on HTTP error response", async () => {
    mockFetchResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: "endpoint not found",
    };

    await assert.rejects(
      () => callBackend("ai-geo", "stats", {}),
      { message: /Backend API error: 404/ }
    );
  });

  it("throws on backend success=false response", async () => {
    mockFetchResponse = {
      ok: true,
      body: {
        success: false,
        error: { code: "FORBIDDEN", message: "无权限" },
      },
    };

    await assert.rejects(
      () => callBackend("ai-geo", "stats", {}),
      { message: /Backend error: FORBIDDEN/ }
    );
  });

  it("handles network errors", async () => {
    mockFetchResponse = new Error("ECONNREFUSED");

    await assert.rejects(
      () => callBackend("ai-geo", "stats", {}),
      { message: /ECONNREFUSED/ }
    );
  });
});

/* ══════════════════════════════════════════════
   handleToolCall
   ══════════════════════════════════════════════ */
describe("handleToolCall", () => {
  it("parses tool name correctly for search", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: { items: [] } },
    };

    const result = await handleToolCall("startup-intel-search", {
      query: "fintech",
    });

    assert.equal(result.isError, false);
    assert.ok(result.content);
    assert.equal(result.content[0].type, "text");
    const parsed = JSON.parse(result.content[0].text);
    assert.deepEqual(parsed, { items: [] });
  });

  it("parses tool name correctly for detail", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: { id: "rec-1", title: "Test" } },
    };

    const result = await handleToolCall("enterprise-risk-detail", {
      id: "rec-1",
    });

    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, "rec-1");
  });

  it("parses tool name correctly for stats", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: { total: 500 } },
    };

    const result = await handleToolCall("finance-macro-stats", {});
    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.total, 500);
  });

  it("throws McpError for unknown tool name (no dash)", async () => {
    await assert.rejects(
      () => handleToolCall("unknown_tool", {}),
      (err) => {
        assert.equal(err.code, -32601); // MethodNotFound
        return true;
      }
    );
  });

  it("throws McpError for unknown package", async () => {
    await assert.rejects(
      () => handleToolCall("nonexistent-search", { query: "test" }),
      (err) => {
        assert.equal(err.code, -32601);
        assert.ok(err.message.includes("nonexistent"));
        return true;
      }
    );
  });

  it("throws McpError for invalid action", async () => {
    await assert.rejects(
      () => handleToolCall("startup-intel-batch", { query: "test" }),
      (err) => {
        assert.equal(err.code, -32601);
        assert.ok(err.message.includes("batch"));
        return true;
      }
    );
  });

  it("returns error result when backend call fails", async () => {
    mockFetchResponse = new Error("Connection refused");

    const result = await handleToolCall("startup-intel-stats", {});
    assert.equal(result.isError, true);
    assert.ok(result.content);
    assert.ok(result.content[0].text.includes("Connection refused"));
  });

  it("returns error result for non-200 backend response", async () => {
    mockFetchResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: "something broke",
    };

    const result = await handleToolCall("startup-intel-stats", {});
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("500"));
  });

  it("returns error result for backend failure response", async () => {
    mockFetchResponse = {
      ok: true,
      body: {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      },
    };

    const result = await handleToolCall("startup-intel-stats", {});
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("RATE_LIMITED"));
  });

  it("handles tool names with multiple dashes correctly", () => {
    // handleToolCall splits on last dash
    // "startup-intel-search" → package="startup-intel", action="search" ✓
    // This tests that multi-dash package names work
    const tools = buildToolDefinitions();
    const toolNames = tools.map((t) => t.name);

    // All tools should have format: {pkg-id}-{action}
    for (const name of toolNames) {
      const lastDash = name.lastIndexOf("-");
      const pkgId = name.slice(0, lastDash);
      const action = name.slice(lastDash + 1);
      assert.ok(["search", "detail", "stats"].includes(action));
      assert.ok(PACKAGES.find((p) => p.id === pkgId));
    }
  });
});

/* ══════════════════════════════════════════════
   URL encoding
   ══════════════════════════════════════════════ */
describe("URL encoding", () => {
  it("encodes Chinese characters in query", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: [] },
    };

    await callBackend("startup-intel", "search", { query: "人工智能" });
    const calledUrl = lastFetchUrl;
    assert.ok(calledUrl.includes("q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD"));
  });

  it("encodes special characters in detail ID", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: {} },
    };

    await callBackend("ai-geo", "detail", { id: "abc/def" });
    const calledUrl = lastFetchUrl;
    assert.ok(calledUrl.includes("ai-geo/abc%2Fdef"));
  });

  it("falls back to defaults for null/undefined query params", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: [] },
    };

    // ?? operator fills defaults: page→1, pageSize→10
    await callBackend("startup-intel", "search", {
      query: "test",
      page: undefined,
      pageSize: null,
    });
    const parsedUrl = new URL(lastFetchUrl);
    assert.equal(parsedUrl.searchParams.get("q"), "test");
    assert.equal(parsedUrl.searchParams.get("page"), "1");
    assert.equal(parsedUrl.searchParams.get("limit"), "10");
  });
});

/* ══════════════════════════════════════════════
   Error format
   ══════════════════════════════════════════════ */
describe("error result format", () => {
  it("error result has isError=true and text content", async () => {
    mockFetchResponse = { ok: false, status: 403, statusText: "Forbidden", text: "denied" };

    const result = await handleToolCall("education-stats", {});
    assert.equal(result.isError, true);
    assert.ok(Array.isArray(result.content));
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
  });

  it("success result has isError=false", async () => {
    mockFetchResponse = {
      ok: true,
      body: { success: true, data: {} },
    };

    const result = await handleToolCall("education-stats", {});
    assert.equal(result.isError, false);
  });
});


