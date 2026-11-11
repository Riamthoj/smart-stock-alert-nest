export const EXAMPLE_STORE_ID = '01a1b971-0000-7000-8000-000000000001';
export const EXAMPLE_PRODUCT_ID = '01a1b971-0000-7000-8000-000000000002';
export const EXAMPLE_OWNER_ID = '01a1b971-0000-7000-8000-000000000003';

/**
 * Two ready-made bodies for a create endpoint in /docs (Swagger shows a dropdown):
 *   owner login -> no store_id (taken from the token)
 *   admin login -> store_id required
 *
 *   @ApiBody({ type: ProductCreateDto, examples: createExamples({ name: 'Coke' }) })
 */
export function createExamples(body: Record<string, unknown>) {
  return {
    owner: { summary: 'Owner login (store_id comes from your token)', value: body },
    admin: { summary: 'User/admin login (store_id required)', value: { store_id: EXAMPLE_STORE_ID, ...body } },
  };
}
