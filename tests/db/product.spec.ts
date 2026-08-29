import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProductModel,
  createProduct,
  deleteProductById,
  getProductById,
  getProducts,
  updateProductById,
} from "../../src/db/product";

afterEach(() => vi.restoreAllMocks());

describe("the product schema", () => {
  it("requires a name, a price and an owner", () => {
    const paths = ProductModel.schema.paths;
    expect(paths["name"].options).toMatchObject({
      required: true,
      unique: true,
    });
    expect(paths["price"].options).toMatchObject({ required: true });
    expect(paths["user"].options).toMatchObject({
      required: true,
      ref: "User",
    });
  });

  it("leaves the description optional", () => {
    expect(
      ProductModel.schema.paths["description"].options.required,
    ).toBeUndefined();
  });
});

describe("query helpers", () => {
  it("getProducts populates the owner", () => {
    const populate = vi.fn().mockReturnValue("populated");
    vi.spyOn(ProductModel, "find").mockReturnValue({ populate } as never);

    expect(getProducts()).toBe("populated");
    expect(populate).toHaveBeenCalledWith("user");
  });

  it("getProductById looks up by primary key", () => {
    const findById = vi
      .spyOn(ProductModel, "findById")
      .mockReturnValue("q" as never);

    expect(getProductById("p1")).toBe("q");
    expect(findById).toHaveBeenCalledWith("p1");
  });

  it("deleteProductById deletes the matching document", () => {
    const findOneAndDelete = vi
      .spyOn(ProductModel, "findOneAndDelete")
      .mockReturnValue("q" as never);

    expect(deleteProductById("p1")).toBe("q");
    expect(findOneAndDelete).toHaveBeenCalledWith({ _id: "p1" });
  });

  it("updateProductById applies the given values", () => {
    const findByIdAndUpdate = vi
      .spyOn(ProductModel, "findByIdAndUpdate")
      .mockReturnValue("q" as never);

    expect(updateProductById("p1", { price: 12 })).toBe("q");
    expect(findByIdAndUpdate).toHaveBeenCalledWith("p1", { price: 12 });
  });
});

describe("createProduct", () => {
  it("saves a new document and resolves it as a plain object", async () => {
    const saved = { toObject: () => ({ _id: "p9", name: "Widget" }) };
    vi.spyOn(ProductModel.prototype, "save").mockResolvedValue(saved as never);

    await expect(
      createProduct({ name: "Widget", price: 9.5 }),
    ).resolves.toEqual({ _id: "p9", name: "Widget" });
  });
});
