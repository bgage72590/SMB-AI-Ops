import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __resetDbForTests,
  createUserRow,
  upsertContact,
} from "./store";
import { hashPassword } from "./auth";
import { searchWorkspace } from "./search";

let tmpDir: string;
let userId: string;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv.SMB_AI_OPS_DATA_DIR = process.env.SMB_AI_OPS_DATA_DIR;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-search-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  const user = createUserRow({
    email: `u-${Date.now()}@example.test`,
    name: "Searcher",
    passwordHash: hashPassword("pw-12345678"),
  });
  userId = user.id;
});

afterEach(() => {
  __resetDbForTests();
  if (savedEnv.SMB_AI_OPS_DATA_DIR === undefined) {
    delete process.env.SMB_AI_OPS_DATA_DIR;
  } else {
    process.env.SMB_AI_OPS_DATA_DIR = savedEnv.SMB_AI_OPS_DATA_DIR;
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe("searchWorkspace", () => {
  it("returns empty for short queries", () => {
    upsertContact(userId, { name: "Jordan Riggs", email: "j@acme.co" });
    expect(searchWorkspace(userId, "j")).toEqual([]);
    expect(searchWorkspace(userId, "")).toEqual([]);
  });

  it("finds contacts by name prefix", () => {
    upsertContact(userId, { name: "Jordan Riggs", email: "jordan@acme.co", company: "Acme" });
    upsertContact(userId, { name: "Casey Lin", email: "casey@example.com" });
    const hits = searchWorkspace(userId, "jordan");
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("contact");
    expect(hits[0].title).toBe("Jordan Riggs");
    expect(hits[0].href).toBe(`/contacts/${hits[0].id}`);
  });

  it("finds contacts by company substring", () => {
    upsertContact(userId, { name: "Sam Z", email: "sam@bigco.com", company: "BigCo Industries" });
    const hits = searchWorkspace(userId, "bigco");
    expect(hits.some((h) => h.title === "Sam Z")).toBe(true);
  });

  it("scopes results to the passed userId", () => {
    const otherUser = createUserRow({
      email: `other-${Date.now()}@example.test`,
      name: "Other",
      passwordHash: hashPassword("pw-12345678"),
    });
    upsertContact(userId, { name: "Visible", email: "v@x.io" });
    upsertContact(otherUser.id, { name: "Hidden", email: "h@x.io" });

    const hits = searchWorkspace(userId, "hidden");
    expect(hits).toEqual([]);
    const ok = searchWorkspace(userId, "visible");
    expect(ok).toHaveLength(1);
  });
});
