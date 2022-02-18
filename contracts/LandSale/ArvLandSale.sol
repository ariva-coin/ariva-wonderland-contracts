pragma solidity 0.5.9;

import "../Land.sol";
import "../contracts_common/Interfaces/ERC20.sol";
import "../contracts_common/BaseWithStorage/MetaTransactionReceiver.sol";

contract ArvLandSale is MetaTransactionReceiver {
    uint256 internal constant GRID_SIZE = 15620;

    Land internal _land;
    ERC20 internal _ariva;
    address payable internal _wallet;
    address _admin;

    uint256 _startTime;

    mapping(bytes32 => uint256) private _prices;

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
        uint256 sTime
    ) public {
        require(sTime > block.timestamp, "Invalid");

        _land = Land(landAddress);
        _ariva = ERC20(arivaContractAddress);
        _setMetaTransactionProcessor(initialMetaTx, true);
        _admin = admin;
        _wallet = initialWalletAddress;
        _startTime = sTime;
    }

    modifier onlyAdmin() {
        require(msg.sender == _admin, "only admin can change the receiving wallet");

        _;
    }

    /// @notice set the wallet receiving the proceeds
    /// @param newWallet address of the new receiving wallet
    function setReceivingWallet(address payable newWallet) external onlyAdmin {
        require(newWallet != address(0), "receiving wallet cannot be zero address");
        _wallet = newWallet;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "admin cannot be zero address");
        _admin = newAdmin;
    }

    function setSellQuad(
        uint256 x,
        uint256 y,
        uint256 size,
        uint256 price
    ) external onlyAdmin {
        bytes32 hash = _generateLandHash(x, y, size);
        _prices[hash] = price;
    }

    function setSellQuads(
        uint256[] calldata xs,
        uint256[] calldata ys,
        uint256[] calldata sizes,
        uint256[] calldata prices
    ) external onlyAdmin {
        require(xs.length == ys.length && ys.length == sizes.length && sizes.length == prices.length, "Invalid params");

        for (uint256 index = 0; index < xs.length; index++) {
            uint256 x = xs[index];
            uint256 y = ys[index];
            uint256 size = sizes[index];

            bytes32 hash = _generateLandHash(x, y, size);
            _prices[hash] = prices[index];
        }
    }

    /**
     * @notice buy Land using the merkle proof associated with it
     * @param buyer address that perform the payment
     * @param to address that will own the purchased Land
     * @param x x coordinate of the Land
     * @param y y coordinate of the Land
     * @param size size of the pack of Land to purchase
     * @return The address of the operator
     */
    function buyLand(
        address buyer,
        address to,
        uint256 x,
        uint256 y,
        uint256 size
    ) external {
        require(_startTime < block.timestamp, "Sale is not started");
        /* solhint-disable-next-line not-rely-on-time */
        require(buyer == msg.sender || _metaTransactionContracts[msg.sender], "not authorized");

        bytes32 hash = _generateLandHash(x, y, size);
        uint256 price = _prices[hash];
        require(price > 0, "Not on sale");

        require(_ariva.transferFrom(buyer, _wallet, price), "arv transfer failed");

        _land.transferQuad(address(this), to, size, x, y, "");

        delete _prices[hash];
        emit LandQuadPurchased(buyer, to, x + (y * GRID_SIZE), size, price);
    }

    function withdrawQuad(
        uint256 x,
        uint256 y,
        uint256 size
    ) external onlyAdmin {
        _land.transferQuad(address(this), msg.sender, size, x, y, "");
    }

    function getPrice(
        uint256 x,
        uint256 y,
        uint256 size
    ) external view returns (uint256) {
        bytes32 hash = _generateLandHash(x, y, size);
        return _prices[hash];
    }

    function getPrices(
        uint256[] calldata xs,
        uint256[] calldata ys,
        uint256[] calldata sizes
    ) external view returns (uint256[] memory) {
        require(xs.length == ys.length && ys.length == sizes.length, "Invalid params");

        uint256[] memory prices = new uint256[](xs.length);

        for (uint256 index = 0; index < xs.length; index++) {
            bytes32 hash = _generateLandHash(xs[index], ys[index], sizes[index]);
            prices[index] = _prices[hash];
        }
        return prices;
    }

    function _generateLandHash(
        uint256 x,
        uint256 y,
        uint256 size
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(x, y, size));
    }

    function startTime() external view returns (uint256) {
        return _startTime;
    }

    function setStartTime(uint256 sTime) external onlyAdmin {
        require(sTime > block.timestamp, "Invalid");
        _startTime = sTime;
    }
}