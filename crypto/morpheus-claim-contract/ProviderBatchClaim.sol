// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IMorpheusSessionRouter {
    function claimForProvider(bytes32 sessionId) external;
}

interface IMorBalance {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Claims Morpheus sessions in atomic batches for one provider.
/// @dev Requires SESSION delegation; payments go directly to the provider.
contract ProviderBatchClaim {
    uint256 public constant MAX_BATCH_SIZE = 100;
    address public immutable provider;
    IMorpheusSessionRouter public immutable router;
    IMorBalance public immutable mor;

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidBatchSize();
    error InvalidMinimumReceived();
    error InsufficientReceived(uint256 received, uint256 minimum);

    event BatchClaimed(address indexed provider, uint256 sessionCount, uint256 received);

    constructor(address provider_, address router_, address mor_) {
        if (provider_ == address(0) || router_.code.length == 0 || mor_.code.length == 0) {
            revert InvalidConfiguration();
        }
        provider = provider_;
        router = IMorpheusSessionRouter(router_);
        mor = IMorBalance(mor_);
    }

    /// @notice Claims 1–100 sessions; reverts on failure or insufficient payment.
    /// @param minimumReceived Full expected MOR payout in base units, greater than zero.
    function claim(bytes32[] calldata sessionIds, uint256 minimumReceived) external returns (uint256 received) {
        if (msg.sender != provider) revert Unauthorized();
        if (sessionIds.length == 0 || sessionIds.length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        if (minimumReceived == 0) revert InvalidMinimumReceived();

        uint256 beforeBalance = mor.balanceOf(provider);
        for (uint256 i; i < sessionIds.length; ++i) {
            router.claimForProvider(sessionIds[i]);
        }
        received = mor.balanceOf(provider) - beforeBalance;
        if (received < minimumReceived) revert InsufficientReceived(received, minimumReceived);
        emit BatchClaimed(provider, sessionIds.length, received);
    }
}
