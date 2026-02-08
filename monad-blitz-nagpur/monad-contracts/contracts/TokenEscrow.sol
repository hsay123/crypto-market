// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TokenEscrow {
    address public owner;

    // adId => seller => token => locked amount
    mapping(string => mapping(address => mapping(address => uint256))) public lockedByAd;
    
    // adId => seller address (for quick lookup)
    mapping(string => address) public adSeller;

    // Fixed: max 3 indexed parameters per event (Solidity limit)
    event TokensLocked(string indexed adId, address indexed seller, address indexed token, uint256 amount);
    event TokensReleased(string indexed adId, address indexed seller, address indexed buyer, address token, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    // User must approve this contract to spend their tokens before calling this
    // Locks tokens for a specific adId
    function lockTokens(string memory adId, address token, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(bytes(adId).length > 0, "AdId cannot be empty");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        lockedByAd[adId][msg.sender][token] += amount;
        adSeller[adId] = msg.sender; // Store seller for this ad
        
        emit TokensLocked(adId, msg.sender, token, amount);
    }

    // Only owner (platform) can release tokens to buyer after payment confirmation
    function releaseTokens(string memory adId, address buyer, address token, uint256 amount) external {
        require(msg.sender == owner, "Only owner can release");
        require(buyer != address(0), "Invalid buyer address");
        require(amount > 0, "Amount must be > 0");
        
        address seller = adSeller[adId];
        require(seller != address(0), "Ad not found");
        require(lockedByAd[adId][seller][token] >= amount, "Insufficient locked");
        
        lockedByAd[adId][seller][token] -= amount;
        require(IERC20(token).transfer(buyer, amount), "Release failed");
        
        emit TokensReleased(adId, seller, buyer, token, amount);
    }

    // Get locked amount for an ad
    function getLockedAmount(string memory adId, address seller, address token) external view returns (uint256) {
        return lockedByAd[adId][seller][token];
    }
}
