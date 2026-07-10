import { MonthlyReqPage } from "@/features/monthly-req/monthly-page";

export default async function EditMonthlyReqPage({
  params,
}: {
  params: Promise<{ reqNo: string }>;
}) {
  const { reqNo } = await params;
  return <MonthlyReqPage reqNo={decodeURIComponent(reqNo)} />;
}
