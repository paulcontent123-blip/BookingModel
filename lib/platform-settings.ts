import { db } from '@/lib/db';

/** Stored admin-controlled flag for the public GEO test switcher. */
export const GEO_STATUS_PANEL_SETTING_KEY = 'geo_status_panel_visible';

/**
 * The GEO test switcher is deliberately disabled when no setting exists. This
 * keeps a fresh production database safe while still allowing an admin to
 * turn deployment testing on from Settings.
 */
export async function isGeoStatusPanelVisible(): Promise<boolean> {
  try {
    const setting = await db.findOne('settings', { key: GEO_STATUS_PANEL_SETTING_KEY });
    return setting?.value === 'true';
  } catch (error) {
    // A diagnostics widget must never make the public site unavailable when
    // the settings store is temporarily unreachable.
    console.warn('[platform-settings] could not read GEO panel setting:', error);
    return false;
  }
}
