// First import so every module below sees a populated `process.env`.
import "dotenv/config";

import { createApp } from "./app";
import { connectDatabase } from "./db/connection";

const PORT = Number(process.env.PORT) || 8080;

const app = createApp();

connectDatabase();

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

export default app;
