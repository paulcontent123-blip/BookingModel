import { createCreatorAction } from '@/lib/services/admin-actions';
import { CreatorForm } from '@/components/admin/creator-form';

export const metadata = { title: 'Add Creator' };

export default function NewCreatorPage() {
  return (
    <>
      <h1 className="pg-title">Add Creator</h1>
      <p className="pg-sub">
        Creators are curated by the VEA team — this is the manual entry path. For bulk loads use
        Import / Excel Sync.
      </p>
      <CreatorForm action={createCreatorAction} submitLabel="Add to roster" />
    </>
  );
}
