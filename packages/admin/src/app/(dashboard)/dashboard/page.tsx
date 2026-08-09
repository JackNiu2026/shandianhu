import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div>
        <h2 className="text-xl font-bold text-ink">Operations overview</h2>
        <p className="mt-1 text-sm text-ink-muted">V2 operational reporting is not available yet.</p>
      </div>
      <Card title="Reporting unavailable" description="This dashboard will connect to V2 aggregate APIs in a later release.">
        <p className="text-sm text-ink-muted">No legacy metrics are shown.</p>
      </Card>
    </div>
  );
}
