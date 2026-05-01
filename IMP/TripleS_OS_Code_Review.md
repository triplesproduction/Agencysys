# TripleS OS — Code Review Report
**Stack:** Next.js 14 (App Router, TypeScript) · NestJS Backend · Supabase (PostgreSQL + Auth + Realtime)  
**Reviewed:** Frontend source, auth system, API layer, backend config, DB schema

---

## 🚨 Critical Bugs & Security Issues

### 1. Hardcoded Secrets in Source Files
**Files:** `Keys.txt`, `backend/.env`, `frontend/src/lib/supabase.ts`

Your Supabase anon key is hardcoded directly in `supabase.ts` as a fallback string:
```ts
// CURRENT (DANGEROUS)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```
And `Keys.txt` + `backend/.env` contain the plain database password and a weak JWT secret (`"triples_secret"`).

**Impact:** Anyone who reads your repo (or this zip) has full database access and can forge JWT tokens.

**Fix:**
- Remove the hardcoded fallback key from `supabase.ts`. If the env var is missing, throw an error early.
- Generate a strong random JWT secret (32+ characters).
- Add `Keys.txt` and `backend/.env` to `.gitignore` immediately. They are NOT currently ignored.
- Use `.env.local` for all secrets and never commit it.

```ts
// FIXED
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase environment variables');
```

---

### 2. `getMyLeaves` Returns All Leaves for All Users
**File:** `frontend/src/lib/api.ts` — line ~521

```ts
// CURRENT (BUG) — comment says it's intentional but it's a data leak
const { data, error } = await supabase.from('leaves').select('*').order('createdAt', { ascending: false });
// The .eq('employeeId', userId) filter is commented out
```

Any employee calling this endpoint receives every other employee's leave records. This is a serious data privacy bug.

**Fix:** Uncomment the filter and resolve the underlying auth mismatch properly:
```ts
const { data, error } = await supabase
    .from('leaves')
    .select('*')
    .eq('employeeId', userId)
    .order('createdAt', { ascending: false });
```

---

### 3. Role Escalation via Email Address
**File:** `frontend/src/hooks/useAuth.tsx` — `fetchProfile` function

When a user's DB profile cannot be found (or on any DB error), the system assigns roles based on whether the word "admin" appears in the user's email:
```ts
roleId: email?.toLowerCase().includes('admin') ? 'ADMIN' : 'EMPLOYEE'
```

Anyone who registers with an email like `admin123@gmail.com` would receive ADMIN permissions if there's a DB hiccup. This also means DB errors silently grant access instead of blocking it.

**Fix:** On profile fetch failure, fail closed — deny access entirely rather than granting a fallback role.
```ts
if (error || !data) {
    console.error('[Auth] Profile resolution failed. Denying access.');
    await supabase.auth.signOut();
    return null;
}
```

---

### 4. Middleware Does Nothing (Auth Bypass)
**File:** `frontend/src/middleware.ts`

The middleware matcher covers all protected routes, but the function always returns `NextResponse.next()` unconditionally. This means all server-side route protection is bypassed — protection only exists on the client side via `AuthGuard`.

**Impact:** Server-rendered data, API routes, and direct URL access are completely unprotected. A user can disable JavaScript and bypass the AuthGuard entirely.

**Fix:** Validate the Supabase session cookie in middleware using `@supabase/ssr`:
```ts
import { createMiddlewareClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res: response });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && request.nextUrl.pathname !== '/login') {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
}
```

---

### 5. N+1 Query in `getConversations`
**File:** `frontend/src/lib/api.ts` — lines ~905–930

For every conversation ID, two separate Supabase queries are fired in a `Promise.all`:
```ts
convIds.map(async (convId) => {
    // Query 1: get last message
    await supabase.from('messages').select('*').eq('conversation_id', convId)...
    // Query 2: get unread count
    await supabase.from('messages').select('*', { count: 'exact' }).eq('conversation_id', convId)...
})
```

If a user has 20 conversations, this fires **40 database queries** on every page load of the messaging screen.

**Fix:** Fetch all messages for all relevant conversations in two bulk queries, then group in memory:
```ts
// One query for last messages, one for unread counts — both filtered by convIds array
const { data: allMsgs } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });

// Group by conversation_id in JS
const lastMessages = convIds.reduce((acc, id) => {
    acc[id] = allMsgs?.find(m => m.conversation_id === id) || null;
    return acc;
}, {} as Record<string, any>);
```

---

## ⚠️ High-Priority Issues

### 6. "Virtual Team" Encoding Hack — Storing Data in HTML Comments
**File:** `frontend/src/lib/api.ts` — lines ~267, 292, 332

Multiple assignees are stored by embedding a hidden HTML comment inside the task's description field:
```ts
const teamMarker = `<!-- TEAM:[${data.assigneeIds.join(',')}] -->`;
data.description = data.description + teamMarker;
```

This is extremely fragile. Any edit to the description that doesn't preserve the comment will silently drop all assignees except the primary one. It also corrupts the description field semantically.

**Fix:** Add a proper `assigneeIds` column (text array) to the `tasks` table:
```sql
ALTER TABLE tasks ADD COLUMN assignee_ids TEXT[] DEFAULT '{}';
```
Then store and retrieve that column directly.

---

### 7. 188 Uses of `any` Type — TypeScript Defeats Itself
**Files:** Throughout `src/`

There are 188 instances of `: any` or `as any` across the codebase. This eliminates the value of TypeScript and hides potential bugs from the compiler.

**Priority areas to fix:**
- `api.ts`: The entire API layer uses `any` for Supabase responses. Use generated Supabase types instead.
- `useAuth.tsx`: `data` from profile fetch is untyped.
- All component props that accept `any[]` for employees or tasks.

Run `npx supabase gen types typescript` to auto-generate database types.

---

### 8. Inactivity Timer Fires Every Interaction (Performance)
**File:** `frontend/src/hooks/useAuth.tsx` — inactivity useEffect

The `mousemove` event fires hundreds of times per second, and each event calls `resetTimer()` which calls `clearTimeout` + `setTimeout`. While `{ passive: true }` helps with scrolling, this still creates and destroys timer objects constantly.

**Fix:** Throttle the handler:
```ts
let lastActivity = Date.now();
const handler = () => { lastActivity = Date.now(); };

// Check inactivity on an interval instead
const intervalId = setInterval(() => {
    if (Date.now() - lastActivity > INACTIVITY_LIMIT) triggerLogout();
}, 60000); // check every minute
```

---

### 9. `signOut` Calls `localStorage.clear()` Indiscriminately
**File:** `frontend/src/hooks/useAuth.tsx`

```ts
localStorage.clear(); // Nuclear option
sessionStorage.clear();
```

This wipes all localStorage data, including any data stored by third-party scripts, browser extensions injecting into the page, or any other app state you might add in the future. It's unnecessary since Supabase's `signOut()` already clears its own keys.

**Fix:**
```ts
localStorage.removeItem('triples_auth_session');
localStorage.removeItem('cached_profile');
await supabase.auth.signOut(); // Handles its own cleanup
```

---

### 10. `getMyLeaves` Parameter Is Accepted But Ignored (see Bug #2)
The function accepts `userId: string` and even validates it, but then ignores it in the actual query. This creates a false sense of filtering and will confuse future developers.

---

## 🔧 Code Improvements

### 11. Dead/Scratch Files Committed to the Repository
The following files should not be in the repo and should be deleted or added to `.gitignore`:

- `frontend/scratch/check_schema.js` — development debugging script
- `frontend/check_projects.js` — debugging script
- `frontend/check_announcements.mjs` — debugging script
- `frontend/check_kpis.mjs` — debugging script
- `Keys.txt` — plaintext credentials
- The `.next/` build cache directory is committed (should be in `.gitignore`)
- `backend/dist/` compiled output is committed (should be in `.gitignore`)

**Fix — update `.gitignore`:**
```
.next/
backend/dist/
Keys.txt
*.env
frontend/scratch/
frontend/check_*.js
frontend/check_*.mjs
```

---

### 12. 95 `console.log/warn/error` Statements Left in Production Code
There are 95 debug log statements throughout the source files that will spam the browser console for every user. Many reveal internal implementation details (auth flow, DB queries, employee IDs).

**Fix:** Use a centralized logger with environment-based toggling:
```ts
// lib/logger.ts
const isDev = process.env.NODE_ENV === 'development';
export const logger = {
    log: (...args: any[]) => isDev && console.log(...args),
    error: (...args: any[]) => console.error(...args), // always log errors
    warn: (...args: any[]) => isDev && console.warn(...args),
};
```

---

### 13. `auth.ts` Is Mostly Dead Code
**File:** `frontend/src/lib/auth.ts`

Three of the four exported functions return `null` unconditionally and are marked `DEPRECATED`. The file only exists as a compatibility shim. The `clearAuthToken` function duplicates logic from `useAuth.tsx`'s `signOut`.

**Fix:** Delete `auth.ts`. Update any remaining imports to use `useAuth()` directly. The only useful function, `checkPermission`, can be moved to `permissions.ts`.

---

### 14. `ws.ts` Realtime Client Has No Cleanup for Individual Listeners
**File:** `frontend/src/lib/ws.ts`

```ts
subscribe(eventName: string, callback: (data: any) => void) {
    this.channel.on('broadcast', { event: eventName }, (payload) => {
        callback(payload.payload);
    });
    return () => {
        // Cleanup broadcast listener if Supabase supports direct off() for specific handlers 
    }; // ← This cleanup does nothing
}
```

Components that subscribe and then unmount will leak their callbacks. Supabase Realtime channels don't expose a granular `off()` for individual handlers — the correct approach is to use separate channel instances per component or a subscription registry pattern.

---

### 15. `updateEmployee` Has a 10-Second Timeout With a Misleading Error Message
**File:** `frontend/src/lib/api.ts`

```ts
const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Update timed out. Verify your database columns use camelCase.')), 10000)
);
```

The error message instructs developers to "verify columns use camelCase" — but the codebase actually has a mixed camelCase/snake_case column naming problem. This note is a workaround comment, not a proper fix. The 10-second timeout is also much longer than typical UX best practice (3 seconds).

---

### 16. `getMonthlyWorkHours` Ignores Its `monthYear` Parameter
**File:** `frontend/src/lib/api.ts`

The function signature accepts `monthYear?: string` but then immediately calculates the date range from `new Date()` regardless:
```ts
getMonthlyWorkHours: async (employeeId: string, monthYear?: string) => {
    const now = new Date(); // monthYear param is never used
```

This means callers that pass a specific month always get the current month's data instead.

---

### 17. Permission System Doesn't Cover Many Routes
**File:** `frontend/src/lib/permissions.ts`

`canAccessPath` defaults to `return true` for all unrecognized paths, which means newly added routes are publicly accessible to all roles by default. This is an unsafe default — new routes should be restricted until explicitly opened.

**Fix:** Invert the default — return `false` for unknown paths and maintain an explicit allowlist per role:
```ts
const ROLE_PATHS: Record<Role, string[]> = {
    ADMIN: ['*'], // all
    MANAGER: ['/dashboard', '/tasks', '/eod', '/leaves', '/projects', '/messaging', '/kpis'],
    EMPLOYEE: ['/dashboard', '/tasks', '/eod', '/leaves', '/messaging', '/projects'],
};
```

---

## 📦 Optimization Opportunities

### 18. `getEmployeeById` Fetches 4 Relations in One Query With No Limit
```ts
.select(`*, tasksAssigned:tasks!assigneeId(*), kpis:kpi_metrics(*), documents:employee_documents(*), salaryHistory:salary_history(*)`)
```
For an employee with hundreds of tasks and documents, this could return megabytes of data. Add limits and lazy-load relations only when the relevant tab is opened.

### 19. `getConversations` Uses `Promise.all` on `convIds.map` for 2 Queries Each
Already noted in Bug #5, but also: the entire conversation list is refetched on every re-render of the messaging page. Add a short-lived cache (SWR/React Query, or even a simple `useRef` timestamp guard) to avoid re-fetching data that was just loaded.

### 20. `normalizeEmployee` Is Called on Every Row in Every List Query
The normalization function runs on every employee in every response, even when the data is already correctly shaped. Consider normalizing at the DB level with consistent column naming instead.

---

## Summary Table

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🚨 Critical | Security | Hardcoded Supabase key + weak JWT secret |
| 2 | 🚨 Critical | Bug | `getMyLeaves` returns all employees' leaves |
| 3 | 🚨 Critical | Security | Role escalation via email address string |
| 4 | 🚨 Critical | Security | Middleware does nothing — no server-side auth |
| 5 | 🚨 Critical | Performance | N+1 queries in `getConversations` |
| 6 | ⚠️ High | Architecture | Assignee IDs stored as HTML comments in description |
| 7 | ⚠️ High | Code Quality | 188 `any` type usages defeat TypeScript |
| 8 | ⚠️ High | Performance | Inactivity timer fires on every `mousemove` |
| 9 | ⚠️ High | Bug | `signOut` nukes all localStorage indiscriminately |
| 10 | ⚠️ High | Bug | `getMyLeaves` ignores its `userId` argument |
| 11 | 🔧 Medium | Hygiene | Scratch files, build artifacts, secrets in repo |
| 12 | 🔧 Medium | Hygiene | 95 console logs left in production code |
| 13 | 🔧 Medium | Dead Code | `auth.ts` is deprecated and mostly empty |
| 14 | 🔧 Medium | Bug | WebSocket listener cleanup does nothing |
| 15 | 🔧 Medium | UX | 10s timeout with misleading error message |
| 16 | 🔧 Medium | Bug | `getMonthlyWorkHours` ignores `monthYear` param |
| 17 | 🔧 Medium | Security | Permission system unsafe-defaults to `true` |
| 18 | 📈 Low | Performance | `getEmployeeById` fetches unlimited relations |
| 19 | 📈 Low | Performance | Conversation list refetches on every render |
| 20 | 📈 Low | Performance | `normalizeEmployee` runs on every row |

---

## Recommended Priority Order

1. **Immediately:** Rotate the Supabase anon key (assume it's compromised since it was in source). Fix `Keys.txt` and `.env` in `.gitignore`.
2. **This sprint:** Fix the `getMyLeaves` data leak, the email-based role escalation, and add real middleware auth.
3. **Next sprint:** Replace the "Virtual Team" HTML comment hack with a proper DB column. Fix the N+1 messaging queries.
4. **Ongoing:** Replace `any` types, clean up console logs, delete scratch files, add the `monthYear` fix.
