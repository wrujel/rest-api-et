import mongoose from "mongoose";

/**
 * The single connection promise for the process. Serverless invocations share
 * one container across requests, so a second `connect()` would open a second
 * pool against the same cluster — caching the promise keeps it at one.
 */
let connection: Promise<typeof mongoose> | null = null;

export const connectDatabase = (
  uri: string | undefined = process.env.MONGO_URL
): Promise<typeof mongoose> => {
  if (!connection) {
    if (!uri) {
      throw new Error("MONGO_URL is not set; cannot connect to MongoDB.");
    }
    mongoose.Promise = Promise;
    mongoose.connection.on("error", (error: Error) => console.log(error));
    connection = mongoose.connect(uri);
  }
  return connection;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!connection) return;
  connection = null;
  await mongoose.disconnect();
};
