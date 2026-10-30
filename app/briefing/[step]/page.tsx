import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefingStage } from "../BriefingStage";
import { BRIEFING_RAIL, BRIEFINGS, getBriefing } from "../briefings";

export function generateStaticParams() {
  return BRIEFINGS.map(({ step }) => ({ step }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  const briefing = getBriefing(step);
  if (!briefing) return { title: "Briefing — Monteverge" };
  return {
    title: `${briefing.title} — Monteverge`,
    description: briefing.standfirst,
  };
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const briefing = getBriefing(step);
  if (!briefing) notFound();

  return <BriefingStage key={briefing.step} briefing={briefing} rail={BRIEFING_RAIL} />;
}
