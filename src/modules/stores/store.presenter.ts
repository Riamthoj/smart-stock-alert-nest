import type { Store } from '../../database/schema/index.js';

export const presentStore = (s: Store) => ({
  id: s.id,
  name: s.name,
  image: s.image,
  detail: s.detail,
  status: s.status,
  created_at: s.created_at,
  updated_at: s.updated_at,
});
