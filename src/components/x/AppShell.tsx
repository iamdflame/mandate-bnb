import Navbar from "./Navbar";
import CampaignStrip from "./CampaignStrip";
import Footer from "./Footer";
import CompareTray from "./CompareTray";
import PasskeyHost from "./PasskeySlot";

/**
 * The one shell every page renders inside.
 *
 * It still carries the older class roots (`x-app`, `m-app`) for pages not yet
 * moved to the renovation's system; those sheets sit in @layer legacy, so the
 * k- classes always win where both apply.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-app x-app k-app">
      <a className="x-skip" href="#main">
        Skip to content
      </a>
      <CampaignStrip />
      <Navbar />
      <main id="main" className="x-main m-main k-main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <CompareTray />
      <PasskeyHost />
    </div>
  );
}
