"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CAMPAIGN_ENDS } from "@/lib/campaign/rules";

/**
 * One of two things, by whether Set and Earn is still open (CAMPAIGN_ENDS).
 *
 * For pages rendered ahead of time (/build), where the server's clock at
 * build time is not the reader's: the server's answer renders first, and the
 * reader's clock corrects it after mount, so the page switches to its ended
 * state on the hour without a new deploy.
 */
export default function CampaignWhen({ open, ended, serverEnded }: { open: ReactNode; ended: ReactNode; serverEnded: boolean }) {
  const [isEnded, setEnded] = useState(serverEnded);
  useEffect(() => {
    setEnded(Date.now() >= Date.parse(CAMPAIGN_ENDS));
  }, []);
  return <>{isEnded ? ended : open}</>;
}
