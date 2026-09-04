// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MandateMarket} from "../src/MandateMarket.sol";

/**
 * Deploys MandateMarket.
 *
 *   forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
 *
 * ADJUDICATOR is the settlement oracle address. It reports realized alpha and
 * can never move capital to itself; see MandateMarket for the trust boundary.
 */
contract Deploy is Script {
    function run() external returns (MandateMarket market) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address adjudicator = vm.envOr("ADJUDICATOR", vm.addr(pk));

        vm.startBroadcast(pk);
        market = new MandateMarket(adjudicator);
        vm.stopBroadcast();

        console.log("MandateMarket:", address(market));
        console.log("adjudicator  :", adjudicator);
        console.log("owner        :", vm.addr(pk));
    }
}
