/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sentry.json`.
 */
export type Sentry = {
  "address": "EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm",
  "metadata": {
    "name": "sentry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "SENTRY - Decentralized Truth Layer for Token Security"
  },
  "instructions": [
    {
      "name": "finalizeConsensus",
      "docs": [
        "Finalize consensus after voting window closes"
      ],
      "discriminator": [
        158,
        21,
        141,
        117,
        251,
        129,
        243,
        22
      ],
      "accounts": [
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "tokenAnalysis",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the Sentry protocol with admin"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "config",
          "type": {
            "defined": {
              "name": "protocolConfig"
            }
          }
        }
      ]
    },
    {
      "name": "registerSentinel",
      "docs": [
        "Register as a sentinel agent (stake SOL)"
      ],
      "discriminator": [
        211,
        153,
        110,
        133,
        11,
        56,
        104,
        223
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "sentinel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  116,
                  105,
                  110,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "stake",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "reportRug",
      "docs": [
        "Report a rug pull - triggers slashing for wrong verdicts"
      ],
      "discriminator": [
        75,
        236,
        22,
        109,
        66,
        247,
        98,
        187
      ],
      "accounts": [
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "tokenAnalysis",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              }
            ]
          }
        },
        {
          "name": "reporter",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "rewardSentinel",
      "docs": [
        "Reward sentinels who voted correctly (DANGER on rugged, or SAFE on verified safe)"
      ],
      "discriminator": [
        169,
        74,
        156,
        193,
        61,
        219,
        141,
        70
      ],
      "accounts": [
        {
          "name": "sentinel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  116,
                  105,
                  110,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "sentinel.authority",
                "account": "sentinel"
              }
            ]
          }
        },
        {
          "name": "sentinelVote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              },
              {
                "kind": "account",
                "path": "sentinel.authority",
                "account": "sentinel"
              }
            ]
          }
        },
        {
          "name": "tokenAnalysis",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "slashSentinel",
      "docs": [
        "Slash a sentinel who voted SAFE on a rugged token"
      ],
      "discriminator": [
        131,
        138,
        154,
        23,
        191,
        27,
        164,
        251
      ],
      "accounts": [
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "sentinel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  116,
                  105,
                  110,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "sentinel.authority",
                "account": "sentinel"
              }
            ]
          }
        },
        {
          "name": "sentinelVote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              },
              {
                "kind": "account",
                "path": "sentinel.authority",
                "account": "sentinel"
              }
            ]
          }
        },
        {
          "name": "tokenAnalysis",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "token_analysis.token_mint",
                "account": "tokenAnalysis"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "submitVerdict",
      "docs": [
        "Submit a verdict on a token (SAFE or DANGER)"
      ],
      "discriminator": [
        138,
        102,
        56,
        22,
        229,
        130,
        105,
        118
      ],
      "accounts": [
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "sentinel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  110,
                  116,
                  105,
                  110,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "tokenAnalysis",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "sentinelVote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tokenMint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "sentinel"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "verdict",
          "type": {
            "defined": {
              "name": "verdict"
            }
          }
        },
        {
          "name": "confidence",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "protocol",
      "discriminator": [
        45,
        39,
        101,
        43,
        115,
        72,
        131,
        40
      ]
    },
    {
      "name": "sentinel",
      "discriminator": [
        176,
        148,
        133,
        149,
        234,
        182,
        172,
        1
      ]
    },
    {
      "name": "sentinelVote",
      "discriminator": [
        147,
        239,
        251,
        21,
        210,
        183,
        11,
        20
      ]
    },
    {
      "name": "tokenAnalysis",
      "discriminator": [
        5,
        226,
        129,
        195,
        177,
        241,
        205,
        59
      ]
    }
  ],
  "events": [
    {
      "name": "consensusReached",
      "discriminator": [
        240,
        211,
        75,
        133,
        165,
        96,
        113,
        26
      ]
    },
    {
      "name": "rugReported",
      "discriminator": [
        122,
        238,
        200,
        168,
        252,
        126,
        157,
        33
      ]
    },
    {
      "name": "sentinelRegistered",
      "discriminator": [
        96,
        13,
        58,
        29,
        114,
        106,
        113,
        69
      ]
    },
    {
      "name": "sentinelRewarded",
      "discriminator": [
        238,
        123,
        16,
        5,
        85,
        216,
        164,
        164
      ]
    },
    {
      "name": "sentinelSlashed",
      "discriminator": [
        240,
        199,
        189,
        61,
        70,
        47,
        151,
        212
      ]
    },
    {
      "name": "verdictSubmitted",
      "discriminator": [
        152,
        183,
        133,
        217,
        208,
        91,
        243,
        209
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientStake",
      "msg": "Insufficient stake amount"
    },
    {
      "code": 6001,
      "name": "sentinelInactive",
      "msg": "Sentinel is inactive"
    },
    {
      "code": 6002,
      "name": "invalidConfidence",
      "msg": "Invalid confidence value (0-100)"
    },
    {
      "code": 6003,
      "name": "votingClosed",
      "msg": "Voting window has closed"
    },
    {
      "code": 6004,
      "name": "votingStillOpen",
      "msg": "Voting window still open"
    },
    {
      "code": 6005,
      "name": "quorumNotReached",
      "msg": "Quorum not reached"
    },
    {
      "code": 6006,
      "name": "alreadyFinalized",
      "msg": "Already finalized"
    },
    {
      "code": 6007,
      "name": "notFinalized",
      "msg": "Not yet finalized"
    },
    {
      "code": 6008,
      "name": "alreadyReported",
      "msg": "Already reported as rug"
    },
    {
      "code": 6009,
      "name": "alreadyMarkedDanger",
      "msg": "Token already marked as danger"
    },
    {
      "code": 6010,
      "name": "notRugged",
      "msg": "Token not rugged"
    },
    {
      "code": 6011,
      "name": "votedCorrectly",
      "msg": "Sentinel voted correctly"
    },
    {
      "code": 6012,
      "name": "votedIncorrectly",
      "msg": "Sentinel voted incorrectly"
    },
    {
      "code": 6013,
      "name": "alreadySlashed",
      "msg": "Already slashed"
    },
    {
      "code": 6014,
      "name": "alreadyRewarded",
      "msg": "Already rewarded"
    }
  ],
  "types": [
    {
      "name": "consensusReached",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "verdict",
            "type": {
              "defined": {
                "name": "verdict"
              }
            }
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "totalStake",
            "type": "u64"
          },
          {
            "name": "totalVotes",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocol",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "minStake",
            "type": "u64"
          },
          {
            "name": "verdictWindow",
            "type": "u32"
          },
          {
            "name": "quorum",
            "type": "u16"
          },
          {
            "name": "slashPercent",
            "type": "u8"
          },
          {
            "name": "totalAgents",
            "type": "u64"
          },
          {
            "name": "totalVerdicts",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minStake",
            "type": "u64"
          },
          {
            "name": "verdictWindow",
            "type": "u32"
          },
          {
            "name": "quorum",
            "type": "u16"
          },
          {
            "name": "slashPercent",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rugReported",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "slashPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sentinel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "reputation",
            "type": "u16"
          },
          {
            "name": "correctVerdicts",
            "type": "u64"
          },
          {
            "name": "totalVerdicts",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sentinelRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sentinel",
            "type": "pubkey"
          },
          {
            "name": "stake",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sentinelRewarded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sentinel",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "reputation",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "sentinelSlashed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sentinel",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sentinelVote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sentinel",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "verdict",
            "type": {
              "defined": {
                "name": "verdict"
              }
            }
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "stakeAtVote",
            "type": "u64"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "isSlashed",
            "type": "bool"
          },
          {
            "name": "isRewarded",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenAnalysis",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "finalizedAt",
            "type": "i64"
          },
          {
            "name": "totalVotes",
            "type": "u64"
          },
          {
            "name": "safeVotes",
            "type": "u64"
          },
          {
            "name": "dangerVotes",
            "type": "u64"
          },
          {
            "name": "safeStake",
            "type": "u64"
          },
          {
            "name": "dangerStake",
            "type": "u64"
          },
          {
            "name": "finalVerdict",
            "type": {
              "defined": {
                "name": "verdict"
              }
            }
          },
          {
            "name": "consensusConfidence",
            "type": "u8"
          },
          {
            "name": "isFinalized",
            "type": "bool"
          },
          {
            "name": "isRugged",
            "type": "bool"
          },
          {
            "name": "rugEvidence",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rugReportedAt",
            "type": "i64"
          },
          {
            "name": "slashPool",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "verdict",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "safe"
          },
          {
            "name": "danger"
          }
        ]
      }
    },
    {
      "name": "verdictSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sentinel",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "verdict",
            "type": {
              "defined": {
                "name": "verdict"
              }
            }
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "stake",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
