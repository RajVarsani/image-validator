# Frontend Conventions (apps/web)

Borrowed from `~/all-things-saturn/saturn-fe/src/modules/coplanner`, **structure only**. Data-fetching follows the user's explicit SWR instruction (coplanner itself uses react-query; we deliberately use SWR + generic fetchers instead).

## Data fetching: useSWR + axios, NO service files
Single shared fetcher module (`apps/web/src/lib/fetchers.ts`):
```ts
import axios from 'axios';
import { Fetcher } from 'swr';

export const genericAPIFetcher: Fetcher<any, any> = async ([url, type, ...rest]: [string, 'get'|'post'|'put'|'delete', any[]?]) =>
    axios[type](url, ...rest);

export const genericMutationFetcher = async (url: string, { arg }: { arg: { type: 'get'|'post'|'put'|'delete'; rest?: any[] } }) =>
    axios[arg.type](url, ...(arg.rest || []));
```
- Reads:  `useSWR([url, 'get'], genericAPIFetcher)` (with `refreshInterval` for status polling).
- Writes: `useSWRMutation(url, genericMutationFetcher)`, call `trigger({ type: 'post', rest: [body] })`.
- Per-module `queries.ts` holds the SWR hooks. **No `service.ts`, no service objects.**

## Module structure
- Code lives under `src/modules/<feature>/`; **kebab-case directories**, nested as deep as the component tree.
- **Every component = its own directory with `index.tsx`** (never `Component.tsx`). Sub-components nest as subdirectories inside the parent.
- Each level may add: `types.ts` (or `types/` split into `models.ts`/`api.ts`/`index.ts`), `utils.ts`, `queries.ts`, `hooks/`, `constants/`.
- Shape: `a/[index.tsx, types.ts]` → `a/b/[index.tsx]` → `a/b/c/[index.tsx, utils.ts]`, `a/d/[index.tsx]`.
- **Files ≤ 100-200 LOC.** Split a big component by extracting each visual region into a nested child dir; parent `index.tsx` just wires children + state.

## Component style
- Components: **`export default` `React.FC<{...}>`** with inline prop types. Hooks/types/utils: named exports.
- Parent imports children by directory path (default import, resolves via `index.tsx`).
- Styling: **Tailwind v4 utilities + `cn()` helper** (twMerge(clsx())). Theme tokens from approved Paper design (white × cobalt, Space Grotesk + Inter). No CSS modules.
- Local view state: `useState`/`useRef`. Cross-tree state: lightweight context or zustand only if needed (likely unnecessary for this app).
- Toasts for success/error feedback (e.g. `sonner`).

## App skeleton
```
apps/web/src/
  lib/{fetchers.ts, utils.ts, api-base.ts}
  modules/
    validator/                 # the hero screen
      index.tsx                # composes upload + sections
      queries.ts               # useImages (poll), useUploadImages
      types.ts
      upload-dropzone/[index.tsx, utils.ts]   # client-side format gate
      results-section/[index.tsx, types.ts]
        image-card/[index.tsx, status-chip/index.tsx, reason-chip/index.tsx]
      image-detail/[index.tsx, check-row/index.tsx]
  components/ui/               # button, card, chip primitives (coss.com/ui + tokens)
```
