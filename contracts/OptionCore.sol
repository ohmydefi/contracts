pragma solidity 0.5.11;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";


contract OptionCore is Initializable, ERC20Detailed, ERC20 {

    /**
     * The asset used as the underlying token, e.g. DAI
     */
    address public underlyingAsset;

    /**
     * How many decimals does the underlying token have? E.g.: 18
     */
    uint8 public underlyingAssetDecimals;

    /**
     * The strike asset for this vault, e.g. USDC
     */
    address public strikeAsset;

    /**
     * How many decimals does the strike token have? E.g.: 18
     */
    uint8 public strikeAssetDecimals;

    /**
     * The sell price of each unit of strikeAsset; given in units
     * of strikeAsset, e.g. 0.99 USDC
     */
    uint256 public strikePrice;

    /**
     * The number of decimals of strikePrice
     */
    uint8 public strikePriceDecimals;

    /**
     * This option series is considered expired starting from this block
     * number
     */
    uint256 public expirationBlockNumber;

    /**
     * Tracks how much of the strike token each address has locked
     * inside this contract
     */
    mapping(address => uint256) public lockedBalance;

    /**
     * This flag should signal if this contract was deployed in TESTMODE;
     * this means it is not suposed to be used with real money, and it
     * enables some power user features useful for testing environments.
     *
     * On mainnet this flag should return always false.
     */
    bool public isTestingDeployment;

    /**
     * OZ initializer; sets the option series expiration to (block.number
     * + parameter) block number; useful for tests
     */
    function initializeInTestMode(
        string calldata name,
        string calldata symbol,
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _strikePrice,
        uint8 _strikePriceDecimals) external initializer
    {
        _initialize(
            name,
            symbol,
            _underlyingAsset,
            _strikeAsset,
            _strikePrice,
            _strikePriceDecimals,
            ~uint256(0)
        );
        isTestingDeployment = true;
    }

    /**
     * OZ initializer; sets the option series expiration to an exact
     * block number
     */
    function initialize(
        string calldata name,
        string calldata symbol,
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _strikePrice,
        uint8 _strikePriceDecimals,
        uint256 _expirationBlockNumber) external initializer
    {
        _initialize(
            name,
            symbol,
            _underlyingAsset,
            _strikeAsset,
            _strikePrice,
            _strikePriceDecimals,
            _expirationBlockNumber
        );
    }

    /**
     * IF this contract is deployed in TESTMODE, allows the caller
     * to force the option series expiration in one way only.
     */
    function forceExpiration() external {
        if (!isTestingDeployment) {
            revert("Can't force series expiration on non-testing environments");
        }
        expirationBlockNumber = 0;
    }

    /**
     * Utility function to check the amount of the underlying tokens
     * locked inside this contract
     */
    function underlyingBalance() external view returns (uint256) {
        return _contractBalanceOf(underlyingAsset);
    }

    /**
     * Utility function to check the amount of the strike tokens locked
     * inside this contract
     */
    function strikeBalance() external view returns (uint256) {
        return _contractBalanceOf(strikeAsset);
    }

    /**
     * Checks if the options series has already expired.
     */
    function hasExpired() external view returns (bool) {
        return _hasExpired();
    }

    /**
     * Maker modifier for functions which are only allowed to be executed
     * BEFORE series expiration.
     */
    modifier beforeExpiration() {
        if (_hasExpired()) {
            revert("Option has expired");
        }
        _;
    }

    /**
     * Maker modifier for functions which are only allowed to be executed
     * AFTER series expiration.
     */
    modifier afterExpiration() {
        if (!_hasExpired()) {
            revert("Option has not expired yet");
        }
        _;
    }

    /**
     * Internal function to check expiration
     */
    function _hasExpired() internal view returns (bool) {
        return block.number >= expirationBlockNumber;
    }

    /**
     * Check if an asset is ETH which is represented by
     * the address 0x0000000000000000000000000000000000000000
     */
    function _isETH(address asset) internal pure returns (bool) {
        return asset == address(0);
    }

    function _contractBalanceOf(address asset) internal view returns (uint256) {
        if (_isETH(asset)) {
            return address(this).balance;
        }

        return ERC20(asset).balanceOf(address(this));
    }

    /**
     * OZ initializer
     */
    function _initialize(
        string memory name,
        string memory symbol,
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _strikePrice,
        uint8 _strikePriceDecimals,
        uint256 _expirationBlockNumber) private
    {
        ERC20Detailed.initialize(name, symbol, 18);

        underlyingAssetDecimals = 18;
        strikeAsset = _strikeAsset;
        strikeAssetDecimals = 18;
        strikePrice = _strikePrice;
        strikePriceDecimals = _strikePriceDecimals;
        expirationBlockNumber = _expirationBlockNumber;

        if (!_isETH(_underlyingAsset)) {
            underlyingAssetDecimals = ERC20Detailed(_underlyingAsset).decimals();
        }

        if (!_isETH(_strikeAsset)) {
            strikeAssetDecimals = ERC20Detailed(_strikeAsset).decimals();
        }
    }

    uint256[50] private ______gap;
}