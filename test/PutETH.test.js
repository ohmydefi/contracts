const { TestHelper } = require("@openzeppelin/cli");
const { Contracts, ZWeb3 } = require("@openzeppelin/upgrades");
const BN = require("bn.js");

ZWeb3.initialize(web3.currentProvider);

const PutETH = Contracts.getFromLocal("PutETH");
const StandaloneERC20 = Contracts.getFromNodeModules(
  "@openzeppelin/contracts-ethereum-package",
  "StandaloneERC20"
);

require("chai").should();

contract("PutETH", function(accounts) {
  let mockStrikeAsset;
  let puteth;

  let sellerAddress;
  let buyerAddress;

  beforeEach(async function() {
    this.project = await TestHelper();

    sellerAddress = accounts[0];
    buyerAddress = accounts[1];
    anotherSellerHolder = accounts[2];

    mockStrikeAsset = await this.project.createProxy(StandaloneERC20, {
      initMethod: "initialize",
      initArgs: [
        "Fake StrikeAsset",
        "StrikeAsset",
        18,
        (270e18).toString(),
        sellerAddress,
        [],
        []
      ]
    });

    puteth = await this.project.createProxy(PutETH, {
      initMethod: "initializeInTestMode",
      initArgs: [
        "ohETH:STRIKE",
        "OH:ETH:STRIKE",
        mockStrikeAsset.address,
        270000000,
        6,
        "1000001"
      ]
    });
  });

  async function txCost(tx) {
    try {
      const txHash = tx.transactionHash;
      const gasUsed = new BN(tx.gasUsed);
      const txInfo = await ZWeb3.getTransaction(txHash);
      const gasPrice = new BN(txInfo.gasPrice);
      return gasUsed.mul(gasPrice);
    } catch (err) {
      return err;
    }
  }

  async function checkBalances(
    account,
    options,
    strikeAsset,
    underlyingAsset,
    show
  ) {
    if (options !== null) {
      const optionsBalance = await puteth.methods.balanceOf(account).call();
      if (show) console.log("optionsBalance", optionsBalance);
      optionsBalance.should.be.equal(options);
    }

    if (strikeAsset !== null) {
      const strikeAssetBalance = await mockStrikeAsset.methods
        .balanceOf(account)
        .call();
      strikeAssetBalance.should.be.equal(strikeAsset);
    }

    // if (underlyingAsset !== null) {
    //   const daiBalance = await mockUnderlyingAsset.methods.balanceOf(account).call();
    //   daiBalance.should.be.equal(underlyingAsset);
    // }
  }

  async function mintOptions() {
    await mockStrikeAsset.methods
      .approve(puteth.address, (270e18).toString())
      .send({ from: sellerAddress });

    await checkBalances(sellerAddress, "0", (270e18).toString(), "0");
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    await puteth.methods.mint((1e18).toString()).send({ from: sellerAddress });

    await checkBalances(sellerAddress, (1e18).toString(), "0", "0");
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");
  }

  async function mintOptionsDecimals() {
    await mockStrikeAsset.methods
      .approve(puteth.address, (270e18).toString())
      .send({ from: sellerAddress });

    await checkBalances(sellerAddress, "0", (270e18).toString(), "0");
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    await puteth.methods.mint((1e17).toString()).send({ from: sellerAddress });

    await checkBalances(
      sellerAddress,
      (1e17).toString(),
      (270e18 - 270e17).toString(),
      "0"
    );
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");
  }

  describe("general checks", function() {
    it("should have 18 fixed decimals", async function() {
      const decimals = await puteth.methods.decimals().call();
      decimals.should.be.equals("18");
    });
  });

  describe("before expiration", function() {
    afterEach(async function() {
      const expired = await puteth.methods.hasExpired().call();
      expired.should.be.false;
    });

    describe("can mint options by locking strike tokens (integer values)", function() {
      it("should fail if not allowed to spend strike tokens", async function() {
        let failed = false;
        try {
          await puteth.methods.mint("1").send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;
      });

      it("should mint if allowed to spend underlying tokens", async function() {
        await mintOptions();
      });

      it("should be some locked strike asset after exchange", async function() {
        await mintOptions();

        // Check locked balances
        const strikeBalance = await puteth.methods.strikeBalance().call();
        strikeBalance.should.be.equal((270e18).toString());
      });
    });

    describe("can mint options by locking strike tokens (decimal values)", function() {
      it("should fail if not allowed to spend strike tokens", async function() {
        let failed = false;
        try {
          await puteth.methods.mint("1").send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;
      });

      it("should mint if allowed to spend underlying tokens", async function() {
        await mintOptionsDecimals();
      });

      it("should be some locked strike asset after exchange", async function() {
        await mintOptionsDecimals();

        // Check locked balances
        const strikeBalance = await puteth.methods.strikeBalance().call();
        strikeBalance.should.be.equal((270e17).toString());
      });
    });

    describe("can burn options to get back my assets", function() {
     
      it("should be able to burn all my options for all my locked assets", async function() {
        await mintOptions();

        await checkBalances(sellerAddress, (1e18).toString(), "0", null);
        await puteth.methods.burn((1e18).toString()).send({ from: sellerAddress });

        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
      });

    //   /**
    //    * - SellerAddress has 100 DAI
    //    * - USDC holder mints 1 ETH:DAI for 270 DAI
    //    * - USDC holder gives 1.000001 USDC to another holder: 1 DAI:USDC/97.999998 USDC
    //    * - Another holder mints 1 DAI:USDC and send back to USDC holder: 2 DAI:USDC/97.999998 USDC
    //    * - USDC holder tries to burn 2 DAI:USDC and fails because he has only 1.000001 USDC locked inside the contract
    //    */
      it("should not be able to burn more options than the amount of my locked tokens", async function() {
        await mintOptions();

        // SellerAddress -> Transfer 0.5 OPT to anotherRandomAddress
        await puteth.methods
          .transfer(anotherSellerHolder, (5e17).toString())
          .send({ from: sellerAddress });

        await checkBalances(sellerAddress, (5e17).toString(), "0", null);

        let failed = false;
        try {
          await puteth.methods.burn((1e18).toString()).send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;

        // now call burn with right amount
        await puteth.methods.burn((5e17).toString()).send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", (135e18).toString(), null);
      });
    });

    describe("can sell my underlying tokens for the strike tokens at the strike price", function() {
      async function exchangeOptions() {
        await mintOptions();

        // // Transfer 1 option to DAI holder
        // await option.methods
        //   .transfer(daiHolder, "1000000000000000000")
        //   .send({ from: usdcHolder });
        // await checkBalances(usdcHolder, "0", "98999999", "0");
        // await checkBalances(
        //   daiHolder,
        //   "1000000000000000000",
        //   "0",
        //   "100000000000000000000"
        // );

        // Exercise the option
        // await mockDAI.methods
        //   .approve(option.address, "1000000000000000000")
        //   .send({ from: daiHolder });

        await puteth.methods
          .exchange()
          .send({ from: sellerAddress, value: (1e18).toString() });
        await checkBalances(sellerAddress, "0", (270e18).toString(), "0");
        // await checkBalances(daiHolder, "0", "1000001", "99000000000000000000");
      }

      it("should be able to exchange my options", async function() {
        await exchangeOptions();
      });

      it("should be some locked underlying asset after exchange", async function() {
        await exchangeOptions();

        const underlyingBalance = await puteth.methods
          .underlyingBalance()
          .call();
        underlyingBalance.should.be.equal((1e18).toString());

        const strikeBalance = await puteth.methods.strikeBalance().call();
        strikeBalance.should.be.equal("0");
      });
    });

    it("can't withdraw", async function() {
      let failed = false;
      try {
        await option.methods.withdraw().send({ from: sellerAddress });
      } catch (err) {
        failed = true;
      }
      failed.should.be.true;
    });
  });

  describe("after expiration", function() {
    /**
     * Utility function to force the series expiration for these tests
     */
    async function forceExpiration() {
      await puteth.methods.forceExpiration().send({ from: sellerAddress });
      const expired = await puteth.methods.hasExpired().call();
      expired.should.be.true;
    }

    describe("can't mint, burn or exchange options anymore", function() {
      it("should not allow mint()", async function() {
        await mockStrikeAsset.methods
          .approve(puteth.address, (1e18).toString())
          .send({ from: sellerAddress });

        await forceExpiration();
        let failed = false;
        try {
          await puteth.methods.mint().send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;
      });
    });

    describe("must allow transfers because of how uniswap liquidity pools work", function() {
      it("should allow transfer()", async function() {
        await mintOptions();
        await forceExpiration();

        await puteth.methods
          .transfer(anotherSellerHolder, (1e18).toString())
          .send({ from: sellerAddress });
      });

      it("should allow transferFrom()", async function() {
        await mintOptions();
        await forceExpiration();

        await puteth.methods
          .approve(sellerAddress, (1e18).toString())
          .send({ from: sellerAddress });

        await puteth.methods
          .transferFrom(sellerAddress, anotherSellerHolder, (1e18).toString())
          .send({ from: sellerAddress });
      });
    });

    describe("should allow withdraw", function() {
      it("should not allow withdraw with no balance", async function() {
        await forceExpiration();
        let failed = false;
        try {
          await puteth.methods.withdraw().send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;
      });

      it("should allow withdraw locked asset with no holding options", async function() {
        await mintOptions();
        await puteth.methods
          .transfer(anotherSellerHolder, (1e18).toString())
          .send({ from: sellerAddress });
        await forceExpiration();

        await checkBalances(sellerAddress, "0", "0", null);
        await puteth.methods.withdraw().send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
      });

      it("should allow withdraw locked asset with was exercised by another user", async function() {
        await mintOptions();

        // Transfer 1 option to DAI holder
        await puteth.methods
          .transfer(buyerAddress, (1e18).toString())
          .send({ from: sellerAddress });

        // Exercise the option
        await puteth.methods
          .exchange()
          .send({ from: buyerAddress, value: (1e18).toString() });
        await checkBalances(buyerAddress, "0", (270e18).toString(), null);
        const strikeBalance = await puteth.methods.strikeBalance().call();
        strikeBalance.should.be.equal("0");

        await forceExpiration();

        const lockedBalance = await puteth.methods
          .lockedBalance(sellerAddress)
          .call()
          .then(balance => new BN(balance));

        const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const withdrawTx = await puteth.methods
          .withdraw()
          .send({ from: sellerAddress });
        const amountEthAfter = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const withdrawCost = await txCost(withdrawTx);
        const soma = amountEthAfter.add(withdrawCost).sub(lockedBalance);

        soma.eq(initialEthAmount);
        const underlyingBalanceFinal = await puteth.methods
          .underlyingBalance()
          .call();
        underlyingBalanceFinal.should.be.eq("0");
        await checkBalances(sellerAddress, "0", "0", null);

        const finalEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const finalGreaterThanInitial = finalEthAmount.gt(initialEthAmount);
        finalGreaterThanInitial.should.be.true;
      });

      it("should allow withdraw a mix of locked strike asset and asset with was exercised by another user", async function() {
        // 1) SellerAddress -> Mint 1 OPT locking 270 DAIs
        // 2) SellerAddress -> Send 0.5 OPT to AnotherAddress
        // 3) AnotherAddress -> Exchange 0.5 OPT + 0.5 ETH with puteth and receives 135 DAI
        // 4) locked at puteth: 0.5 ETH and 135 DAI
        // 5) System -> forceExpiration()
        // 6) SellerAddress -> Withdraw (his lockedBalance: 1 option)
        // 7) Contract -> Sends -> 0.5 ETH + 135 DAI

        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
        // TODO: add set of parameters to test mint / exchange / withdraw / burn functions
        await mintOptions();
        await checkBalances(sellerAddress, (1e18).toString(), "0", null);

        // Transfer 1 option to DAI holder
        await puteth.methods
          .transfer(anotherSellerHolder, (5e17).toString())
          .send({ from: sellerAddress });

        await checkBalances(anotherSellerHolder, (5e17).toString(), "0", null);

        // Exercise the option
        const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const exchangeTx = await puteth.methods.exchange().send({ from: anotherSellerHolder, value: (5e17).toString() });
        const exchangeCost = await txCost(exchangeTx)
        const finalEthAmount = initialEthAmount.sub(new BN((5e17).toString())).sub(exchangeCost).toString()
        await checkBalances(anotherSellerHolder, "0", (135e18).toString(), finalEthAmount);

        //Expiration
        await forceExpiration();

        //Checks contract balance
        const underlyingBalance = await puteth.methods.strikeBalance().call()

        // Withdraw mixed balance
        const initialEthAmount2 = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const withdrawTx = await puteth.methods.withdraw().send({ from: sellerAddress });
        const withdrawTxCost = await txCost(withdrawTx)
        const finalEthAmount2 = initialEthAmount2.sub(withdrawTxCost).add(new BN(underlyingBalance))
        
        // Contract do not burn the remain OPT token. It becames unusable instead.
        await checkBalances(
          sellerAddress,
          (5e17).toString(),
          (135e18).toString(),
          finalEthAmount2
        );
      });
    });
  });
});
