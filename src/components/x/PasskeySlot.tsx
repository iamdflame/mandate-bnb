"use client";

import dynamic from "next/dynamic";

/**
 * The passkey approval dialog, loaded just after the page (it brings viem and
 * the WebAuthn code). It reads pending requests from the passkey session store
 * when it mounts, so a request made before it arrives is still shown.
 */
const PasskeySlot = dynamic(() => import("./Passkey").then((m) => m.PasskeyHost), { ssr: false });

export default PasskeySlot;
