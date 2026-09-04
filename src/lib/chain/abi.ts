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

export const MANDATE_MARKET_BYTECODE = "0x60806040525f80546102a360a71b600160a01b600160e01b0319909116179055600180546001600160601b031916662386f26fc10000179055348015610043575f5ffd5b50604051612c6f380380612c6f83398101604081905261006291610163565b60017f9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f005533806100ab57604051631e4fbdf760e01b81525f600482015260240160405180910390fd5b6100b481610114565b50600180546001600160601b03166c010000000000000000000000006001600160a01b038416908102919091179091556040515f907fd71598e915f689154369180588e39e6cec9552c4ffd63cfdad2f3c8058e891d8908290a350610190565b5f80546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b5f60208284031215610173575f5ffd5b81516001600160a01b0381168114610189575f5ffd5b9392505050565b612ad28061019d5f395ff3fe6080604052600436106101c5575f3560e01c80638da5cb5b116100f2578063bf27a22911610092578063da75c01e11610062578063da75c01e146105eb578063f2fde38b1461060a578063fcee9a5014610629578063fd967f4714610648575f5ffd5b8063bf27a22914610563578063c66f936014610582578063ce513b6f146105a1578063ce9bafe2146105cc575f5ffd5b8063a5735662116100cd578063a5735662146104c4578063a8e64c8a146104e3578063adc19a521461050f578063b9a958b414610538575f5ffd5b80638da5cb5b146104735780638fa072151461048f578063a1830622146104a5575f5ffd5b806353c2ed8e11610168578063715018a611610138578063715018a6146103cc5780638026c149146103e0578063831518b7146103ff578063861a141214610436575f5ffd5b806353c2ed8e146102985780635d78b777146102d657806360b5662e146103995780636773dd84146103ad575f5ffd5b8063334987ab116101a3578063334987ab1461022e5780633ccfd60b1461024f57806351796fba1461026357806353a7d2d414610282575f5ffd5b806305d8dd94146101c9578063131d9a27146101ef578063263a5b5c1461021b575b5f5ffd5b6101dc6101d7366004612529565b610670565b6040519081526020015b60405180910390f35b3480156101fa575f5ffd5b5061020e61020936600461259e565b6109d1565b6040516101e691906125b5565b6101dc610229366004612633565b610a81565b348015610239575f5ffd5b5061024d610248366004612667565b610bef565b005b34801561025a575f5ffd5b5061024d610c5f565b34801561026e575f5ffd5b5061024d61027d36600461268d565b610d5b565b34801561028d575f5ffd5b506101dc620186a081565b3480156102a3575f5ffd5b506001546102be90600160601b90046001600160a01b031681565b6040516001600160a01b0390911681526020016101e6565b3480156102e1575f5ffd5b5061034f6102f03660046126b3565b600460209081525f9283526040808420909152908252902080546001909101546001600160601b038216916001600160401b03600160601b90910416906001600160a01b0381169060ff600160a01b8204811691600160a81b90041685565b604080516001600160601b0390961686526001600160401b0390941660208601526001600160a01b039092169284019290925290151560608301521515608082015260a0016101e6565b3480156103a4575f5ffd5b506002546101dc565b3480156103b8575f5ffd5b5061024d6103c73660046126dd565b610d8a565b3480156103d7575f5ffd5b5061024d610f03565b3480156103eb575f5ffd5b506102be6103fa36600461259e565b610f14565b34801561040a575f5ffd5b5060015461041e906001600160601b031681565b6040516001600160601b0390911681526020016101e6565b348015610441575f5ffd5b505f5461045b90600160a01b90046001600160401b031681565b6040516001600160401b0390911681526020016101e6565b34801561047e575f5ffd5b505f546001600160a01b03166102be565b34801561049a575f5ffd5b506101dc6103e71981565b3480156104b0575f5ffd5b5061024d6104bf36600461271e565b610f6f565b3480156104cf575f5ffd5b5061024d6104de36600461271e565b61166d565b3480156104ee575f5ffd5b506105026104fd36600461259e565b611826565b6040516101e6919061277b565b34801561051a575f5ffd5b50610523600381565b60405163ffffffff90911681526020016101e6565b348015610543575f5ffd5b506101dc61055236600461259e565b5f9081526003602052604090205490565b34801561056e575f5ffd5b5061024d61057d3660046126b3565b611a17565b34801561058d575f5ffd5b5061024d61059c36600461259e565b611b0e565b3480156105ac575f5ffd5b506101dc6105bb366004612667565b60056020525f908152604090205481565b3480156105d7575f5ffd5b5061024d6105e636600461271e565b611d79565b3480156105f6575f5ffd5b5061024d6106053660046128df565b611e30565b348015610615575f5ffd5b5061024d610624366004612667565b611e64565b348015610634575f5ffd5b5061024d6106433660046126b3565b611ea3565b348015610653575f5ffd5b5061065d61271081565b60405161ffff90911681526020016101e6565b5f345f0361069157604051632a81ca8560e11b815260040160405180910390fd5b61271061ffff871611806106aa575061271061ffff8616115b806106b7575061ffff8416155b806106c7575061271061ffff8516115b806106d6575063ffffffff8316155b806106e5575063ffffffff8216155b156107035760405163a18a709360e01b815260040160405180910390fd5b5060028054604080516101e0810182523381526001600160601b03341660208201525f91810182905260608101919091529091906080810189600381111561074d5761074d61273e565b81526020015f815261ffff808a1660208084019190915289821660408085019190915291891660608085019190915263ffffffff808a1660808087019190915290891660a08601525f60c086018190526001600160401b03421660e08701526101008601819052610120909501859052865460018181018955978652948390208651938701516001600160601b03908116600160a01b9081026001600160a01b03968716176005909802909201968755948701519287015190941690930291161782850155820151600282018054939492939192909160ff19169083600381111561083a5761083a61273e565b021790555060a082015160028201805461ff0019166101008360038111156108645761086461273e565b021790555060c082015160028201805460e08501516101008601516101208701516101408801516101608901516101808a015165ffffffff0000199096166201000061ffff998a160265ffff0000000019161764010000000095891695909502949094176bffffffffffff0000000000001916600160301b97909316969096026bffffffff0000000000000000191691909117600160401b63ffffffff928316021767ffffffffffffffff60601b1916600160601b9582169590950263ffffffff60801b191694909417600160801b918516919091021767ffffffffffffffff60a01b1916600160a01b6001600160401b03909216919091021790556101a083015160038301556101c0909201516004909101805463ffffffff191691909216179055604051339082907fb49ddf8b18792f184522b8213857b5ed499eee0ce3374333978358337db3aab1906109bf908b9034908890612905565b60405180910390a39695505050505050565b606060035f8381526020019081526020015f20805480602002602001604051908101604052809291908181526020015f905b82821015610a76575f848152602090819020604080516080810182526002860290920180546001600160a01b0381168452600160a01b90046001600160601b03168385015260019081015480820b928401929092526201000090910460ff16151560608301529083529092019101610a03565b505050509050919050565b5f5f60028481548110610a9657610a96612935565b5f9182526020822060059091020191506002820154610100900460ff166003811115610ac457610ac461273e565b14610ae257604051634291db1560e11b815260040160405180910390fd5b6001546001600160601b0316341015610b0e57604051630ce23d3f60e21b815260040160405180910390fd5b5f84815260036020908152604080832080548251608081018452338082526001600160601b0334811683880181815260018d810b868a01818152606088018d8152838a018b55998d529b8b902096519251909416600160a01b026001600160a01b039092169190911760028702909501948555985193909801805495511515620100000262ffffff1990961661ffff90941693909317949094179091558351958652938501919091529450909186917f22bffdbd17e669c882783205043a4c8f991d077b568d45c44448b0d8c1c8cf7c910160405180910390a35092915050565b610bf7612048565b6001546040516001600160a01b0380841692600160601b900416907fd71598e915f689154369180588e39e6cec9552c4ffd63cfdad2f3c8058e891d8905f90a3600180546001600160a01b03909216600160601b026001600160601b03909216919091179055565b610c67612074565b335f9081526005602052604081205490819003610c9757604051630686827b60e51b815260040160405180910390fd5b335f818152600560205260408082208290555190919083908381818185875af1925050503d805f8114610ce5576040519150601f19603f3d011682016040523d82523d5f602084013e610cea565b606091505b5050905080610d0c576040516312171d8360e31b815260040160405180910390fd5b60405182815233907f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b659060200160405180910390a25050610d5960015f516020612a7d5f395f51905f5255565b565b610d63612048565b600180546bffffffffffffffffffffffff19166001600160601b0392909216919091179055565b610d92612048565b610d9a612074565b5f83815260046020908152604080832063ffffffff8616845290915290206001810154600160a81b900460ff1680610dda575080546001600160601b0316155b15610df8576040516336ab81e160e11b815260040160405180910390fd5b60018101805460ff60a81b1916600160a81b17905580546001600160601b03165f83610e315760018301546001600160a01b0316610e5e565b60028681548110610e4457610e44612935565b5f9182526020909120600590910201546001600160a01b03165b6001600160a01b0381165f90815260056020526040812080549293506001600160601b03851692909190610e9390849061295d565b90915550506040805185151581526001600160601b038416602082015263ffffffff87169188917f2eedc13fc518b8fd077e61a3677d7b2aa7440b13af7e2aef6ff79d538e888e75910160405180910390a3505050610efe60015f516020612a7d5f395f51905f5255565b505050565b610f0b612048565b610d595f61208f565b5f5f610f1f836120de565b90505f198114610f66575f838152600360205260409020805482908110610f4857610f48612935565b5f9182526020909120600290910201546001600160a01b0316610f68565b5f5b9392505050565b600154600160601b90046001600160a01b03163314610fa157604051630b5873a560e31b815260040160405180910390fd5b610fa9612074565b620186a0811380610fc45750610fc1620186a0612976565b81125b15610fe25760405163a18a709360e01b815260040160405180910390fd5b5f60028381548110610ff657610ff6612935565b5f9182526020909120600590910201905060016002820154610100900460ff1660038111156110275761102761273e565b1461104557604051634291db1560e11b815260040160405180910390fd5b600281015463ffffffff600160601b82048116600160801b909204161061107f5760405163ad4ed3a960e01b815260040160405180910390fd5b60028101546110ab90600160401b810463ffffffff1690600160a01b90046001600160401b0316612990565b6001600160401b03164210156110d45760405163a4cbd88560e01b815260040160405180910390fd5b6002810154600180830154600160801b90920463ffffffff16916001600160a01b0316906111039083906129af565b6002840180546bffffffffffffffffffffffff60801b1916600160801b63ffffffff939093169290920267ffffffffffffffff60a01b191691909117600160a01b426001600160401b0316021790556003830180548591905f906111689084906129cb565b909155505f905080808613156112b45784545f906127109061119b908990600160a01b90046001600160601b03166129f2565b6111a59190612a09565b60028701549091505f90612710906111c990640100000000900461ffff16846129f2565b6111d39190612a09565b8754909150600160a01b90046001600160601b031681111561120357508554600160a01b90046001600160601b03165b9250826001600160601b0381161561129e57865484908890601490611239908490600160a01b90046001600160601b0316612a28565b92506101000a8154816001600160601b0302191690836001600160601b03160217905550836001600160601b031660055f876001600160a01b03166001600160a01b031681526020019081526020015f205f828254611298919061295d565b90915550505b505060048501805463ffffffff191690556114f8565b60028501546112cc9062010000900461ffff16612976565b8612156114e857600285015460018601546127109161130891600160301b90910461ffff16906001600160601b03600160a01b909104166129f2565b6113129190612a09565b60018601549091506001600160601b03600160a01b9091048116908216111561134c57506001840154600160a01b90046001600160601b03165b6001600160601b038116156114a857808560010160148282829054906101000a90046001600160601b03166113819190612a28565b92506101000a8154816001600160601b0302191690836001600160601b031602179055506040518060a00160405280826001600160601b031681526020015f60149054906101000a90046001600160401b0316426113df9190612990565b6001600160401b0390811682526001600160a01b038087166020808501919091525f604080860182905260609586018290528d82526004835280822063ffffffff8c1683528352908190208651815493880151909516600160601b026001600160a01b03199093166001600160601b03909516949094179190911783558401516001929092018054938501516080909501511515600160a81b0260ff60a81b19951515600160a01b026001600160a81b0319909516939092169290921792909217929092161790555b600485018054600191905f906114c590849063ffffffff166129af565b92506101000a81548163ffffffff021916908363ffffffff1602179055506114f8565b60048501805463ffffffff191690555b826001600160a01b03168463ffffffff16887ff425e75e1f5d192e2e28107d6539f49a6c82523b569223e0af399ba4a4d7c1cb898686604051611557939291909283526001600160601b03918216602084015216604082015260600190565b60405180910390a46103e71986136115ae576115a987866040518060400160405280601d81526020017f636174617374726f7068696320756e646572706572666f726d616e636500000081525061218b565b61164e565b6004850154600363ffffffff90911610611602576115a987866040518060400160405280602081526020017f746872656520636f6e7365637574697665206661696c696e672065706f63687381525061218b565b6001850154600160a01b90046001600160601b03165f0361164e5761164e87866040518060400160405280600e81526020016d189bdb9908195e1a185d5cdd195960921b81525061218b565b505050505061166960015f516020612a7d5f395f51905f5255565b5050565b611675612074565b5f828152600360205260409020805482106116a35760405163fafbff9360e01b815260040160405180910390fd5b5f8183815481106116b6576116b6612935565b5f918252602090912060029091020180549091506001600160a01b031633146116f2576040516301e1a84160e11b815260040160405180910390fd5b600181015462010000900460ff161561171e57604051639df90fa360e01b815260040160405180910390fd5b336001600160a01b03166002858154811061173b5761173b612935565b5f9182526020909120600160059092020101546001600160a01b0316036117755760405163a2b20ea160e01b815260040160405180910390fd5b6001810180546201000062ff00001990911617905580546001600160a01b0381168255335f9081526005602052604081208054600160a01b9093046001600160601b0316928392906117c890849061295d565b90915550506040516001600160601b0382168152339086907ff8dbdba17ddaa167ba2df095e986cc6546bb61eca07b0fe2f1766d2b483f40f89060200160405180910390a350505061166960015f516020612a7d5f395f51905f5255565b61189e604080516101e0810182525f808252602082018190529181018290526060810182905290608082019081526020015f81525f6020820181905260408201819052606082018190526080820181905260a0820181905260c0820181905260e0820181905261010082018190526101209091015290565b600282815481106118b1576118b1612935565b5f918252602091829020604080516101e081018252600590930290910180546001600160a01b0380821685526001600160601b03600160a01b9283900481169686019690965260018301549081169385019390935290910490921660608201526002820154909190608083019060ff1660038111156119325761193261273e565b60038111156119435761194361273e565b81526020016002820160019054906101000a900460ff16600381111561196b5761196b61273e565b600381111561197c5761197c61273e565b8152600282015462010000810461ffff9081166020840152640100000000820481166040840152600160301b8204166060830152600160401b810463ffffffff9081166080840152600160601b8204811660a0840152600160801b8204811660c0840152600160a01b9091046001600160401b031660e083015260038301546101008301526004909201549091166101209091015292915050565b5f82815260046020908152604080832063ffffffff85168452909152902060018101546001600160a01b03163314611a62576040516301e1a84160e11b815260040160405180910390fd5b6001810154600160a81b900460ff1615611a8f576040516336ab81e160e11b815260040160405180910390fd5b8054600160601b90046001600160401b03164210611ac05760405163a4229fab60e01b815260040160405180910390fd5b60018101805460ff60a01b1916600160a01b179055604051339063ffffffff84169085907f13be65c22b56de10576e2bd0a5ac5c27cbf419db4d6f2010c753401e4bad8aa5905f90a4505050565b611b16612074565b5f60028281548110611b2a57611b2a612935565b5f91825260209091206005909102019050600280820154610100900460ff166003811115611b5a57611b5a61273e565b1480611b83575060036002820154610100900460ff166003811115611b8157611b8161273e565b145b15611ba157604051634291db1560e11b815260040160405180910390fd5b600281015463ffffffff600160601b82048116600160801b9092041610155f806002840154610100900460ff166003811115611bdf57611bdf61273e565b148015611bf5575082546001600160a01b031633145b905081158015611c03575080155b15611c2157604051634291db1560e11b815260040160405180910390fd5b82546001600160a01b0381168085555f9081526005602052604081208054600160a01b9093046001600160601b031692839290611c5f90849061295d565b909155505060018401546001600160a01b031615801590611c9357506001840154600160a01b90046001600160601b031615155b15611ce1576001840180546001600160a01b038116918290555f9182526005602052604082208054600160a01b9092046001600160601b0316928392611cda90849061295d565b9091555050505b611cea856122aa565b82611cf6576003611cf9565b60025b60028501805461ff001916610100836003811115611d1957611d1961273e565b02179055506040516001600160601b038216815285907fd0281b5169204f977d34527d1c2d6bd21e9fb587e36110bef97a44bdf101b6ac9060200160405180910390a250505050611d7660015f516020612a7d5f395f51905f5255565b50565b611d81612074565b5f60028381548110611d9557611d95612935565b5f918252602090912060059091020180549091506001600160a01b03163314611dd157604051630789a70b60e41b815260040160405180910390fd5b5f6002820154610100900460ff166003811115611df057611df061273e565b14611e0e57604051634291db1560e11b815260040160405180910390fd5b611e1983828461237d565b5061166960015f516020612a7d5f395f51905f5255565b611e38612048565b5f80546001600160401b03909216600160a01b0267ffffffffffffffff60a01b19909216919091179055565b611e6c612048565b6001600160a01b038116611e9a57604051631e4fbdf760e01b81525f60048201526024015b60405180910390fd5b611d768161208f565b611eab612074565b5f82815260046020908152604080832063ffffffff8516845290915290206001810154600160a81b900460ff1680611eeb575080546001600160601b0316155b15611f09576040516336ab81e160e11b815260040160405180910390fd5b6001810154600160a01b900460ff1615611f36576040516336ab81e160e11b815260040160405180910390fd5b8054600160601b90046001600160401b0316421015611f685760405163a4229fab60e01b815260040160405180910390fd5b60018101805460ff60a81b1916600160a81b1790558054600280546001600160601b039092169182916005915f919088908110611fa757611fa7612935565b5f91825260208083206005909202909101546001600160a01b0316835282019290925260400181208054909190611fdf90849061295d565b909155505060408051600181526001600160601b038316602082015263ffffffff85169186917f2eedc13fc518b8fd077e61a3677d7b2aa7440b13af7e2aef6ff79d538e888e75910160405180910390a3505061166960015f516020612a7d5f395f51905f5255565b5f546001600160a01b03163314610d595760405163118cdaa760e01b8152336004820152602401611e91565b61207c6124d1565b60025f516020612a7d5f395f51905f5255565b5f80546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b5f8181526003602052604081205f19617fff19835b8354811015612181575f84828154811061210f5761210f612935565b905f5260205f20906002020190508060010160029054906101000a900460ff168061214957508054600160a01b90046001600160601b0316155b156121545750612179565b60018181015484820b910b1315612177576001808201549294509190910b915082905b505b6001016120f3565b5090949350505050565b6001820180545f90915560048301805463ffffffff191690556001600160a01b03811690600160a01b90046001600160601b031680156121fb576001600160a01b0382165f90815260056020526040812080546001600160601b03841692906121f590849061295d565b90915550505b816001600160a01b0316857f03b20d0fcf98bb7d0a6cd04c51563675100959d5f4f5411ed86efcde88092c4e856040516122359190612a47565b60405180910390a35f612247866120de565b90505f198114806122725750600285015463ffffffff600160601b82048116600160801b9092041610155b1561228a5750505050600201805461ff001916905550565b60028501805461ff00191690556122a286868361237d565b505050505050565b5f818152600360205260408120905b8154811015610efe575f8282815481106122d5576122d5612935565b905f5260205f20906002020190508060010160029054906101000a900460ff168061230f57508054600160a01b90046001600160601b0316155b1561231a5750612375565b6001810180546201000062ff00001990911617905580546001600160a01b0381168083555f9081526005602052604081208054600160a01b9093046001600160601b03169283929061236d90849061295d565b909155505050505b6001016122b9565b5f838152600360205260409020805482106123ab5760405163fafbff9360e01b815260040160405180910390fd5b5f8183815481106123be576123be612935565b905f5260205f20906002020190508060010160029054906101000a900460ff16156123fc57604051639df90fa360e01b815260040160405180910390fd5b6001818101805462ff0000191662010000179055815490850180546001600160a01b0319166001600160a01b03928316908117825583546001600160601b03600160a01b918290048116820290921790925560028701805460048901805463ffffffff1916905561010061ff0067ffffffffffffffff60a01b0119909116426001600160401b03168502171790558354604080519382049092168352905192169187917ffc2b5e56d65b9e9bc0a01f3e087d984ae9003dbadc7ef1035a11f4bae8a59eaa919081900360200190a35050505050565b5f516020612a7d5f395f51905f5254600203610d5957604051633ee5aeb560e01b815260040160405180910390fd5b803561ffff81168114612511575f5ffd5b919050565b803563ffffffff81168114612511575f5ffd5b5f5f5f5f5f5f60c0878903121561253e575f5ffd5b86356004811061254c575f5ffd5b955061255a60208801612500565b945061256860408801612500565b935061257660608801612500565b925061258460808801612516565b915061259260a08801612516565b90509295509295509295565b5f602082840312156125ae575f5ffd5b5035919050565b602080825282518282018190525f918401906040840190835b8181101561262857835160018060a01b0381511684526001600160601b036020820151166020850152604081015160010b6040850152606081015115156060850152506080830192506020840193506001810190506125ce565b509095945050505050565b5f5f60408385031215612644575f5ffd5b823591506020830135600181900b811461265c575f5ffd5b809150509250929050565b5f60208284031215612677575f5ffd5b81356001600160a01b0381168114610f68575f5ffd5b5f6020828403121561269d575f5ffd5b81356001600160601b0381168114610f68575f5ffd5b5f5f604083850312156126c4575f5ffd5b823591506126d460208401612516565b90509250929050565b5f5f5f606084860312156126ef575f5ffd5b833592506126ff60208501612516565b915060408401358015158114612713575f5ffd5b809150509250925092565b5f5f6040838503121561272f575f5ffd5b50508035926020909101359150565b634e487b7160e01b5f52602160045260245ffd5b60048110611d7657634e487b7160e01b5f52602160045260245ffd5b61277781612752565b9052565b81516001600160a01b031681526101e0810160208301516127a760208401826001600160601b03169052565b5060408301516127c260408401826001600160a01b03169052565b5060608301516127dd60608401826001600160601b03169052565b5060808301516127f0608084018261276e565b5060a083015161280360a084018261276e565b5060c083015161281960c084018261ffff169052565b5060e083015161282f60e084018261ffff169052565b5061010083015161284761010084018261ffff169052565b5061012083015161286161012084018263ffffffff169052565b5061014083015161287b61014084018263ffffffff169052565b5061016083015161289561016084018263ffffffff169052565b506101808301516128b26101808401826001600160401b03169052565b506101a08301516101a08301526101c08301516128d86101c084018263ffffffff169052565b5092915050565b5f602082840312156128ef575f5ffd5b81356001600160401b0381168114610f68575f5ffd5b6060810161291285612752565b9381526001600160601b0392909216602083015263ffffffff1660409091015290565b634e487b7160e01b5f52603260045260245ffd5b634e487b7160e01b5f52601160045260245ffd5b8082018082111561297057612970612949565b92915050565b5f600160ff1b820161298a5761298a612949565b505f0390565b6001600160401b03818116838216019081111561297057612970612949565b63ffffffff818116838216019081111561297057612970612949565b8082018281125f8312801582168215821617156129ea576129ea612949565b505092915050565b808202811582820484141761297057612970612949565b5f82612a2357634e487b7160e01b5f52601260045260245ffd5b500490565b6001600160601b03828116828216039081111561297057612970612949565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f8301168401019150509291505056fe9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00a2646970667358221220fe43f066a0e6b05d4e15e886f4b82faa8358251881bb012e90179610f5c6a77264736f6c634300081c0033" as `0x${string}`;
