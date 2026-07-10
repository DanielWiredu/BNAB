import { RequisitionPage } from "@/features/daily-req/requisition-page";

export default async function EditDailyReqPage({
  params,
}: {
  params: Promise<{ reqNo: string }>;
}) {
  const { reqNo } = await params;
  return <RequisitionPage reqNo={decodeURIComponent(reqNo)} />;
}
