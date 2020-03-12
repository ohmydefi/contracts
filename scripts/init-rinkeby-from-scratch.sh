#!/bin/sh
set -e -o pipefail

# insert you address here
MY_ADDRESS="0x2367386801e28b15A7ef606fD55Fe455dfEE6053"
# Token mainnet addresses
# clean current dev files from openzeppelin
OZ_FILE="./.openzeppelin/rinkeby.json"
rm -f $OZ_FILE

npx oz session --network rinkeby --no-interactive
npx oz push

# Creates a fake DAI and assign 1000 units to my address
npx oz create @openzeppelin/contracts-ethereum-package/StandaloneERC20 --init initialize --args "\"Fake DAI\",DAI,18,1000000000000000000000,$MY_ADDRESS,[],[]"

STRIKE_ADDRESS=`cat $OZ_FILE | jq '.proxies["@openzeppelin/contracts-ethereum-package/StandaloneERC20"][0].address' -r`

# Estimate block number for Dec 3, 2019 == Nov 19 + 80640 blocks
# 80640 == (14 days * 24 hours * 60 min * 4 blocks/min)
EXPIRATION_BLOCK="6206477"
STRIKE_PRICE="270000000"
STRIKE_PRICE_DECIMALS="6"
# Creates the option series
npx oz create PutETH --init initialize --args "\"pohETH 270:1 DAI\",\"POHETH:DAI\",$STRIKE_ADDRESS,$STRIKE_PRICE, $STRIKE_PRICE_DECIMALS, $EXPIRATION_BLOCK"
PUT_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/PutETH"][0].address' -r`

npx oz create CallETH --init initialize --args "\"cohETH 270:1 DAI\",\"COHETH:DAI\",$STRIKE_ADDRESS,$STRIKE_PRICE, $STRIKE_PRICE_DECIMALS, $EXPIRATION_BLOCK"
CALL_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/CallETH"][0].address' -r`

echo "\n\nSummary:\n"
echo "My address: $MY_ADDRESS"
echo "Fake Strike Address: $STRIKE_ADDRESS"
echo "Strike address: $DAI_ADDRESS"
echo "Put address: $PUT_ADDRESS"
echo "Call address: $CALL_ADDRESS"

