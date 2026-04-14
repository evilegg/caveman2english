/**
 * Verbose corpus for Gilfoyle v3 benchmark.
 *
 * 12 entries of realistic verbose LLM/corporate output: postmortems, incident
 * reports, design-doc excerpts, and long explanations.  These entries contain
 * the phrase-level patterns that v3 targets: verbose connectives, genitive
 * constructions, nominalised verbs, quantifier bloat, and `it is X that Y`
 * constructions.
 *
 * Each entry is 80–160 words — roughly twice the density of the benchmark corpus.
 */

import type { CorpusEntry } from "../fidelity/corpus.js";

export const VERBOSE_CORPUS: CorpusEntry[] = [
  {
    id: "postmortem-db",
    topic: "Database outage postmortem",
    original:
      "It is important to note that the exhaustion of the connection pool was the primary contributing factor to the degradation of service quality that was experienced by users during the incident window. " +
      "Due to the fact that each of the incoming requests was opening a new connection without subsequently releasing it back to the pool, the entirety of available connections were consumed within a period of approximately thirty seconds. " +
      "The lack of proper error handling in the query function was identified as a contributing factor, in that it was preventing connections from returning to the pool in the event that an exception was thrown. " +
      "With respect to remediation, it is the case that you should wrap every database call in a try-finally block in order to ensure that connections are always released, even in the event that an error occurs.",
  },
  {
    id: "postmortem-deploy",
    topic: "Failed deployment postmortem",
    original:
      "At this point in time, the root cause of the deployment failure has been identified as a misconfiguration of the load balancer that was put in place during the migration of the service to the new infrastructure. " +
      "It is worth noting that the configuration of the health check endpoint was not updated to reflect the new port assignment, which gave rise to a situation in which the load balancer was routing traffic to instances that were in the process of starting up. " +
      "Due to the fact that a large number of requests were being directed to unhealthy instances, users experienced degradation for a period of approximately forty-five minutes. " +
      "In order for this type of issue to be prevented in the near future, it is the case that the deployment checklist needs to be updated to include a verification step for load balancer configuration.",
  },
  {
    id: "incident-cache",
    topic: "Cache invalidation incident",
    original:
      "With regard to the cache invalidation issue that was reported, it is important to understand that the behavior of the caching layer is such that entries are not automatically evicted when the underlying data is modified. " +
      "In the event that a write operation is performed without a corresponding cache invalidation call, it is the case that subsequent read operations will return stale data for a period of time equal to the time-to-live configuration of the cache entry. " +
      "With respect to the impact on users, it is worth noting that a subset of users may have received outdated information during the incident window of approximately two hours. " +
      "For the purpose of preventing recurrence, make use of cache-aside pattern and perform a check on the invalidation logic after each write.",
  },
  {
    id: "design-auth",
    topic: "Auth middleware design doc",
    original:
      "It is the case that the current implementation of the authentication middleware does not take into account the possibility that the JWT token may have been revoked prior to its natural expiration. " +
      "In the event that a token is revoked, the middleware continues to allow requests through for the entirety of the remaining token validity period, which in the case of long-lived tokens may be a number of hours. " +
      "With respect to the remediation of this issue, it is important to note that the implementation of a token revocation list would give rise to an additional database lookup on each request, which may have an impact on overall latency. " +
      "In order to avoid the performance implications of a database lookup, make use of a short-lived token strategy in combination with a refresh token mechanism.",
  },
  {
    id: "design-queue",
    topic: "Message queue design doc",
    original:
      "Due to the fact that the current architecture makes use of a synchronous request-response pattern for the purpose of inter-service communication, the majority of services are tightly coupled to one another in terms of availability. " +
      "In the event that a downstream service experiences degradation, it is the case that the upstream caller will block for a period equal to the timeout configuration, which in the case of cascading failures may give rise to a situation in which the entirety of the request-handling capacity of the system is consumed by waiting threads. " +
      "With regard to the proposed migration to an asynchronous message queue, it is worth noting that the configuration of retry semantics and dead-letter queues is essential in order to ensure that messages are not lost in the event of processing failure.",
  },
  {
    id: "incident-memory",
    topic: "Memory leak incident",
    original:
      "It is important to note that the memory leak that was identified in the worker process is the result of the accumulation of event listener registrations that are not being removed when the associated component is unmounted. " +
      "Due to the fact that each of the component instances is registering a listener on the global event emitter without a corresponding deregistration in the cleanup function, the entirety of the listener references are being retained in memory for the duration of the process lifecycle. " +
      "With respect to the identification of this issue, it is the case that the memory usage of the worker process was growing at a rate of approximately eight megabytes per minute, which gave rise to an out-of-memory condition after a period of approximately two hours. " +
      "In order to ensure that this type of issue does not recur, make use of the cleanup function to remove all event listeners when a component is unmounted.",
  },
  {
    id: "incident-race",
    topic: "Race condition incident",
    original:
      "With regard to the data corruption that was reported, it is the case that the root cause has been identified as a race condition in the order processing logic that gives rise to a situation in which a large number of concurrent requests may attempt to decrement the inventory count at the same time. " +
      "Due to the fact that the current implementation does not make use of a locking mechanism for the purpose of protecting the shared state, it is possible that two or more requests may read the same inventory value and each independently carry out a decrement operation. " +
      "In the event that this occurs, it is the case that the final inventory count will be incorrect by a number equal to the number of concurrent requests minus one. " +
      "In order to prevent this type of data corruption from occurring on a regular basis, implement a database-level row lock or make use of an optimistic concurrency control pattern.",
  },
  {
    id: "design-cors",
    topic: "CORS policy design doc",
    original:
      "It is important to note that the configuration of the CORS policy has a direct impact on the security posture of the API and should not be treated as a purely technical matter. " +
      "In the event that the wildcard origin is used in production, it is the case that any web application hosted on any domain will be able to make cross-origin requests to the API with the credentials of the authenticated user. " +
      "With respect to the remediation of overly permissive CORS configurations, it is worth noting that the implementation of an allowlist of trusted origins is the recommended approach for the purpose of reducing the attack surface. " +
      "Due to the fact that the configuration of the allowlist requires knowledge of all client origins, it is the case that the deployment process needs to be updated to include a step for the validation of the origin configuration.",
  },
  {
    id: "incident-timeout",
    topic: "Timeout cascade incident",
    original:
      "At the current time, the root cause of the cascading timeout failures has been identified as a misconfiguration of the connection timeout value in the HTTP client used by the payment processing service. " +
      "Due to the fact that the timeout was set to a value of thirty seconds rather than the recommended value of five seconds, each of the failed payment requests was occupying a thread for a period of thirty seconds before the timeout was triggered. " +
      "With respect to the impact on other services, it is the case that the exhaustion of the thread pool gave rise to a situation in which all of the incoming requests to the payment service were queued, which in turn caused a large number of timeouts in the upstream services that were waiting for a response. " +
      "In order to prevent this type of cascading failure on a regular basis, put in place a circuit breaker pattern and perform a review of all timeout configurations.",
  },
  {
    id: "design-logging",
    topic: "Logging strategy design doc",
    original:
      "It is the case that the current logging implementation does not take into account the performance implications of synchronous log writes in the hot path of request processing. " +
      "Due to the fact that each log statement results in a synchronous write to the filesystem, it is the case that the accumulation of log statements in high-traffic code paths has an impact on the overall throughput of the service. " +
      "With regard to the remediation of this issue, it is worth noting that the implementation of an asynchronous logging buffer would give rise to a significant reduction in the impact of logging on request latency, with the trade-off that a subset of log entries may be lost in the event of an unexpected process termination. " +
      "For the purpose of balancing performance and observability, make use of a structured logging library that provides support for asynchronous writes with configurable flush intervals.",
  },
  {
    id: "postmortem-k8s",
    topic: "Kubernetes pod eviction postmortem",
    original:
      "It is important to note that the eviction of the majority of the application pods during the incident was the result of the configuration of the memory limits being set at a value that was insufficient to accommodate the growth in memory usage that occurs during peak traffic periods. " +
      "Due to the fact that the configuration of the resource limits was carried out at the time of initial deployment without taking into account the variation in memory usage over time, it is the case that the pods were consistently operating close to the limit during periods of elevated traffic. " +
      "In the event that the memory usage of a pod exceeds its configured limit, the Kubernetes scheduler will carry out an eviction of the pod, which gives rise to a brief period of unavailability until a replacement pod is started. " +
      "With respect to the prevention of recurrence, put in place a monitoring alert for memory usage that fires at eighty percent of the configured limit.",
  },
  {
    id: "incident-sql",
    topic: "SQL injection incident",
    original:
      "It is worth noting that the SQL injection vulnerability that was identified in the search endpoint is the result of the interpolation of user-supplied input directly into the query string without the use of parameterized queries. " +
      "Due to the fact that the query builder is making use of string concatenation for the purpose of constructing the query, it is the case that an attacker is able to inject malicious SQL by including quote characters and additional SQL commands in the search parameter. " +
      "With respect to the severity of this vulnerability, it is important to note that the entirety of the database contents may be accessible to an attacker who is able to carry out a successful injection attack. " +
      "In order to remediate this vulnerability, make use of parameterized queries or a prepared statement for the purpose of ensuring that user input is always treated as data and never as SQL syntax.",
  },
];
