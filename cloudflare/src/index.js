import { DurableObject } from "cloudflare:workers";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const CONTAINER_PORT = 8080;

const REQUIRED_SECRETS = ["NVIDIA_API_KEY", "PINECONE_API_KEY", "MONGODB_URI", "JWT_SECRET"];

function containerEnv(env) {
  const missing = REQUIRED_SECRETS.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Set these Worker secrets before the API container can start: ${missing.join(", ")}`);
  }

  return {
    PORT: String(CONTAINER_PORT),
    PROJECT_ROOT: "/app",
    NVIDIA_API_KEY: env.NVIDIA_API_KEY,
    NVIDIA_MODEL: env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    NVIDIA_BASE_URL: env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    PINECONE_API_KEY: env.PINECONE_API_KEY,
    PINECONE_INDEX_NAME: env.PINECONE_INDEX_NAME || "miet-jammu-index",
    PINECONE_CLOUD: env.PINECONE_CLOUD || "aws",
    PINECONE_REGION: env.PINECONE_REGION || "us-east-1",
    MONGODB_URI: env.MONGODB_URI,
    MONGODB_DATABASE: env.MONGODB_DATABASE || "miety_ai",
    JWT_SECRET: env.JWT_SECRET,
    CORS_ORIGINS: env.CORS_ORIGINS || "*",
    CORS_ALLOW_VERCEL_PREVIEWS: "false",
    BOOTSTRAP_ADMIN_EMAIL: env.BOOTSTRAP_ADMIN_EMAIL || "",
    BOOTSTRAP_ADMIN_PASSWORD: env.BOOTSTRAP_ADMIN_PASSWORD || "",
    BOOTSTRAP_ADMIN_NAME: env.BOOTSTRAP_ADMIN_NAME || "MIET Administrator",
  };
}

export class ApiContainer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.starting = undefined;
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
    }
  }

  async fetch(request) {
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container.getTcpPort(CONTAINER_PORT).fetch(forwarded);
  }

  async startAndWaitForPort() {
    const container = this.ctx.container;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: containerEnv(this.env),
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    const port = container.getTcpPort(CONTAINER_PORT);
    let lastError;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await port.fetch("http://container/health", {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`);
        }
        return;
      } catch (error) {
        lastError = error;
        await scheduler.wait(2000);
      }
    }
    throw new Error("The API container did not become ready on port 8080", { cause: lastError });
  }
}

export default {
  async fetch(request, env) {
    return env.API_CONTAINER.getByName("miety-api").fetch(request);
  },
};
