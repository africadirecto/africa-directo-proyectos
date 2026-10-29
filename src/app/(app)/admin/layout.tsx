import { requiere } from '@/lib/sesion';
import { MenuAdmin } from './MenuAdmin';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await requiere('admin');
  return (
    <main className="principal" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <MenuAdmin />
      <div style={{ flex: '999 1 680px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </main>
  );
}
