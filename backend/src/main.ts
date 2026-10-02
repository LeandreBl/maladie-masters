import { ValidationPipe, type RawBodyRequest } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { IncomingMessage } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AppExceptionFilter } from "./common/app-exception.filter";
import { setupSwagger } from "./common/swagger/swagger.setup";
import { getEnvOrExit } from "./config/env";

function stripPort(host: string): string {
  if (host.startsWith("[")) {
    const ipv6End = host.indexOf("]");
    return ipv6End === -1 ? host : host.slice(1, ipv6End);
  }

  return host.split(":")[0] ?? host;
}

function isHostAllowed(requestHost: string, allowedHosts: string[]): boolean {
  const normalizedHost = requestHost.trim().toLowerCase();
  const hostname = stripPort(normalizedHost);

  return allowedHosts.some((allowedHost) => {
    if (allowedHost === normalizedHost || allowedHost === hostname) {
      return true;
    }

    if (allowedHost.startsWith(".")) {
      const suffix = allowedHost.slice(1);
      return hostname === suffix || hostname.endsWith(allowedHost);
    }

    return false;
  });
}

async function bootstrap() {
  // Before Nest: a wrong variable stops here with a readable report.
  const env = getEnvOrExit();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.useGlobalFilters(new AppExceptionFilter());

  const allowedHosts = env.BACKEND_ALLOWED_HOSTS;
  if (allowedHosts.length > 0) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const host = request.headers.host;

      if (!host || !isHostAllowed(host, allowedHosts)) {
        response.status(403).json({ message: "Host is not allowed" });
        return;
      }

      next();
    });
  }

  // Behind a reverse proxy, `request.ip` is the proxy's address and the rate
  // limit counts everyone together. Only enable it when a trusted proxy really
  // rewrites X-Forwarded-For: otherwise anyone picks their own address, and so
  // their own counter.
  if (env.TRUST_PROXY !== false) {
    app.set("trust proxy", env.TRUST_PROXY);
  }

  // CSP disabled globally: the API returns JSON, and Swagger UI needs inline
  // scripts and styles. The few routes that return user-supplied bytes set their
  // own, far stricter policy.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Discord signs the exact bytes it sends: its endpoint keeps them aside, since
  // re-serializing the parsed JSON would not give them back.
  app.use(
    json({
      limit: "10mb",
      verify: (request: RawBodyRequest<IncomingMessage>, _response, buffer) => {
        if (request.url?.startsWith("/v1/discord/interactions")) request.rawBody = buffer;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: "10mb" }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // The documentation publishes the whole API surface: routes, DTOs, role
  // semantics. Useful in development, pointless to hand out in production.
  if (env.SWAGGER_ENABLED || env.NODE_ENV !== "production") {
    setupSwagger(app, env.BACKEND_PUBLIC_URL);
  } else {
    logger.log("Swagger is disabled (set SWAGGER_ENABLED=true to serve it)");
  }

  // Always an explicit list: `true` would reflect any caller's origin.
  app.enableCors({ origin: env.FRONTEND_ORIGIN });

  await app.listen(env.PORT, "0.0.0.0");
}

void bootstrap();
