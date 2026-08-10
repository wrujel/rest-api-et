export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiParamDoc {
  name: string;
  in: 'query' | 'body';
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface ApiResponseDoc {
  status: number;
  description: string;
  example?: string;
}

export interface ApiEndpointDoc {
  id: string;
  method: ApiMethod;
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  ownerOnly?: boolean;
  params: ApiParamDoc[];
  bodyExample?: string;
  responses: ApiResponseDoc[];
  curl: string;
}

export const PRODUCT_ENDPOINTS: ApiEndpointDoc[] = [
  {
    id: 'products-list',
    method: 'GET',
    path: '/api/products',
    summary: 'List all products',
    description:
      'Returns every product in the catalog, each with its owner\'s username and email attached.',
    auth: true,
    params: [],
    responses: [
      {
        status: 200,
        description: 'Array of products.',
        example: `[
  {
    "id": "665f1c2e8b1a2c3d4e5f6a7b",
    "name": "Mechanical keyboard",
    "description": "Hot-swappable, 75% layout",
    "price": 129.99,
    "username": "ada",
    "email": "ada@example.com"
  }
]`,
      },
      { status: 401, description: 'Missing or invalid access token.' },
    ],
    curl: `curl -X GET http://localhost:8080/api/products \\
  -H "Authorization: Bearer <accessToken>"`,
  },
  {
    id: 'products-create',
    method: 'POST',
    path: '/api/products',
    summary: 'Create a product',
    description:
      'Creates a product owned by the authenticated user. The name must be unique across the catalog.',
    auth: true,
    params: [
      { name: 'name', in: 'body', type: 'string', required: true, description: 'Product name. Must be unique.', example: '"Mechanical keyboard"' },
      { name: 'price', in: 'body', type: 'number', required: true, description: 'Unit price in USD.', example: '129.99' },
      { name: 'description', in: 'body', type: 'string', required: false, description: 'Free-form description.', example: '"Hot-swappable, 75% layout"' },
    ],
    bodyExample: `{
  "name": "Mechanical keyboard",
  "price": 129.99,
  "description": "Hot-swappable, 75% layout"
}`,
    responses: [
      {
        status: 201,
        description: 'Product created. Returns the new product id.',
        example: `{
  "id": "665f1c2e8b1a2c3d4e5f6a7b"
}`,
      },
      { status: 400, description: 'Invalid body, or the name is taken.' },
      { status: 401, description: 'Missing or invalid access token.' },
    ],
    curl: `curl -X POST http://localhost:8080/api/products \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Mechanical keyboard", "price": 129.99, "description": "Hot-swappable, 75% layout" }'`,
  },
  {
    id: 'products-update',
    method: 'PUT',
    path: '/api/products?id={productId}',
    summary: 'Update a product',
    description:
      'Replaces the given fields of a product. Only the product\'s owner can update it.',
    auth: true,
    ownerOnly: true,
    params: [
      { name: 'id', in: 'query', type: 'string', required: true, description: 'ID of the product to update.', example: '665f1c2e8b1a2c3d4e5f6a7b' },
      { name: 'name', in: 'body', type: 'string', required: false, description: 'New name.', example: '"Mechanical keyboard v2"' },
      { name: 'price', in: 'body', type: 'number', required: false, description: 'New price.', example: '109.99' },
      { name: 'description', in: 'body', type: 'string', required: false, description: 'New description.', example: '"Now with silent switches"' },
    ],
    bodyExample: `{
  "price": 109.99
}`,
    responses: [
      { status: 200, description: 'Product updated (empty body).' },
      { status: 400, description: 'Missing id or invalid body.' },
      { status: 401, description: 'Missing or invalid access token.' },
      { status: 403, description: 'You are not the product owner.' },
      { status: 404, description: 'Product not found.' },
    ],
    curl: `curl -X PUT "http://localhost:8080/api/products?id=<productId>" \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{ "price": 109.99 }'`,
  },
  {
    id: 'products-delete',
    method: 'DELETE',
    path: '/api/products?id={productId}',
    summary: 'Delete a product',
    description: 'Permanently removes a product. Only the product\'s owner can delete it.',
    auth: true,
    ownerOnly: true,
    params: [
      { name: 'id', in: 'query', type: 'string', required: true, description: 'ID of the product to delete.', example: '665f1c2e8b1a2c3d4e5f6a7b' },
    ],
    responses: [
      { status: 204, description: 'Product deleted.' },
      { status: 400, description: 'Missing id.' },
      { status: 401, description: 'Missing or invalid access token.' },
      { status: 403, description: 'You are not the product owner.' },
      { status: 404, description: 'Product not found.' },
    ],
    curl: `curl -X DELETE "http://localhost:8080/api/products?id=<productId>" \\
  -H "Authorization: Bearer <accessToken>"`,
  },
];
