import { WeeklyReqPage } from "@/features/weekly-req/weekly-page";

export default async function EditWeeklyReqPage({
  params,
}: {
  params: Promise<{ reqNo: string }>;
}) {
  const { reqNo } = await params;
  return <WeeklyReqPage reqNo={decodeURIComponent(reqNo)} />;
}
