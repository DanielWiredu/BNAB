import { RatesPage } from "@/features/rates/rates-page";

export default async function TradeGroupRatesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return <RatesPage rateKey="trade-group-rate" groupId={Number(groupId)} />;
}
