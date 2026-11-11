import type { User } from '../../database/schema/index.js';

/** The public shape of a user. password_hash never leaves the server. */
export const presentUser = (u: User) => ({
  id: u.id,
  username: u.username,
  phone: u.phone,
  profile: u.profile,
  is_active: u.is_active,
  created_at: u.created_at,
  updated_at: u.updated_at,
});

export type UserView = ReturnType<typeof presentUser>;
