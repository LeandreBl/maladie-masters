import type { AdminUserRow } from "./api";
import { initialsOf } from "./format";

export function playerName(user: Pick<AdminUserRow, "displayName" | "email">): string {
  return user.displayName ?? user.email.split("@")[0] ?? user.email;
}

export function playerInitials(user: Pick<AdminUserRow, "displayName" | "email">): string {
  return initialsOf(user.displayName, user.email);
}
