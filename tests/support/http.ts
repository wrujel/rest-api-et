import type express from "express";
import { vi } from "vitest";

/**
 * A response double that records what a handler did. Every terminal method
 * returns `this` so the `res.status(200).json(...)` chains under test keep
 * working, and the assertions read off the recorded fields.
 */
export interface ResponseDouble extends express.Response {
  statusCode: number;
  body: unknown;
  sentStatus: number | null;
  cookies: Record<string, { value: string; options: unknown }>;
  clearedCookies: string[];
  redirectedTo: string | null;
  ended: boolean;
}

export const createResponse = (): ResponseDouble => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    sentStatus: null as number | null,
    cookies: {} as Record<string, { value: string; options: unknown }>,
    clearedCookies: [] as string[],
    redirectedTo: null as string | null,
    ended: false,
  } as unknown as ResponseDouble;

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as ResponseDouble["status"];

  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as ResponseDouble["json"];

  res.send = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as ResponseDouble["send"];

  res.sendStatus = vi.fn((code: number) => {
    res.sentStatus = code;
    res.statusCode = code;
    return res;
  }) as unknown as ResponseDouble["sendStatus"];

  res.cookie = vi.fn((name: string, value: string, options?: unknown) => {
    res.cookies[name] = { value, options };
    return res;
  }) as unknown as ResponseDouble["cookie"];

  res.clearCookie = vi.fn((name: string) => {
    res.clearedCookies.push(name);
    return res;
  }) as unknown as ResponseDouble["clearCookie"];

  res.redirect = vi.fn((location: string) => {
    res.redirectedTo = location;
  }) as unknown as ResponseDouble["redirect"];

  res.end = vi.fn(() => {
    res.ended = true;
    return res;
  }) as unknown as ResponseDouble["end"];

  res.sendFile = vi.fn() as unknown as ResponseDouble["sendFile"];

  return res;
};

/** A request double carrying only the fields the handlers actually read. */
export const createRequest = <T extends Partial<express.Request>>(
  overrides: T = {} as T
) =>
  ({
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ...overrides,
  }) as unknown as express.Request;
