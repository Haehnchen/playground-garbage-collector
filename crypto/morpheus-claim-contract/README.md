# Morpheus Session Batch Claim Contract

*Created: 2026-10-06 (Updated: 2026-10-06)*

[Morpheus](https://mor.org/) is a decentralized AI network where providers
serve models through inference sessions. Its marketplace contracts run on
Base. [active.mor.org](https://active.mor.org/) shows model and provider
availability.

`ProviderBatchClaim` claims rewards for up to 100 Morpheus inference sessions
**in one transaction**. Only the configured provider can call it. MOR is paid
directly to the provider wallet.

## Delegation

The provider delegates **SESSION rights** for the Morpheus diamond to this
contract through the existing delegate registry. The helper then calls
`claimForProvider` for each session. This is a delegated batch-claim helper;
it uses external calls, not `delegatecall`.

Use the diamond's `DELEGATION_RULES_SESSION()` right. Revoking delegation stops
claims. Token-spending permissions are unnecessary.

## Usage

```solidity
constructor(address provider_, address router_, address mor_)
function claim(bytes32[] calldata sessionIds, uint256 minimumReceived)
    external returns (uint256 received)
```

The provider, router and MOR addresses are immutable. Pass distinct, claimable
session IDs and the full expected payout as `minimumReceived`, in MOR base
units (18 decimals). Zero is rejected.

If any claim reverts or the provider's total balance increase falls below the
minimum, the entire batch reverts. Check current reward capacity and simulate
before submitting; a mined revert still costs gas. The minimum applies to the
batch total, not each session.

The contract has no upgrades or withdrawal function. Do not send funds to it.

## Build

Compile [ProviderBatchClaim.sol](./ProviderBatchClaim.sol) with solc **0.8.30**,
optimizer **200 runs**, EVM **Shanghai**. No external Solidity dependencies.

Protocol implementation:
[Morpheus SessionRouter](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/blob/main/smart-contracts/contracts/diamond/facets/SessionRouter.sol).
