pragma solidity 0.5.11;

import "./OptionCore.sol";


/**
 * Represents a tokenized american put option series for some
 * long/short token pair.
 *
 * It is fungible and it is meant to be freely tradeable until its
 * expiration time, when its transfer functions will be blocked
 * and the only available operation will be for the option writers
 * to unlock their collateral.
 *
 * Let's take an example: there is such a put option series where buyers
 * may sell 1 DAI for 1 USDC until Dec 31, 2019.
 *
 * In this case:
 *
 * - Expiration date: Dec 31, 2019
 * - Underlying asset: DAI
 * - Strike asset: USDC
 * - Strike price: 1 USDC
 *
 * USDC holders may call mint() until the expiration date, which in turn:
 *
 * - Will lock their USDC into this contract
 * - Will issue put tokens corresponding to this USDC amount
 * - These put tokens will be freely tradable until the expiration date
 *
 * USDC holders who also hold the option tokens may call burn() until the
 * expiration date, which in turn:
 *
 * - Will unlock their USDC from this contract
 * - Will burn the corresponding amount of put tokens
 *
 * Put token holders may call redeem() until the expiration date, to
 * exercise their option, which in turn:
 *
 * - Will sell 1 DAI for 1 USDC (the strike price) each.
 * - Will burn the corresponding amounty of put tokens.
 */
contract PutETH is OptionCore {

    /**
     * Locks some amount of the strike token and writes option tokens.
     *
     * The issued amount ratio is 1:1, i.e., 1 option token for 1 underlying token.
     *
     * It presumes the caller has already called IERC20.approve() on the
     * strike token contract to move caller funds.
     *
     * This function is meant to be called by strike token holders wanting
     * to write option tokens.
     *
     * Options can only be minted while the series is NOT expired.
     *
     * @param amount The amount option tokens to be issued; this will lock
     * for instance amount * strikePrice units of strikeToken into this
     * contract
     */
    function mint(uint256 amount) external beforeExpiration {
        lockedBalance[msg.sender] = lockedBalance[msg.sender].add(amount);
        _mint(msg.sender, amount);

        uint256 amountToTransfer = amount.mul(strikePrice).div(10 ** uint256(strikePriceDecimals));

        // Need to check the Strike Asset Decimals
        // e.g .div(10 ** strikeAssetDecimals)
        // Should check now or during contract deploy? (save gas if is during deploy)
        // Locks the strike asset inside this contract
        require(ERC20(strikeAsset).transferFrom(msg.sender, address(this), amountToTransfer), "Couldn't transfer strike tokens from caller");
    }

    /**
     * Unlocks some amount of the strike token by burning option tokens.
     *
     * This mechanism ensures that users can only redeem tokens they've
     * previously lock into this contract.
     *
     * Options can only be burned while the series is NOT expired.
     */
    function burn(uint256 amount) external beforeExpiration {
        require(amount <= lockedBalance[msg.sender], "Not enough underlying balance");

        // Burn option tokens
        lockedBalance[msg.sender] = lockedBalance[msg.sender].sub(amount);
        _burn(msg.sender, amount);

        uint256 amountToTransfer = amount.mul(strikePrice).div(10 ** uint256(strikePriceDecimals));

        // Unlocks the strike token
        require(ERC20(strikeAsset).transfer(msg.sender, amountToTransfer), "Couldn't transfer back strike tokens to caller");
    }

    /**
     * Allow put token holders to use them to sell some amount of units
     * of the underlying token for the amount * strike price units of the
     * strike token.
     *
     * It presumes the caller has already called IERC20.approve() on the
     * underlying token contract to move caller funds.
     *
     * During the process:
     *
     * - The amount * strikePrice of strike tokens are transferred to the
     * caller
     * - The amount of option tokens are burned
     * - The amount of underlying tokens are transferred into
     * this contract as a payment for the strike tokens
     *
     * Options can only be exchanged while the series is NOT expired.
     */
    function exchange() external payable beforeExpiration {
        // Gets the payment from the caller by transfering them
        // to this contract
        uint256 underlyingAmount = msg.value.mul(strikePrice).div(10 ** uint256(strikePriceDecimals));
        // Transfers the strike tokens back in exchange
        _burn(msg.sender, msg.value);
        require(ERC20(strikeAsset).transfer(msg.sender, underlyingAmount), "Couldn't transfer strike tokens to caller");
    }

    /**
     * After series expiration, allow addresses who have locked their strike
     * asset tokens to withdraw them on first-come-first-serve basis.
     *
     * If there is not enough of strike asset because the series have been
     * exercised, the remaining balance is converted into the underlying asset
     * and given to the caller.
     */
    function withdraw() external afterExpiration {
        uint256 amount = lockedBalance[msg.sender];
        require(amount > 0, "You do not have balance to withdraw");
        _redeem(amount);
    }

    function _redeem(uint256 amount) internal {
        // Calculates how many underlying/strike tokens the caller
        // will get back
        uint256 currentStrikeBalance = ERC20(strikeAsset).balanceOf(address(this));
        uint256 strikeToReceive = amount.mul(strikePrice).div(10 ** uint256(strikePriceDecimals));
        uint256 underlyingToReceive = 0;
        if (strikeToReceive > currentStrikeBalance) {

            uint256 underlyingAmount = strikeToReceive.sub(currentStrikeBalance);
            strikeToReceive = currentStrikeBalance;

            underlyingToReceive = underlyingAmount.div(strikePrice).mul(10 ** uint256(strikePriceDecimals));
        }
        // require(amount <= lockedBalance[msg.sender]), "Withdraw amount exceeds lockedBalance")
        // We need to check if the person has enough lockedBalance

        // Unlocks the underlying token
        lockedBalance[msg.sender] = lockedBalance[msg.sender].sub(amount);
        if (strikeToReceive > 0) {
            require(ERC20(strikeAsset).transfer(msg.sender, strikeToReceive), "Couldn't transfer back strike tokens to caller");
        }
        if (underlyingToReceive > 0) {
            require(msg.sender.send(underlyingToReceive), "Couldn't transfer back underlying tokens to caller");
        }
    }

}
