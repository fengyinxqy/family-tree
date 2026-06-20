## Next.js 16 implementation constraints

- Route Handlers use the Web `Request` and `Response` APIs, are dynamic by default when they access request data, authentication, the database, or the file system, and must not opt private material responses into static caching.
- Every material Route Handler and mutation must perform authentication and family-tree authorization at the server boundary; rendering a form inside an authenticated page is not authorization.
- Multipart payloads are parsed through `request.formData()` and all metadata and files are validated again on the server with Zod and signature checks.
- Private previews and downloads use uncached streaming responses with explicit private cache headers and never return storage paths or keys.
- Dynamic route `params` are asynchronous in this Next.js version and must be awaited through the generated route context contract or an equivalent typed promise.

## Storage deployment decision

- The domain depends on a server-only `ObjectStorage` interface rather than a vendor SDK.
- The initial adapter stores objects under `FILE_STORAGE_ROOT`, which must resolve outside `public/`.
- Development defaults to `.data/materials`; production must set `FILE_STORAGE_ROOT` to a durable mounted volume. Upload operations fail closed in production when that variable is absent.
- `FILE_MAX_BYTES` and `MATERIAL_MAX_FILES` optionally override conservative server defaults.
