# Security boundary

## Local API preview

The server binds to loopback and API routes accept only the matching localhost/loopback Host and Origin. This blocks public unauthenticated access and cross-origin browser requests in the default configuration. Public hosting requires a real authentication and authorization layer, request/spending limits, and HTTPS. Do not forward arbitrary public requests to this local gateway or rewrite their Host to bypass the guard. These checks are not user authentication for a public service.
