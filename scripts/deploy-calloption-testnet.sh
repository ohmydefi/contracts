#!/bin/sh
set -e -o pipefail

if [[ -z $MY_ADDRESS ]]; then
    echo "You should export an environment variable containing your ETH address:\n"
    echo "export MY_ADDRESS=\"0x...\""
    exit 1
fi

TESTNET_NAME=$1
if [[ -z $TESTNET_NAME ]]; then
    echo "Usage:\n"
    echo "$0 <testnet name>"
    exit 1
fi

OZ_FILE="../.openzeppelin/$TESTNET_NAME.json"
rm -f $OZ_FILE

npx oz session --network $TESTNET_NAME --no-interactive
npx oz push

# Creates a fake DAI and assign 1000 units to my address
npx oz create @openzeppelin/contracts-ethereum-package/StandaloneERC20 --init initialize --args "\"Fake DAI\",DAI,18,1000000000000000000000,$MY_ADDRESS,[],[]"
DAI_ADDRESS=`cat $OZ_FILE | jq '.proxies["@openzeppelin/contracts-ethereum-package/StandaloneERC20"][0].address' -r`

# Uses WETH
WETH_ADDRESS="0xd0a1e359811322d97991e03f863a0c30c2cf029c"

# Set strike price to 170 DAI
STRIKE_PRICE=$(printf '%5.0f\n' '200e18')

# Define some variables
NAME="\"ohETH 200 DAI\""
SYMBOL="\"OHETH:ETH:200\""
DECIMALS=18

# Creates the option series
#npx oz create Option --init initializeInTestMode --args "$NAME,$SYMBOL,$WETH_ADDRESS,$DECIMALS,$DAI_ADDRESS,$STRIKE_PRICE" --skip-compile
#OPTION_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/Option"][0].address' -r`

npx oz create ETHOption --init initialize --args "$NAME,$SYMBOL,$DAI_ADDRESS,$DECIMALS,$WETH_ADDRESS,$STRIKE_PRICE,16770200" --skip-compile
OPTION_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/ETHOption"][0].address' -r`

echo "\n\nSummary:\n"
echo "My address:     $MY_ADDRESS"
echo "DAI address:    $DAI_ADDRESS"
echo "WETH address:   $WETH_ADDRESS"
echo "Option address: $OPTION_ADDRESS"
