import { Activity, BadgeCheck, FileSearch, Radio, Target, Users } from "lucide-react";
import { QUALIFIES } from "@/lib/campaign/rules";

const ICONS = [BadgeCheck, FileSearch, Radio, Users, Activity, Target];

/**
 * BNB Chain's six Set and Earn checks, in its own words, as six cards. They
 * are rules rather than a sequence, so each carries what it is about, not a
 * number. Shared by /build and /check.
 */
export default function SixChecks() {
  return (
    <ul className="bd-tests bd-tests--rules">
      {QUALIFIES.map(([t, d], i) => {
        const Icon = ICONS[i] ?? BadgeCheck;
        return (
          <li key={t} className="bd-test">
            <span className="bd-test__ic" aria-hidden="true">
              <Icon size={19} />
            </span>
            <h3 className="bd-test__t">{t}</h3>
            <p className="bd-test__d">{d}</p>
          </li>
        );
      })}
    </ul>
  );
}
