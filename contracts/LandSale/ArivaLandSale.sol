pragma solidity 0.5.9;

import "../Land.sol";
import "../contracts_common/Interfaces/ERC20.sol";
import "../contracts_common/BaseWithStorage/MetaTransactionReceiver.sol";

/**
 * @title Land Sale contract
 * @notice This contract mananges the sale of our lands
 */
contract ArivaLandSale is MetaTransactionReceiver {
    uint256 internal constant GRID_SIZE = 408; // 408 is the size of the Land

    Land internal _land;
    ERC20 internal _ariva;
    address payable internal _wallet;
    uint256 internal _expiryTime;

    mapping(bytes32 => bool) private _whitelist;

    event LandQuadPurchased(
        address indexed buyer,
        address indexed to,
        uint256 indexed topCornerId,
        uint256 size,
        uint256 price
    );

    constructor(
        address landAddress,
        address arivaContractAddress,
        address initialMetaTx,
        address admin,
        address payable initialWalletAddress,
        uint256 expiryTime
    ) public {
        _land = Land(landAddress);
        _ariva = ERC20(arivaContractAddress);
        _setMetaTransactionProcessor(initialMetaTx, true);
        _admin = admin;
        _wallet = initialWalletAddress;
        _expiryTime = expiryTime;
    }

    /// @notice set the wallet receiving the proceeds
    /// @param newWallet address of the new receiving wallet
    function setReceivingWallet(address payable newWallet) external {
        require(newWallet != address(0), "receiving wallet cannot be zero address");
        require(msg.sender == _admin, "only admin can change the receiving wallet");
        _wallet = newWallet;
    }

    function isWhitelisted(
        uint256 x,
        uint256 y,
        uint256 size,
        uint256 price,
        address reserved
    ) public view returns (bool) {
        bytes32 hash = _generateLandHash(x, y, size, price, reserved);
        return _whitelist[hash];
    }

    function _generateLandHash(
        uint256 x,
        uint256 y,
        uint256 size,
        uint256 price,
        address reserved
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(x, y, size, price, reserved));
    }

    function setWhitelist(
        uint256 x,
        uint256 y,
        uint256 size,
        uint256 price,
        address reserved,
        bool whitelist
    ) external {
        require(msg.sender == _admin, "Not admin");
        bytes32 hash = _generateLandHash(x, y, size, price, reserved);
        _whitelist[hash] = whitelist;
    }

    /**
     * @notice buy Land using the merkle proof associated with it
     * @param buyer address that perform the payment
     * @param to address that will own the purchased Land
     * @param reserved the reserved address (if any)
     * @param x x coordinate of the Land
     * @param y y coordinate of the Land
     * @param size size of the pack of Land to purchase
     * @param price amount of Sand to purchase that Land
     * @return The address of the operator
     */
    function buyLandWithSand(
        address buyer,
        address to,
        address reserved,
        uint256 x,
        uint256 y,
        uint256 size,
        uint256 price
    ) external {
        /* solhint-disable-next-line not-rely-on-time */
        require(block.timestamp < _expiryTime, "sale is over");
        require(buyer == msg.sender || _metaTransactionContracts[msg.sender], "not authorized");
        require(reserved == address(0) || reserved == buyer, "cannot buy reserved Land");
        require(isWhitelisted(x, y, size, price, buyer), "Not whitelisted");

        require(_ariva.transferFrom(buyer, _wallet, price), "sand transfer failed");

        _land.mintQuad(to, size, x, y, "");
        emit LandQuadPurchased(buyer, to, x + (y * GRID_SIZE), size, price);
    }

    /**
     * @notice Gets the expiry time for the current sale
     * @return The expiry time, as a unix epoch
     */
    function getExpiryTime() external view returns (uint256) {
        return _expiryTime;
    }
}
