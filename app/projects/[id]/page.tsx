export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '../../../src/lib/supabaseAdmin';

export default async function ProjectDashboard({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const [{ data: proj }, { data: stations }, { data: players }] = await Promise.all([
    supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
    supabaseAdmin.from('stations').select('id,name').eq('project_id', projectId).order('name'),
    supabaseAdmin.from('players').select('id,display_name').eq('project_id', projectId).order('created_at', { ascending: false })
  ]);

  if (!proj) return <main className="p-8">Projekt nicht gefunden.</main>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* wie oben */}
    </main>
  );
}
