Hackathon

Within `./hardhat`

start test: `npx hardhat compile && node test/axelar-test.js`
create and start blockchain: `node test/createNetwork.js <YOUR ADDRESS>`
Warning, as your address will probably be different than mine used for test, the hardcoded addresses might be different

Within `./react-fe`

start: `npw yarn start`
In order to have the rights blockchain you need to `create and start blockchain` within `./hardhat`
Tho, swaps don't work within the front end for some reason.


TLDR:
Only tests work