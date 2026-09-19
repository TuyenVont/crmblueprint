# CRM Tech Stack

## 1. Core Stack

```text
Next.js
TypeScript
PostgreSQL
Supabase
Tailwind CSS
shadcn/ui
```

---

## 2. Frontend

- Next.js App Router.
- TypeScript strict mode.
- Tailwind CSS.
- shadcn/ui.
- Prefer Server Components.
- Use Client Components only when interaction requires them.

---

## 3. Backend

Backend stays inside the same Next.js application.

Use:

- Server Actions.
- Route Handlers.
- Server-side Services.

Do not create a separate backend project for MVP.

---

## 4. Database and Authentication

Database: PostgreSQL hosted by Supabase.

Initial database access: Supabase SDK.

Do not automatically add Prisma, Drizzle, TypeORM, or Sequelize. Any ORM decision requires a dedicated ticket.

Authentication: Supabase Auth.

MVP auth: Email, Password, Session, Logout, Password Reset.

---

## 5. Authorization and Multi-Tenant

Use CRM RBAC:

```text
User
↓
Workspace Membership
↓
Role
↓
Permissions
```

Server request flow:

```text
Authenticate User
↓
Resolve Workspace
↓
Verify Membership
↓
Check Permission
↓
Access Data
```

Supabase RLS provides an additional security layer.

---

## 6. Validation and Forms

Use Zod for forms, Server Actions, Route Handlers, query params, imports, and external input.

Start forms with React + Server Actions + Zod + shadcn/ui.

Add React Hook Form only when form complexity justifies it.

---

## 7. Feature-Specific Libraries

Install only when the related ticket begins:

- TanStack Table for advanced DataTable behavior.
- dnd-kit for Kanban drag and drop.
- Recharts for Dashboard/Reports.
- React Hook Form for complex forms.

Do not install these speculatively.

---

## 8. Storage, Realtime, Search and State

Use Supabase Storage when file uploads are required.

Do not enable realtime across the whole CRM. Use Supabase Realtime only for features that need it.

Use PostgreSQL search/query for MVP. Do not add Elasticsearch, OpenSearch, Algolia, or Meilisearch without a future requirement.

Do not add Redux, MobX, or Zustand without a demonstrated need.

---

## 9. Package Manager and Deployment

Package manager: npm. Do not mix npm, yarn, and pnpm in the same project.

Deployment:

- Web application: Vercel.
- Database/Auth/Storage: Supabase.

MVP does not require Kubernetes or orchestration infrastructure.

---

## 10. Environment Variables

Use `.env.local` and provide `.env.example`.

Initial public variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Private server secrets must remain server-side. Never commit real secrets.

---

## 11. Dependency Policy

Before adding a package, ask whether the existing stack can reasonably handle the need.

Priority:

1. Existing project capability.
2. Native React / Next.js.
3. Supabase capability.
4. Existing dependency.
5. New dependency.

Do not install packages speculatively.

---

## 12. Initial Project Dependencies

Keep initial dependencies minimal:

```text
Next.js
React
TypeScript
Tailwind CSS
Supabase client
Zod
shadcn/ui
```

---

## 13. Testing Priorities

Prioritize:

- Tenant isolation.
- RBAC.
- Lead conversion.
- Deal stage change.
- WON/LOST logic.
- Deal product snapshots.

---

## 14. Architecture Rule

MVP remains:

```text
One Next.js App
+
One Supabase Project
+
One PostgreSQL Database
```

Do not introduce infrastructure without a real requirement.

---

## 15. Agent Stack Rules

Codex must not independently:

- change framework
- change database
- add an ORM
- add a state manager
- add another API framework
- add another UI framework
- add large dependencies

Any major stack change requires a dedicated ticket and justification.
