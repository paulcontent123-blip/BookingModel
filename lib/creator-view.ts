import type { Creator } from './types';

/**
 * Strips fields that must never leave the server for a caller whose plan does
 * not include contact reveals. Internal BD notes are removed unconditionally.
 */
export function publicCreatorShape(creator: Creator, showContact: boolean) {
  const {
    contact_email,
    contact_hint,
    contact_verified,
    bd_notes: _bdNotes,
    user_id: _userId,
    import_batch_id: _batchId,
    ...rest
  } = creator;

  return {
    ...rest,
    contact_email: showContact ? contact_email : null,
    contact_hint: showContact ? contact_hint : null,
    contact_verified: showContact ? contact_verified : false,
  };
}
