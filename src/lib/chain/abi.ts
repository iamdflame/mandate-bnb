/**
 * MandateMarket ABI and bytecode, generated from the Foundry artifact.
 *
 * Regenerate with: npm run abi
 */

export const MANDATE_MARKET_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "adjudicator_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "CATASTROPHIC_ALPHA_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ALPHA_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "STRIKES_TO_DISMISS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "adjudicator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "assayedAt",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "award",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "bidIndex",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "bid",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "targetAlphaBps",
        "type": "int16",
        "internalType": "int16"
      }
    ],
    "outputs": [
      {
        "name": "bidIndex",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "bidCount",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "challengeWindow",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimSlash",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "closeMandate",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "contestSlash",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fineness",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBids",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct MandateMarket.Bid[]",
        "components": [
          {
            "name": "agent",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "bond",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "targetAlphaBps",
            "type": "int16",
            "internalType": "int16"
          },
          {
            "name": "spent",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMandate",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MandateMarket.Mandate",
        "components": [
          {
            "name": "principal",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "capital",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "agent",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "bond",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "category",
            "type": "uint8",
            "internalType": "enum MandateMarket.Category"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "enum MandateMarket.State"
          },
          {
            "name": "toleranceBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "feeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "slashBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "epochLength",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "epochsTotal",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "epochsSettled",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "lastSettledAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "cumulativeAlphaBps",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "strikes",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mandateCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minBond",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "minFineness",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "openMandate",
    "inputs": [
      {
        "name": "category",
        "type": "uint8",
        "internalType": "enum MandateMarket.Category"
      },
      {
        "name": "toleranceBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "slashBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "epochLength",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "epochsTotal",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingSlash",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "claimableAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "contested",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "resolved",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "publishAssay",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "fineness_",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "publishAssays",
    "inputs": [
      {
        "name": "agents",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "values",
        "type": "uint16[]",
        "internalType": "uint16[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveSlash",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "upheld",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setAdjudicator",
    "inputs": [
      {
        "name": "next",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setChallengeWindow",
    "inputs": [
      {
        "name": "seconds_",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinBond",
    "inputs": [
      {
        "name": "wei_",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMinFineness",
    "inputs": [
      {
        "name": "next",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleEpoch",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "realizedAlphaBps",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "successor",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawBid",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "bidIndex",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawable",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AdjudicatorChanged",
    "inputs": [
      {
        "name": "previous",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "next",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentDismissed",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reason",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Assayed",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "fineness",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "at",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BidPlaced",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "bond",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "targetAlphaBps",
        "type": "int16",
        "indexed": false,
        "internalType": "int16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BidWithdrawn",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "bond",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EpochSettled",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "realizedAlphaBps",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "feePaid",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "slashed",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateAwarded",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "bond",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateClosed",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "returned",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MandateOpened",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "principal",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "category",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum MandateMarket.Category"
      },
      {
        "name": "capital",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "epochsTotal",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MinFinenessChanged",
    "inputs": [
      {
        "name": "previous",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "next",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SlashContested",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SlashResolved",
    "inputs": [
      {
        "name": "mandateId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "upheld",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "amount",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawal",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadParameters",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadState",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BelowFineness",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BidSpent",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BondTooSmall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EpochNotElapsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MandateHeld",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoCapital",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoSuchBid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAdjudicator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAssayed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotBidder",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPrincipal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToWithdraw",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TermComplete",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WindowOpen",
    "inputs": []
  }
] as const;

export const MANDATE_MARKET_BYTECODE = "0x60806040525f80546102a360a71b600160a01b600160e01b0319909116179055600180546001600160601b031916662386f26fc10000179055348015610043575f5ffd5b5060405161329d38038061329d83398101604081905261006291610152565b60017f9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f005533806100ab57604051631e4fbdf760e01b81525f600482015260240160405180910390fd5b6100b481610103565b50600280546001600160a01b0319166001600160a01b0383169081179091556040515f907fd71598e915f689154369180588e39e6cec9552c4ffd63cfdad2f3c8058e891d8908290a35061017f565b5f80546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b5f60208284031215610162575f5ffd5b81516001600160a01b0381168114610178575f5ffd5b9392505050565b6131118061018c5f395ff3fe608060405260043610610207575f3560e01c8063861a141211610113578063c66f93601161009d578063da75c01e1161006d578063da75c01e146106fb578063e2b3f95f1461071a578063f2fde38b14610739578063fcee9a5014610758578063fd967f4714610777575f5ffd5b8063c66f93601461065e578063ce513b6f1461067d578063ce9bafe2146106a8578063d81cc607146106c7575f5ffd5b8063a5735662116100e3578063a5735662146105a0578063a8e64c8a146105bf578063adc19a52146105eb578063b9a958b414610614578063bf27a2291461063f575f5ffd5b8063861a1412146105125780638da5cb5b1461054f5780638fa072151461056b578063a183062214610581575f5ffd5b806353c2ed8e116101945780636a15c6e5116101645780636a15c6e51461045a578063715018a61461048957806376d354431461049d5780638026c149146104bc578063831518b7146104db575f5ffd5b806353c2ed8e1461032d5780635d78b7771461036457806360b5662e146104275780636773dd841461043b575f5ffd5b80633ab49ffb116101da5780633ab49ffb146102915780633ccfd60b146102c557806348c03d83146102d957806351796fba146102f857806353a7d2d414610317575f5ffd5b806305d8dd941461020b578063131d9a2714610231578063263a5b5c1461025d578063334987ab14610270575b5f5ffd5b61021e610219366004612a6d565b61078c565b6040519081526020015b60405180910390f35b34801561023c575f5ffd5b5061025061024b366004612ae2565b610aec565b6040516102289190612af9565b61021e61026b366004612b77565b610b9c565b34801561027b575f5ffd5b5061028f61028a366004612bc1565b610d97565b005b34801561029c575f5ffd5b506001546102b290600160601b900461ffff1681565b60405161ffff9091168152602001610228565b3480156102d0575f5ffd5b5061028f610dfa565b3480156102e4575f5ffd5b5061028f6102f3366004612c21565b610ef6565b348015610303575f5ffd5b5061028f610312366004612c8b565b61112e565b348015610322575f5ffd5b5061021e620186a081565b348015610338575f5ffd5b5060025461034c906001600160a01b031681565b6040516001600160a01b039091168152602001610228565b34801561036f575f5ffd5b506103dd61037e366004612cb1565b600560209081525f9283526040808420909152908252902080546001909101546001600160601b038216916001600160401b03600160601b90910416906001600160a01b0381169060ff600160a01b8204811691600160a81b90041685565b604080516001600160601b0390961686526001600160401b0390941660208601526001600160a01b039092169284019290925290151560608301521515608082015260a001610228565b348015610432575f5ffd5b5060035461021e565b348015610446575f5ffd5b5061028f610455366004612cdb565b61115d565b348015610465575f5ffd5b506102b2610474366004612bc1565b60076020525f908152604090205461ffff1681565b348015610494575f5ffd5b5061028f6112d6565b3480156104a8575f5ffd5b5061028f6104b7366004612d1c565b6112e7565b3480156104c7575f5ffd5b5061034c6104d6366004612ae2565b611381565b3480156104e6575f5ffd5b506001546104fa906001600160601b031681565b6040516001600160601b039091168152602001610228565b34801561051d575f5ffd5b505f5461053790600160a01b90046001600160401b031681565b6040516001600160401b039091168152602001610228565b34801561055a575f5ffd5b505f546001600160a01b031661034c565b348015610576575f5ffd5b5061021e6103e71981565b34801561058c575f5ffd5b5061028f61059b366004612d35565b6113dc565b3480156105ab575f5ffd5b5061028f6105ba366004612d35565b611ad3565b3480156105ca575f5ffd5b506105de6105d9366004612ae2565b611c8c565b6040516102289190612d92565b3480156105f6575f5ffd5b506105ff600381565b60405163ffffffff9091168152602001610228565b34801561061f575f5ffd5b5061021e61062e366004612ae2565b5f9081526004602052604090205490565b34801561064a575f5ffd5b5061028f610659366004612cb1565b611e7d565b348015610669575f5ffd5b5061028f610678366004612ae2565b611f74565b348015610688575f5ffd5b5061021e610697366004612bc1565b60066020525f908152604090205481565b3480156106b3575f5ffd5b5061028f6106c2366004612d35565b6121df565b3480156106d2575f5ffd5b506105376106e1366004612bc1565b60086020525f90815260409020546001600160401b031681565b348015610706575f5ffd5b5061028f610715366004612ef6565b612296565b348015610725575f5ffd5b5061028f610734366004612f1c565b6122ca565b348015610744575f5ffd5b5061028f610753366004612bc1565b6123a8565b348015610763575f5ffd5b5061028f610772366004612cb1565b6123e7565b348015610782575f5ffd5b506102b261271081565b5f345f036107ad57604051632a81ca8560e11b815260040160405180910390fd5b61271061ffff871611806107c6575061271061ffff8616115b806107d3575061ffff8416155b806107e3575061271061ffff8516115b806107f2575063ffffffff8316155b80610801575063ffffffff8216155b1561081f5760405163a18a709360e01b815260040160405180910390fd5b5060038054604080516101e0810182523381526001600160601b03341660208201525f918101829052606081019190915290919060808101898381111561086857610868612d55565b81526020015f815261ffff808a1660208084019190915289821660408085019190915291891660608085019190915263ffffffff808a1660808087019190915290891660a08601525f60c086018190526001600160401b03421660e08701526101008601819052610120909501859052865460018181018955978652948390208651938701516001600160601b03908116600160a01b9081026001600160a01b03968716176005909802909201968755948701519287015190941690930291161782850155820151600282018054939492939192909160ff19169083600381111561095557610955612d55565b021790555060a082015160028201805461ff00191661010083600381111561097f5761097f612d55565b021790555060c082015160028201805460e08501516101008601516101208701516101408801516101608901516101808a015165ffffffff0000199096166201000061ffff998a160265ffff0000000019161764010000000095891695909502949094176bffffffffffff0000000000001916600160301b97909316969096026bffffffff0000000000000000191691909117600160401b63ffffffff928316021767ffffffffffffffff60601b1916600160601b9582169590950263ffffffff60801b191694909417600160801b918516919091021767ffffffffffffffff60a01b1916600160a01b6001600160401b03909216919091021790556101a083015160038301556101c0909201516004909101805463ffffffff191691909216179055604051339082907fb49ddf8b18792f184522b8213857b5ed499eee0ce3374333978358337db3aab190610ada908b9034908890612f44565b60405180910390a39695505050505050565b606060045f8381526020019081526020015f20805480602002602001604051908101604052809291908181526020015f905b82821015610b91575f848152602090819020604080516080810182526002860290920180546001600160a01b0381168452600160a01b90046001600160601b03168385015260019081015480820b928401929092526201000090910460ff16151560608301529083529092019101610b1e565b505050509050919050565b5f5f60038481548110610bb157610bb1612f74565b5f9182526020822060059091020191506002820154610100900460ff166003811115610bdf57610bdf612d55565b14610bfd57604051634291db1560e11b815260040160405180910390fd5b6001546001600160601b0316341015610c2957604051630ce23d3f60e21b815260040160405180910390fd5b600154600160601b900461ffff1615610cb657335f908152600860205260408120546001600160401b03169003610c735760405163b3f487f960e01b815260040160405180910390fd5b600154335f9081526007602052604090205461ffff600160601b909204821691161015610cb65760405160016286279360e01b0319815260040160405180910390fd5b5f84815260046020908152604080832080548251608081018452338082526001600160601b0334811683880181815260018d810b868a01818152606088018d8152838a018b55998d529b8b902096519251909416600160a01b026001600160a01b039092169190911760028702909501948555985193909801805495511515620100000262ffffff1990961661ffff90941693909317949094179091558351958652938501919091529450909186917f22bffdbd17e669c882783205043a4c8f991d077b568d45c44448b0d8c1c8cf7c910160405180910390a35092915050565b610d9f61258c565b6002546040516001600160a01b038084169216907fd71598e915f689154369180588e39e6cec9552c4ffd63cfdad2f3c8058e891d8905f90a3600280546001600160a01b0319166001600160a01b0392909216919091179055565b610e026125b8565b335f9081526006602052604081205490819003610e3257604051630686827b60e51b815260040160405180910390fd5b335f818152600660205260408082208290555190919083908381818185875af1925050503d805f8114610e80576040519150601f19603f3d011682016040523d82523d5f602084013e610e85565b606091505b5050905080610ea7576040516312171d8360e31b815260040160405180910390fd5b60405182815233907f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b659060200160405180910390a25050610ef460015f5160206130bc5f395f51905f5255565b565b6002546001600160a01b03163314610f2157604051630b5873a560e31b815260040160405180910390fd5b828114610f415760405163a18a709360e01b815260040160405180910390fd5b5f5b83811015611127576103e8838383818110610f6057610f60612f74565b9050602002016020810190610f759190612d1c565b61ffff161115610f985760405163a18a709360e01b815260040160405180910390fd5b828282818110610faa57610faa612f74565b9050602002016020810190610fbf9190612d1c565b60075f878785818110610fd457610fd4612f74565b9050602002016020810190610fe99190612bc1565b6001600160a01b03166001600160a01b031681526020019081526020015f205f6101000a81548161ffff021916908361ffff1602179055504260085f87878581811061103757611037612f74565b905060200201602081019061104c9190612bc1565b6001600160a01b0316815260208101919091526040015f20805467ffffffffffffffff19166001600160401b039290921691909117905584848281811061109557611095612f74565b90506020020160208101906110aa9190612bc1565b6001600160a01b03167f6077f20b6a44bf02b04c24d76446115b96fc65b5de1108b1efa5c4157b0aabdd8484848181106110e6576110e6612f74565b90506020020160208101906110fb9190612d1c565b6040805161ffff90921682526001600160401b03421660208301520160405180910390a2600101610f43565b5050505050565b61113661258c565b600180546bffffffffffffffffffffffff19166001600160601b0392909216919091179055565b61116561258c565b61116d6125b8565b5f83815260056020908152604080832063ffffffff8616845290915290206001810154600160a81b900460ff16806111ad575080546001600160601b0316155b156111cb576040516336ab81e160e11b815260040160405180910390fd5b60018101805460ff60a81b1916600160a81b17905580546001600160601b03165f836112045760018301546001600160a01b0316611231565b6003868154811061121757611217612f74565b5f9182526020909120600590910201546001600160a01b03165b6001600160a01b0381165f90815260066020526040812080549293506001600160601b03851692909190611266908490612f9c565b90915550506040805185151581526001600160601b038416602082015263ffffffff87169188917f2eedc13fc518b8fd077e61a3677d7b2aa7440b13af7e2aef6ff79d538e888e75910160405180910390a35050506112d160015f5160206130bc5f395f51905f5255565b505050565b6112de61258c565b610ef45f6125d3565b6112ef61258c565b6103e88161ffff1611156113165760405163a18a709360e01b815260040160405180910390fd5b6001546040805161ffff600160601b9093048316815291831660208301527fc13ea1b1c0afe1bd75530d16f058cc94129f3de6add2da231e267607e2bb645c910160405180910390a16001805461ffff909216600160601b0261ffff60601b19909216919091179055565b5f5f61138c83612622565b90505f1981146113d3575f8381526004602052604090208054829081106113b5576113b5612f74565b5f9182526020909120600290910201546001600160a01b03166113d5565b5f5b9392505050565b6002546001600160a01b0316331461140757604051630b5873a560e31b815260040160405180910390fd5b61140f6125b8565b620186a081138061142a5750611427620186a0612fb5565b81125b156114485760405163a18a709360e01b815260040160405180910390fd5b5f6003838154811061145c5761145c612f74565b5f9182526020909120600590910201905060016002820154610100900460ff16600381111561148d5761148d612d55565b146114ab57604051634291db1560e11b815260040160405180910390fd5b600281015463ffffffff600160601b82048116600160801b90920416106114e55760405163ad4ed3a960e01b815260040160405180910390fd5b600281015461151190600160401b810463ffffffff1690600160a01b90046001600160401b0316612fcf565b6001600160401b031642101561153a5760405163a4cbd88560e01b815260040160405180910390fd5b6002810154600180830154600160801b90920463ffffffff16916001600160a01b031690611569908390612fee565b6002840180546bffffffffffffffffffffffff60801b1916600160801b63ffffffff939093169290920267ffffffffffffffff60a01b191691909117600160a01b426001600160401b0316021790556003830180548591905f906115ce90849061300a565b909155505f9050808086131561171a5784545f9061271090611601908990600160a01b90046001600160601b0316613031565b61160b9190613048565b60028701549091505f906127109061162f90640100000000900461ffff1684613031565b6116399190613048565b8754909150600160a01b90046001600160601b031681111561166957508554600160a01b90046001600160601b03165b9250826001600160601b038116156117045786548490889060149061169f908490600160a01b90046001600160601b0316613067565b92506101000a8154816001600160601b0302191690836001600160601b03160217905550836001600160601b031660065f876001600160a01b03166001600160a01b031681526020019081526020015f205f8282546116fe9190612f9c565b90915550505b505060048501805463ffffffff1916905561195e565b60028501546117329062010000900461ffff16612fb5565b86121561194e57600285015460018601546127109161176e91600160301b90910461ffff16906001600160601b03600160a01b90910416613031565b6117789190613048565b60018601549091506001600160601b03600160a01b909104811690821611156117b257506001840154600160a01b90046001600160601b03165b6001600160601b0381161561190e57808560010160148282829054906101000a90046001600160601b03166117e79190613067565b92506101000a8154816001600160601b0302191690836001600160601b031602179055506040518060a00160405280826001600160601b031681526020015f60149054906101000a90046001600160401b0316426118459190612fcf565b6001600160401b0390811682526001600160a01b038087166020808501919091525f604080860182905260609586018290528d82526005835280822063ffffffff8c1683528352908190208651815493880151909516600160601b026001600160a01b03199093166001600160601b03909516949094179190911783558401516001929092018054938501516080909501511515600160a81b0260ff60a81b19951515600160a01b026001600160a81b0319909516939092169290921792909217929092161790555b600485018054600191905f9061192b90849063ffffffff16612fee565b92506101000a81548163ffffffff021916908363ffffffff16021790555061195e565b60048501805463ffffffff191690555b826001600160a01b03168463ffffffff16887ff425e75e1f5d192e2e28107d6539f49a6c82523b569223e0af399ba4a4d7c1cb8986866040516119bd939291909283526001600160601b03918216602084015216604082015260600190565b60405180910390a46103e7198613611a1457611a0f87866040518060400160405280601d81526020017f636174617374726f7068696320756e646572706572666f726d616e63650000008152506126cf565b611ab4565b6004850154600363ffffffff90911610611a6857611a0f87866040518060400160405280602081526020017f746872656520636f6e7365637574697665206661696c696e672065706f6368738152506126cf565b6001850154600160a01b90046001600160601b03165f03611ab457611ab487866040518060400160405280600e81526020016d189bdb9908195e1a185d5cdd195960921b8152506126cf565b5050505050611acf60015f5160206130bc5f395f51905f5255565b5050565b611adb6125b8565b5f82815260046020526040902080548210611b095760405163fafbff9360e01b815260040160405180910390fd5b5f818381548110611b1c57611b1c612f74565b5f918252602090912060029091020180549091506001600160a01b03163314611b58576040516301e1a84160e11b815260040160405180910390fd5b600181015462010000900460ff1615611b8457604051639df90fa360e01b815260040160405180910390fd5b336001600160a01b031660038581548110611ba157611ba1612f74565b5f9182526020909120600160059092020101546001600160a01b031603611bdb5760405163a2b20ea160e01b815260040160405180910390fd5b6001810180546201000062ff00001990911617905580546001600160a01b0381168255335f9081526006602052604081208054600160a01b9093046001600160601b031692839290611c2e908490612f9c565b90915550506040516001600160601b0382168152339086907ff8dbdba17ddaa167ba2df095e986cc6546bb61eca07b0fe2f1766d2b483f40f89060200160405180910390a3505050611acf60015f5160206130bc5f395f51905f5255565b611d04604080516101e0810182525f808252602082018190529181018290526060810182905290608082019081526020015f81525f6020820181905260408201819052606082018190526080820181905260a0820181905260c0820181905260e0820181905261010082018190526101209091015290565b60038281548110611d1757611d17612f74565b5f918252602091829020604080516101e081018252600590930290910180546001600160a01b0380821685526001600160601b03600160a01b9283900481169686019690965260018301549081169385019390935290910490921660608201526002820154909190608083019060ff166003811115611d9857611d98612d55565b6003811115611da957611da9612d55565b81526020016002820160019054906101000a900460ff166003811115611dd157611dd1612d55565b6003811115611de257611de2612d55565b8152600282015462010000810461ffff9081166020840152640100000000820481166040840152600160301b8204166060830152600160401b810463ffffffff9081166080840152600160601b8204811660a0840152600160801b8204811660c0840152600160a01b9091046001600160401b031660e083015260038301546101008301526004909201549091166101209091015292915050565b5f82815260056020908152604080832063ffffffff85168452909152902060018101546001600160a01b03163314611ec8576040516301e1a84160e11b815260040160405180910390fd5b6001810154600160a81b900460ff1615611ef5576040516336ab81e160e11b815260040160405180910390fd5b8054600160601b90046001600160401b03164210611f265760405163a4229fab60e01b815260040160405180910390fd5b60018101805460ff60a01b1916600160a01b179055604051339063ffffffff84169085907f13be65c22b56de10576e2bd0a5ac5c27cbf419db4d6f2010c753401e4bad8aa5905f90a4505050565b611f7c6125b8565b5f60038281548110611f9057611f90612f74565b5f91825260209091206005909102019050600280820154610100900460ff166003811115611fc057611fc0612d55565b1480611fe9575060036002820154610100900460ff166003811115611fe757611fe7612d55565b145b1561200757604051634291db1560e11b815260040160405180910390fd5b600281015463ffffffff600160601b82048116600160801b9092041610155f806002840154610100900460ff16600381111561204557612045612d55565b14801561205b575082546001600160a01b031633145b905081158015612069575080155b1561208757604051634291db1560e11b815260040160405180910390fd5b82546001600160a01b0381168085555f9081526006602052604081208054600160a01b9093046001600160601b0316928392906120c5908490612f9c565b909155505060018401546001600160a01b0316158015906120f957506001840154600160a01b90046001600160601b031615155b15612147576001840180546001600160a01b038116918290555f9182526006602052604082208054600160a01b9092046001600160601b0316928392612140908490612f9c565b9091555050505b612150856127ee565b8261215c57600361215f565b60025b60028501805461ff00191661010083600381111561217f5761217f612d55565b02179055506040516001600160601b038216815285907fd0281b5169204f977d34527d1c2d6bd21e9fb587e36110bef97a44bdf101b6ac9060200160405180910390a2505050506121dc60015f5160206130bc5f395f51905f5255565b50565b6121e76125b8565b5f600383815481106121fb576121fb612f74565b5f918252602090912060059091020180549091506001600160a01b0316331461223757604051630789a70b60e41b815260040160405180910390fd5b5f6002820154610100900460ff16600381111561225657612256612d55565b1461227457604051634291db1560e11b815260040160405180910390fd5b61227f8382846128c1565b50611acf60015f5160206130bc5f395f51905f5255565b61229e61258c565b5f80546001600160401b03909216600160a01b0267ffffffffffffffff60a01b19909216919091179055565b6002546001600160a01b031633146122f557604051630b5873a560e31b815260040160405180910390fd5b6103e88161ffff16111561231c5760405163a18a709360e01b815260040160405180910390fd5b6001600160a01b0382165f818152600760209081526040808320805461ffff191661ffff87169081179091556008835292819020805467ffffffffffffffff1916426001600160401b03169081179091558151938452918301919091527f6077f20b6a44bf02b04c24d76446115b96fc65b5de1108b1efa5c4157b0aabdd910160405180910390a25050565b6123b061258c565b6001600160a01b0381166123de57604051631e4fbdf760e01b81525f60048201526024015b60405180910390fd5b6121dc816125d3565b6123ef6125b8565b5f82815260056020908152604080832063ffffffff8516845290915290206001810154600160a81b900460ff168061242f575080546001600160601b0316155b1561244d576040516336ab81e160e11b815260040160405180910390fd5b6001810154600160a01b900460ff161561247a576040516336ab81e160e11b815260040160405180910390fd5b8054600160601b90046001600160401b03164210156124ac5760405163a4229fab60e01b815260040160405180910390fd5b60018101805460ff60a81b1916600160a81b1790558054600380546001600160601b039092169182916006915f9190889081106124eb576124eb612f74565b5f91825260208083206005909202909101546001600160a01b0316835282019290925260400181208054909190612523908490612f9c565b909155505060408051600181526001600160601b038316602082015263ffffffff85169186917f2eedc13fc518b8fd077e61a3677d7b2aa7440b13af7e2aef6ff79d538e888e75910160405180910390a35050611acf60015f5160206130bc5f395f51905f5255565b5f546001600160a01b03163314610ef45760405163118cdaa760e01b81523360048201526024016123d5565b6125c0612a15565b60025f5160206130bc5f395f51905f5255565b5f80546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b5f8181526004602052604081205f19617fff19835b83548110156126c5575f84828154811061265357612653612f74565b905f5260205f20906002020190508060010160029054906101000a900460ff168061268d57508054600160a01b90046001600160601b0316155b1561269857506126bd565b60018181015484820b910b13156126bb576001808201549294509190910b915082905b505b600101612637565b5090949350505050565b6001820180545f90915560048301805463ffffffff191690556001600160a01b03811690600160a01b90046001600160601b0316801561273f576001600160a01b0382165f90815260066020526040812080546001600160601b0384169290612739908490612f9c565b90915550505b816001600160a01b0316857f03b20d0fcf98bb7d0a6cd04c51563675100959d5f4f5411ed86efcde88092c4e856040516127799190613086565b60405180910390a35f61278b86612622565b90505f198114806127b65750600285015463ffffffff600160601b82048116600160801b9092041610155b156127ce5750505050600201805461ff001916905550565b60028501805461ff00191690556127e68686836128c1565b505050505050565b5f818152600460205260408120905b81548110156112d1575f82828154811061281957612819612f74565b905f5260205f20906002020190508060010160029054906101000a900460ff168061285357508054600160a01b90046001600160601b0316155b1561285e57506128b9565b6001810180546201000062ff00001990911617905580546001600160a01b0381168083555f9081526006602052604081208054600160a01b9093046001600160601b0316928392906128b1908490612f9c565b909155505050505b6001016127fd565b5f838152600460205260409020805482106128ef5760405163fafbff9360e01b815260040160405180910390fd5b5f81838154811061290257612902612f74565b905f5260205f20906002020190508060010160029054906101000a900460ff161561294057604051639df90fa360e01b815260040160405180910390fd5b6001818101805462ff0000191662010000179055815490850180546001600160a01b0319166001600160a01b03928316908117825583546001600160601b03600160a01b918290048116820290921790925560028701805460048901805463ffffffff1916905561010061ff0067ffffffffffffffff60a01b0119909116426001600160401b03168502171790558354604080519382049092168352905192169187917ffc2b5e56d65b9e9bc0a01f3e087d984ae9003dbadc7ef1035a11f4bae8a59eaa919081900360200190a35050505050565b5f5160206130bc5f395f51905f5254600203610ef457604051633ee5aeb560e01b815260040160405180910390fd5b803561ffff81168114612a55575f5ffd5b919050565b803563ffffffff81168114612a55575f5ffd5b5f5f5f5f5f5f60c08789031215612a82575f5ffd5b863560048110612a90575f5ffd5b9550612a9e60208801612a44565b9450612aac60408801612a44565b9350612aba60608801612a44565b9250612ac860808801612a5a565b9150612ad660a08801612a5a565b90509295509295509295565b5f60208284031215612af2575f5ffd5b5035919050565b602080825282518282018190525f918401906040840190835b81811015612b6c57835160018060a01b0381511684526001600160601b036020820151166020850152604081015160010b604085015260608101511515606085015250608083019250602084019350600181019050612b12565b509095945050505050565b5f5f60408385031215612b88575f5ffd5b823591506020830135600181900b8114612ba0575f5ffd5b809150509250929050565b80356001600160a01b0381168114612a55575f5ffd5b5f60208284031215612bd1575f5ffd5b6113d582612bab565b5f5f83601f840112612bea575f5ffd5b5081356001600160401b03811115612c00575f5ffd5b6020830191508360208260051b8501011115612c1a575f5ffd5b9250929050565b5f5f5f5f60408587031215612c34575f5ffd5b84356001600160401b03811115612c49575f5ffd5b612c5587828801612bda565b90955093505060208501356001600160401b03811115612c73575f5ffd5b612c7f87828801612bda565b95989497509550505050565b5f60208284031215612c9b575f5ffd5b81356001600160601b03811681146113d5575f5ffd5b5f5f60408385031215612cc2575f5ffd5b82359150612cd260208401612a5a565b90509250929050565b5f5f5f60608486031215612ced575f5ffd5b83359250612cfd60208501612a5a565b915060408401358015158114612d11575f5ffd5b809150509250925092565b5f60208284031215612d2c575f5ffd5b6113d582612a44565b5f5f60408385031215612d46575f5ffd5b50508035926020909101359150565b634e487b7160e01b5f52602160045260245ffd5b600481106121dc57634e487b7160e01b5f52602160045260245ffd5b612d8e81612d69565b9052565b81516001600160a01b031681526101e081016020830151612dbe60208401826001600160601b03169052565b506040830151612dd960408401826001600160a01b03169052565b506060830151612df460608401826001600160601b03169052565b506080830151612e076080840182612d85565b5060a0830151612e1a60a0840182612d85565b5060c0830151612e3060c084018261ffff169052565b5060e0830151612e4660e084018261ffff169052565b50610100830151612e5e61010084018261ffff169052565b50610120830151612e7861012084018263ffffffff169052565b50610140830151612e9261014084018263ffffffff169052565b50610160830151612eac61016084018263ffffffff169052565b50610180830151612ec96101808401826001600160401b03169052565b506101a08301516101a08301526101c0830151612eef6101c084018263ffffffff169052565b5092915050565b5f60208284031215612f06575f5ffd5b81356001600160401b03811681146113d5575f5ffd5b5f5f60408385031215612f2d575f5ffd5b612f3683612bab565b9150612cd260208401612a44565b60608101612f5185612d69565b9381526001600160601b0392909216602083015263ffffffff1660409091015290565b634e487b7160e01b5f52603260045260245ffd5b634e487b7160e01b5f52601160045260245ffd5b80820180821115612faf57612faf612f88565b92915050565b5f600160ff1b8201612fc957612fc9612f88565b505f0390565b6001600160401b038181168382160190811115612faf57612faf612f88565b63ffffffff8181168382160190811115612faf57612faf612f88565b8082018281125f83128015821682158216171561302957613029612f88565b505092915050565b8082028115828204841417612faf57612faf612f88565b5f8261306257634e487b7160e01b5f52601260045260245ffd5b500490565b6001600160601b038281168282160390811115612faf57612faf612f88565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f8301168401019150509291505056fe9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00a2646970667358221220a87b1e4b2df3d8f96cef8b3b5fef1857c83c6555afd3e8830e8fd4b84230bdd164736f6c634300081c0033" as `0x${string}`;
