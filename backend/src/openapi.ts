import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { buildOpenApiDocument } from "./common/swagger/swagger.setup";
import { EnvValidationError, getEnvVariable } from "./config/env";

/**
 * Writes the OpenAPI document to a file so clients and agents can be generated
 * from it without running the API.
 *
 * The application is created in preview mode: Nest builds the module graph and
 * registers the routes but never instantiates the providers, so this needs no
 * PostgreSQL, no Redis and no Firebase credentials — and, of the environment,
 * only BACKEND_PUBLIC_URL.
 */
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  try {
    const document = buildOpenApiDocument(
      app,
      getEnvVariable("BACKEND_PUBLIC_URL"),
    );
    const target = resolve(process.argv[2] ?? "openapi.json");

    await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");

    const operations = Object.values(document.paths).reduce(
      (total, path) => total + Object.keys(path).length,
      0,
    );
    const schemas = Object.keys(document.components?.schemas ?? {}).length;

    process.stdout.write(
      `${target}: ${operations} operations, ${schemas} schemas\n`,
    );
  } finally {
    await app.close();
  }
}

void generate().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof EnvValidationError ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
