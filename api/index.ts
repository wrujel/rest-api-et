// Vercel serves every file in this directory as a Node function. The handler
// itself lives in `src/` so it is type-checked by `pnpm run typecheck` and
// covered by the test suite alongside the rest of the API.
export { default } from "../src/serverless";
