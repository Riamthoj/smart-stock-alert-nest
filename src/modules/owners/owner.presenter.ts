import type { Owner } from '../../database/schema/index.js';

/** The public shape of an owner / staff member. password_hash never leaves the server. */
export const presentOwner = (o: Owner) => ({
  id: o.id,
  store_id: o.store_id,
  username: o.username,
  phone: o.phone,
  profile: o.profile,
  is_owner: o.is_owner,
  is_primary: o.is_primary,
  created_at: o.created_at,
  updated_at: o.updated_at,
});

export type OwnerView = ReturnType<typeof presentOwner>;
