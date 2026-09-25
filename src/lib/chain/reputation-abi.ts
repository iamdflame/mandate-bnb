/**
 * The ERC-8004 reputation registry, as the browser needs it: its address and
 * the one call a buyer makes to rate an agent. No imports beyond viem, so a
 * client component can carry it.
 *
 * The selector was recovered from a real feedback transaction on BSC:
 * giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32).
 */

import { parseAbi } from "viem";

export const REPUTATION_REGISTRY = "0x8004baa17c55a88189ae136b182e5fda19de9b63" as const;

/*
  ERC-8004 v1.1. The event was confirmed against real records on BSC: topic0
  0x6a4a6174…febc is keccak256 of the NewFeedback signature below, with the
  agent id and the rating wallet indexed.
*/
export const REPUTATION_ABI = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
]);

/** keccak256 of the NewFeedback signature: what an indexer filters on. */
export const NEW_FEEDBACK_TOPIC = "0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc";

/** Every rating written from this site carries this second tag, so it can be attributed on chain. */
export const RATING_TAG = "mandatemarkets";
