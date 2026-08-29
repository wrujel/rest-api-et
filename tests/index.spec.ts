import { beforeEach, describe, expect, it, vi } from "vitest";

// The bootstrap module runs its work as an import side effect, so the doubles
// have to be in place before it is ever loaded.
const { listen, createApp, connectDatabase } = vi.hoisted(() => ({
  listen: vi.fn((_port: number, callback: () => void) => callback()),
  createApp: vi.fn(),
  connectDatabase: vi.fn(),
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("../src/app", () => ({ createApp }));
vi.mock("../src/db/connection", () => ({ connectDatabase }));

const app = { listen };

const loadBootstrap = async () => {
  vi.resetModules();
  return import("../src/index");
};

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
  createApp.mockReturnValue(app);
  delete process.env.PORT;
});

describe("the server bootstrap", () => {
  it("builds the app, connects to Mongo and listens on the default port", async () => {
    const module = await loadBootstrap();

    expect(createApp).toHaveBeenCalledOnce();
    expect(connectDatabase).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledWith(8080, expect.any(Function));
    expect(consoleLog).toHaveBeenCalledWith(
      "Server is listening on http://localhost:8080",
    );
    expect(module.default).toBe(app);
  });

  it("honours PORT from the environment", async () => {
    process.env.PORT = "3000";

    await loadBootstrap();

    expect(listen).toHaveBeenCalledWith(3000, expect.any(Function));
  });

  it("falls back to the default port when PORT is not a number", async () => {
    process.env.PORT = "not-a-port";

    await loadBootstrap();

    expect(listen).toHaveBeenCalledWith(8080, expect.any(Function));
  });
});
