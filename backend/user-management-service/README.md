# user-management-service

Handles the four roles in the complaint portal:

- **citizen** — raises complaints (calls into call-management-service)
- **operator** — talks to citizens, handles the intake side of a call
- **officer** — resolves complaints for a specific civic department
- **admin** — manages accounts and roles

JWT-based auth, bcrypt password hashing, role-gated endpoints.

## Setup

```powershell
cd backend/user-management-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8003
```

`.env` already has a generated `JWT_SECRET_KEY` and `ADMIN_BOOTSTRAP_KEY`, and
points at the same Neon `DATABASE_URL` as the other services (own table,
`users`, no cross-service foreign key).

## Why there's a bootstrap key

`POST /auth/register` is public — anyone can self-register as a **citizen**.
But operator/officer/admin are staff roles, and a public signup endpoint that
let people self-elevate to admin would be a real vulnerability. So creating
any non-citizen account requires the request to include
`admin_bootstrap_key` matching the service's `ADMIN_BOOTSTRAP_KEY` env var —
share that key only with whoever is provisioning staff accounts (or use it
once to create your first admin, then have that admin provision the rest
through a proper admin-only invite flow later).

## Endpoints

- `GET /health`
- `POST /auth/register` — citizen signup is unrestricted; `role` other than
  `"citizen"` requires a valid `admin_bootstrap_key` in the body.
- `POST /auth/login` — OAuth2 password form (`username` = email, `password`).
  Returns a JWT `access_token`, valid for `JWT_EXPIRE_MINUTES` (default 24h).
  Works with Swagger's "Authorize" button at `/docs` for interactive testing.
- `GET /users/me` — the authenticated user's own profile.
- `GET /users?role=&department=` — **admin only**. List/filter users, e.g.
  `?role=officer&department=Fire and Emergency Services` to find who handles
  a given department's complaints.
- `GET /users/{id}` — admin, or the user viewing their own profile.
- `PATCH /users/{id}` — **admin only**. Update role, department,
  `is_active` (deactivate instead of deleting), etc.

## Using the token from another service

Every protected endpoint expects `Authorization: Bearer <access_token>`. The
JWT payload is `{"sub": "<user id>", "role": "<role>", "exp": ...}` — another
service can decode it with the same `JWT_SECRET_KEY` to check identity/role
without calling back into this service, or call `GET /users/me` to validate
against the database directly (catches deactivated accounts, which a bare
JWT decode won't).
