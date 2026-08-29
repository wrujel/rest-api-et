import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
} from "../../src/controllers/products";
import {
  createProduct as insertProduct,
  deleteProductById,
  getProductById as findProductById,
  getProducts,
  updateProductById,
} from "../../src/db/product";
import { createRequest, createResponse } from "../support/http";
import { failingQuery, queryDouble } from "../support/query";

vi.mock("../../src/db/product", () => ({
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  createProduct: vi.fn(),
  deleteProductById: vi.fn(),
  updateProductById: vi.fn(),
}));

const mockedGetProducts = vi.mocked(getProducts);
const mockedFindProductById = vi.mocked(findProductById);
const mockedInsertProduct = vi.mocked(insertProduct);
const mockedDeleteProductById = vi.mocked(deleteProductById);
const mockedUpdateProductById = vi.mocked(updateProductById);

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("getAllProducts", () => {
  it("flattens the populated owner onto each product", async () => {
    mockedGetProducts.mockReturnValue(
      queryDouble([
        {
          _id: "p1",
          name: "Widget",
          description: "A widget",
          price: 9.5,
          user: { username: "ada", email: "ada@example.com" },
        },
      ]) as never,
    );

    const res = createResponse();
    await getAllProducts(createRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: "p1",
        name: "Widget",
        description: "A widget",
        price: 9.5,
        username: "ada",
        email: "ada@example.com",
      },
    ]);
  });

  it("returns an empty list when there are no products", async () => {
    mockedGetProducts.mockReturnValue(queryDouble([]) as never);

    const res = createResponse();
    await getAllProducts(createRequest(), res);

    expect(res.body).toEqual([]);
  });

  it("400s and logs when the query blows up", async () => {
    mockedGetProducts.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await getAllProducts(createRequest(), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("getProductById", () => {
  it("returns the product for a known id", async () => {
    const product = { _id: "p1", name: "Widget" };
    mockedFindProductById.mockReturnValue(queryDouble(product) as never);

    const res = createResponse();
    await getProductById(createRequest({ params: { id: "p1" } }), res);

    expect(mockedFindProductById).toHaveBeenCalledWith("p1");
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(product);
  });

  it("404s for an unknown id", async () => {
    mockedFindProductById.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await getProductById(createRequest({ params: { id: "nope" } }), res);

    expect(res.sentStatus).toBe(404);
  });

  it("400s and logs when the query blows up", async () => {
    mockedFindProductById.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await getProductById(createRequest({ params: { id: "p1" } }), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("createProduct", () => {
  const authenticated = (body: Record<string, unknown>) =>
    Object.assign(createRequest({ body }), { identity: { _id: "user-1" } });

  it("stamps the caller as the owner and returns the new id", async () => {
    mockedInsertProduct.mockResolvedValue({ _id: "p9" } as never);

    const res = createResponse();
    await createProduct(authenticated({ name: "Widget", price: 9.5 }), res);

    expect(mockedInsertProduct).toHaveBeenCalledWith({
      name: "Widget",
      price: 9.5,
      user: "user-1",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: "p9" });
  });

  it("400s and logs when the insert blows up", async () => {
    mockedInsertProduct.mockRejectedValue(new Error("duplicate key"));

    const res = createResponse();
    await createProduct(authenticated({ name: "Widget" }), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("deleteProduct", () => {
  it("deletes by id and answers 204", async () => {
    mockedDeleteProductById.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await deleteProduct(createRequest({ query: { id: "p1" } }), res);

    expect(mockedDeleteProductById).toHaveBeenCalledWith("p1");
    expect(res.sentStatus).toBe(204);
  });

  it("400s when no id is supplied", async () => {
    const res = createResponse();
    await deleteProduct(createRequest(), res);

    expect(res.sentStatus).toBe(400);
    expect(mockedDeleteProductById).not.toHaveBeenCalled();
  });

  it("400s and logs when the delete blows up", async () => {
    mockedDeleteProductById.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await deleteProduct(createRequest({ query: { id: "p1" } }), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("updateProduct", () => {
  it("applies the body to the identified product", async () => {
    mockedUpdateProductById.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await updateProduct(
      createRequest({ query: { id: "p1" }, body: { price: 12 } }),
      res,
    );

    expect(mockedUpdateProductById).toHaveBeenCalledWith("p1", { price: 12 });
    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(true);
  });

  it("400s when no id is supplied", async () => {
    const res = createResponse();
    await updateProduct(createRequest({ body: { price: 12 } }), res);

    expect(res.sentStatus).toBe(400);
    expect(mockedUpdateProductById).not.toHaveBeenCalled();
  });

  it("400s and logs when the update blows up", async () => {
    mockedUpdateProductById.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await updateProduct(
      createRequest({ query: { id: "p1" }, body: { price: 12 } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});
