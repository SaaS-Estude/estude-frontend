import { authenticatedRequest } from "@/lib/auth-api";
import type { User } from "@/types/auth";
import type { UsersPage } from "@/types/users";

// Existing searchable selectors operate on a complete directory. Fetch every
// server page, with bounded concurrency, instead of silently dropping page two.
export async function loadAccountDirectory(role: "TEACHER" | "STUDENT"): Promise<User[]> {
  const page = (number: number) => authenticatedRequest<UsersPage>(
    `/users?${new URLSearchParams({role, status: "ACTIVE", page: String(number), limit: "100"})}`,
  );
  const first = await page(1);
  const users = new Map(first.items.map((user) => [user.id, user]));
  for (let next = 2; next <= first.meta.totalPages; next += 4) {
    const pages = await Promise.all(
      Array.from({length: Math.min(4, first.meta.totalPages - next + 1)}, (_, index) => page(next + index)),
    );
    for (const result of pages) for (const user of result.items) users.set(user.id, user);
  }
  return [...users.values()];
}
