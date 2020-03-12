#!/bin/sh
set -e -o pipefail

# get current seller from current ganache session
SELLER="0xE5183018117492Ec4Ee68140a669674F9182FE4A"

# Token mainnet addresses
# clean current dev files from openzeppelin
rm -f .openzeppelin/dev-*

npx oz session --network development --no-interactive
# npx oz push

# Creates a fake DAI and assign 1000 units to my address
npx oz create @openzeppelin/contracts-ethereum-package/StandaloneERC20 --init initialize --args "\"Fake DAI\",DAI,18,1000000000000000000000,$SELLER,[],[]"

OZ_FILE_NAME=`ls .openzeppelin/dev*`

# OZ_FILE="../.openzeppelin/$TESTNET_NAME.json"
STRIKE_ADDRESS=`cat $OZ_FILE_NAME | jq '.proxies["@openzeppelin/contracts-ethereum-package/StandaloneERC20"][0].address' -r`

# # Estimate block number for Dec 3, 2019 == Nov 19 + 80640 blocks
# # 80640 == (14 days * 24 hours * 60 min * 4 blocks/min)
EXPIRATION_BLOCK="150"
STRIKE_PRICE="270"
STRIKE_PRICE_DECIMALS="6"
# # Creates the option series
npx oz create PutETH --init initialize --args "\"cohETH 270:1 DAI\",\"COHETH:DAI\",$STRIKE_ADDRESS,$STRIKE_PRICE,$STRIKE_PRICE_DECIMALS, $EXPIRATION_BLOCK"

PUT_ADDRESS=`cat $OZ_FILE_NAME | jq '.proxies["ro/PutETH"][0].address' -r`
echo "Strike asset address: $STRIKE_ADDRESS"
echo "OZ_DEV_FILE_NAME: $OZ_FILE_NAME"
echo "Put address: $PUT_ADDRESS"

# # npx oz create CallETH --init initialize --args "\"cohETH 270:1 DAI\",\"COHETH:DAI\",$DAI_ADDRESS,$STRIKE_PRICE,$EXPIRATION_BLOCK"
# # CALL_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/CallETH"][0].address' -r`

# echo "\n\nSummary:\n"
# echo "Strike asset address: $STRIKE_ADDRESS"
# echo "Put address: $PUT_ADDRESS"

