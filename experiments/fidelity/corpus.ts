/**
 * Corpus of (id, original_prose) pairs covering diverse technical topics.
 * These represent realistic LLM explanations — the "ground truth" before caveman compression.
 */
export interface CorpusEntry {
  id: string;
  topic: string;
  original: string;
}

export const CORPUS: CorpusEntry[] = [
  {
    id: "react-rerender",
    topic: "React object reference re-render",
    original:
      "Your React component is re-rendering because you are creating a new object reference on each render cycle. " +
      "The inline object property creates a new reference on every render, which causes React to think the props have changed. " +
      "You should wrap the calculation in useMemo to memoize the object and prevent unnecessary re-renders.",
  },
  {
    id: "auth-token",
    topic: "Missing auth token",
    original:
      "The authentication flow is broken because the token is missing from the environment variables. " +
      "You should check the configuration file and make sure the token is set correctly. " +
      "After updating the configuration, restart the server to apply the changes.",
  },
  {
    id: "db-pool",
    topic: "Database connection pool exhaustion",
    original:
      "The database connection pool is being exhausted because each request is opening a new connection without releasing it. " +
      "This is likely caused by missing error handling in the query function, which prevents connections from returning to the pool. " +
      "You should wrap every database call in a try-finally block to ensure connections are always released, " +
      "even when an error occurs.",
  },
  {
    id: "race-condition",
    topic: "Race condition in async code",
    original:
      "There is a race condition in the async code because two promises are resolving and writing to the same variable concurrently. " +
      "This might cause intermittent bugs that are very hard to reproduce in development. " +
      "You should use a mutex or rewrite the logic to avoid shared mutable state.",
  },
  {
    id: "memory-leak",
    topic: "Memory leak in event listener",
    original:
      "The memory leak is caused by an event listener that is added on every component mount but never removed on unmount. " +
      "Over time this causes the browser to accumulate dead references and eventually run out of memory. " +
      "You should return a cleanup function from useEffect that calls removeEventListener.",
  },
  {
    id: "cache-invalidation",
    topic: "Stale cache entries",
    original:
      "The cache entries are stale because the invalidation logic only clears the top-level key but leaves nested entries intact. " +
      "This might cause users to see outdated data for up to the full cache TTL of thirty minutes. " +
      "You should call cache.invalidateAll() or add a version prefix to all cache keys so that stale entries are naturally evicted.",
  },
  {
    id: "cors",
    topic: "CORS misconfiguration",
    original:
      "The CORS error is occurring because the server is not including the correct origin in the Access-Control-Allow-Origin header. " +
      "The frontend is running on port 3000 but the allowed origin is configured for port 8080. " +
      "Update the CORS middleware configuration to include the correct origin, or use a wildcard for local development.",
  },
  {
    id: "jwt-expiry",
    topic: "JWT token expiration handling",
    original:
      "The API is returning 401 errors because the JWT tokens are expiring after one hour and the client is not refreshing them. " +
      "The refresh token endpoint is available but is not being called when the access token expires. " +
      "You should add an interceptor to the HTTP client that detects 401 responses and automatically requests a new access token using the refresh token.",
  },
  {
    id: "event-loop",
    topic: "Event loop blocking",
    original:
      "The server is becoming unresponsive because a synchronous operation is blocking the Node.js event loop. " +
      "The JSON parsing of large payloads is taking over 100 milliseconds, which blocks all other requests from being processed. " +
      "You should either move the parsing to a worker thread or use a streaming JSON parser that processes data incrementally.",
  },
  {
    id: "promise-chain",
    topic: "Unhandled promise rejection",
    original:
      "The unhandled promise rejection is occurring because the error from the inner promise is not being propagated to the outer chain. " +
      "When you nest a promise inside a then callback without returning it, the rejection is swallowed silently. " +
      "You must either return the inner promise or use async-await with a try-catch block to ensure all errors are handled.",
  },
  {
    id: "typescript-narrowing",
    topic: "TypeScript type narrowing failure",
    original:
      "The TypeScript type error occurs because the type guard is checking the property on the wrong level of the nested object. " +
      "The type checker cannot infer the narrowed type across the callback boundary because callbacks introduce a new execution context. " +
      "You should extract the narrowed value into a local variable before passing the callback, or use a non-null assertion if you are certain the value is defined.",
  },
  {
    id: "sql-injection",
    topic: "SQL injection vulnerability",
    original:
      "The SQL injection vulnerability exists because user input is being interpolated directly into the query string. " +
      "An attacker could inject malicious SQL by including quote characters and additional commands in the input. " +
      "You must use parameterized queries or a prepared statement to ensure user input is always treated as data, never as SQL syntax.",
  },
  {
    id: "docker-network",
    topic: "Docker container networking",
    original:
      "The containers cannot communicate because they are on different Docker networks. " +
      "The database container is on the default bridge network while the application container is on a custom network. " +
      "You should add both containers to the same network in the docker-compose file using the networks key.",
  },
  {
    id: "rate-limit",
    topic: "API rate limiting",
    original:
      "The API requests are being throttled because the client is sending more than the allowed one hundred requests per minute. " +
      "The current implementation sends requests in parallel without any throttling, which exhausts the rate limit within a few seconds. " +
      "You should implement exponential backoff with jitter and respect the Retry-After header returned by the API when rate limiting occurs.",
  },
  {
    id: "npm-conflict",
    topic: "npm peer dependency conflict",
    original:
      "The dependency conflict occurs because two packages require incompatible versions of the same peer dependency. " +
      "Package A requires React version 17 while Package B requires React version 18, and npm cannot satisfy both constraints simultaneously. " +
      "You should check if either package has a newer version that supports React 18, or use the overrides field in package.json to force a specific version.",
  },
  {
    id: "websocket",
    topic: "WebSocket reconnection",
    original:
      "The WebSocket connection is dropping because the server is closing idle connections after thirty seconds of inactivity. " +
      "The client is not sending heartbeat messages, so the server cannot distinguish between an idle client and a disconnected one. " +
      "You should implement a ping-pong mechanism where the client sends a ping every twenty seconds and reconnects automatically if a pong is not received within five seconds.",
  },
  {
    id: "git-conflict",
    topic: "Git merge conflict resolution",
    original:
      "The merge conflict occurred because both branches modified the same function in incompatible ways. " +
      "The main branch refactored the function signature while the feature branch added new logic inside the function body. " +
      "You should first understand the intent of both changes, then manually write a version that incorporates both the new signature and the new logic.",
  },
  {
    id: "k8s-pod",
    topic: "Kubernetes pod scheduling failure",
    original:
      "The pod is failing to schedule because the requested CPU and memory resources exceed what is available on any single node. " +
      "The resource request of four CPUs and eight gigabytes of memory cannot be satisfied by the current node pool. " +
      "You should either reduce the resource request in the pod specification or add a larger node to the cluster.",
  },
  {
    id: "css-specificity",
    topic: "CSS specificity override",
    original:
      "The styles are not being applied because a more specific selector in a third-party stylesheet is overriding your rules. " +
      "The third-party rule uses an ID selector which has higher specificity than your class selector. " +
      "You should increase the specificity of your selector by adding the parent component class, or as a last resort use the important declaration.",
  },
  {
    id: "wasm-memory",
    topic: "WebAssembly memory growth",
    original:
      "The WebAssembly module is running out of memory because the linear memory was not allocated with enough initial pages and cannot grow automatically. " +
      "Each page is 64 kilobytes, so the default allocation of one page is insufficient for the data structures being used. " +
      "You should increase the initial memory in the module configuration and optionally set a maximum to prevent unbounded growth.",
  },
];
