import { WorkerFormPage } from "@/features/workers/worker-form-page";

export default async function EditWorkerPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  return <WorkerFormPage workerId={decodeURIComponent(workerId)} />;
}
