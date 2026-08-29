import { beforeEach, describe, expect, it, vi } from "vitest";

// The module builds its app as an import side effect, so the doubles have to be
// in place before it is ever loaded.
const { createApp, connectDatabase } = vi.hoisted(() => ({
  createApp: vi.fn(),
  connectDatabase: vi.fn(),
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("../src/app", () => ({ createApp }));
vi.mock("../src/db/connection", () => ({ connectDatabase }));

const app = { name: "express-app" };

const loadHandler = async () => {
  vi.resetModules();
  return import("../src/serverless");
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  createApp.mockReturnValue(app);
  connectDatabase.mockReturnValue(Promise.resolve());
});

describe("the serverless handler", () => {
  it("warms the database connection and exports the app", async () => {
    const module = await loadHandler();

    expect(connectDatabase).toHaveBeenCalledOnce();
    expect(createApp).toHaveBeenCalledOnce();
    expect(module.default).toBe(app);
  });

  it("still serves when the database is not configured", async () => {
    const failure = new Error(
      "MONGO_URL is not set; cannot connect to MongoDB.",
    );
    connectDatabase.mockImplementation(() => {
      throw failure;
    });

    const module = await loadHandler();

    expect(consoleError).toHaveBeenCalledWith(failure);
    expect(module.default).toBe(app);
  });
});
