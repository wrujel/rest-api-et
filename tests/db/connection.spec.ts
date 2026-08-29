import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

vi.mock("mongoose", () => {
  const connect = vi.fn();
  const disconnect = vi.fn();
  const on = vi.fn();
  return {
    default: { connect, disconnect, connection: { on }, Promise: undefined },
  };
});

const mockedConnect = vi.mocked(mongoose.connect);
const mockedDisconnect = vi.mocked(mongoose.disconnect);
const mockedOn = vi.mocked(mongoose.connection.on);

/**
 * The module memoises its connection promise, so each test imports a fresh
 * copy rather than inheriting the previous test's cached connection.
 */
const loadModule = async () => {
  vi.resetModules();
  return import("../../src/db/connection");
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedConnect.mockResolvedValue(mongoose as never);
  delete process.env.MONGO_URL;
});

describe("connectDatabase", () => {
  it("connects with the supplied uri and registers an error listener", async () => {
    const { connectDatabase } = await loadModule();

    connectDatabase("mongodb://localhost/test");

    expect(mockedConnect).toHaveBeenCalledWith("mongodb://localhost/test");
    expect(mockedOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mongoose.Promise).toBe(Promise);
  });

  it("falls back to MONGO_URL", async () => {
    process.env.MONGO_URL = "mongodb://from-env/test";
    const { connectDatabase } = await loadModule();

    connectDatabase();

    expect(mockedConnect).toHaveBeenCalledWith("mongodb://from-env/test");
  });

  it("connects once and hands the same promise back on later calls", async () => {
    const { connectDatabase } = await loadModule();

    const first = connectDatabase("mongodb://localhost/test");
    const second = connectDatabase("mongodb://localhost/test");

    expect(second).toBe(first);
    expect(mockedConnect).toHaveBeenCalledTimes(1);
  });

  it("throws when no uri is configured", async () => {
    const { connectDatabase } = await loadModule();

    expect(() => connectDatabase()).toThrow(/MONGO_URL is not set/);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("logs connection errors as they arrive", async () => {
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const { connectDatabase } = await loadModule();

    connectDatabase("mongodb://localhost/test");
    const listener = mockedOn.mock.calls[0][1] as (error: Error) => void;
    const failure = new Error("connection lost");
    listener(failure);

    expect(consoleLog).toHaveBeenCalledWith(failure);
  });
});

describe("disconnectDatabase", () => {
  it("is a no-op when nothing ever connected", async () => {
    const { disconnectDatabase } = await loadModule();

    await disconnectDatabase();

    expect(mockedDisconnect).not.toHaveBeenCalled();
  });

  it("closes the connection and lets a later call reconnect", async () => {
    const { connectDatabase, disconnectDatabase } = await loadModule();

    connectDatabase("mongodb://localhost/test");
    await disconnectDatabase();

    expect(mockedDisconnect).toHaveBeenCalledOnce();

    connectDatabase("mongodb://localhost/test");
    expect(mockedConnect).toHaveBeenCalledTimes(2);
  });
});
