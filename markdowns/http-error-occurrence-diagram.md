# HTTP Status Error Occurrence Diagram

This diagram shows how the project surfaces the main HTTP error codes (`400`, `401`, `403`, `404`, `500`, `502`, `503`) across request flow layers.

```mermaid
flowchart TD
    A[Client Request] --> B{Route validation ok?}
    B -- No --> E400[400 Bad Request\nMissing/invalid payload, params, or JSON]
    B -- Yes --> C{Auth/session valid?}
    C -- No --> E401[401 Unauthorized\nMissing/invalid bearer token or expired session]
    C -- Yes --> D{Permission or URL policy ok?}
    D -- No --> E403[403 Forbidden\nAPI key rejected or disallowed proxy target URL]
    D -- Yes --> E{Resource exists?}
    E -- No --> E404[404 Not Found\nEntity/job/endpoint missing]
    E -- Yes --> F[Service Layer Processing]

    F --> G{Infra/config healthy?}
    G -- No --> E503[503 Service Unavailable\nMissing required API key/service unreachable]
    G -- Yes --> H{Unhandled internal exception?}
    H -- Yes --> E500[500 Internal Server Error\nUnexpected server failure or missing env setup]
    H -- No --> I{Upstream provider succeeded?\n(OpenAI/Meshy/RunPod/Replicate)}
    I -- No --> E502[502 Bad Gateway\nUpstream returned error/invalid response]
    I -- Yes --> OK[2xx Success Response]

    subgraph Typical sources in this repo
      S1[Next.js API routes\napp/api/**/route.ts]
      S2[Service layer\napp/backend/services/*.ts]
      S3[Worker APIs\nblender-worker/*.py & blender-api/app.py]
    end

    S1 -. can emit .-> E400
    S1 -. can emit .-> E401
    S1 -. can emit .-> E403
    S1 -. can emit .-> E404
    S2 -. can emit .-> E500
    S2 -. can emit .-> E502
    S2 -. can emit .-> E503
    S3 -. can emit .-> E400
    S3 -. can emit .-> E401
    S3 -. can emit .-> E500
    S3 -. can emit .-> E502
    S3 -. can emit .-> E503
```

## Notes

- `400` is typically generated early in request parsing/validation.
- `401` and `403` are separated as authentication vs authorization/policy failures.
- `404` is used for missing local records or missing upstream job/resource references.
- `500` indicates unexpected internal failures.
- `502` maps upstream/provider failures.
- `503` maps unavailable dependencies or missing required service configuration.

For file-level mappings and concrete triggers, see `docs/http-errors-guide.md`.
