// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateMarket} from "../src/MandateMarket.sol";

contract MandateMarketTest is Test {
    MandateMarket internal market;

    address internal owner = address(this);
    address internal adjudicator = makeAddr("adjudicator");
    address internal principal = makeAddr("principal");
    address internal alice = makeAddr("alice"); // incumbent agent
    address internal bob = makeAddr("bob"); // successor
    address internal carol = makeAddr("carol");

    uint32 internal constant EPOCH = 1 hours;
    uint32 internal constant EPOCHS = 10;
    uint16 internal constant TOLERANCE = 200; // 2%
    uint16 internal constant FEE = 2_000; // 20% of alpha
    uint16 internal constant SLASH = 2_500; // 25% of bond per failing epoch

    function setUp() public {
        market = new MandateMarket(adjudicator);
        vm.deal(principal, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    // ------------------------------------------------------------ helpers --

    function _open(uint256 capital) internal returns (uint256 id) {
        vm.prank(principal);
        id = market.openMandate{value: capital}(
            MandateMarket.Category.Rebalancing, TOLERANCE, FEE, SLASH, EPOCH, EPOCHS
        );
    }

    function _bid(uint256 id, address agent, uint256 bond, int16 target) internal returns (uint256) {
        vm.prank(agent);
        return market.bid{value: bond}(id, target);
    }

    function _settle(uint256 id, int256 alphaBps) internal {
        vm.warp(block.timestamp + EPOCH);
        vm.prank(adjudicator);
        market.settleEpoch(id, alphaBps);
    }

    /**
     * @dev The invariant that matters: the contract must always hold at least
     *      what it owes. Liabilities are escrowed capital, escrowed bonds
     *      (incumbent and queued), slashes still inside the challenge window,
     *      and pull-payment balances.
     */
    function _assertSolvent(uint256 mandateCount, address[] memory parties) internal view {
        uint256 liabilities;
        for (uint256 i = 0; i < mandateCount; i++) {
            MandateMarket.Mandate memory m = market.getMandate(i);
            liabilities += m.capital + m.bond;
            MandateMarket.Bid[] memory bids = market.getBids(i);
            for (uint256 j = 0; j < bids.length; j++) {
                if (!bids[j].spent) liabilities += bids[j].bond;
            }
            for (uint32 e = 0; e < EPOCHS; e++) {
                (uint96 amount,,,, bool resolved) = market.pendingSlash(i, e);
                if (amount > 0 && !resolved) liabilities += amount;
            }
        }
        for (uint256 i = 0; i < parties.length; i++) {
            liabilities += market.withdrawable(parties[i]);
        }
        assertGe(address(market).balance, liabilities, "insolvent: owes more than it holds");
    }

    function _parties() internal view returns (address[] memory p) {
        p = new address[](5);
        p[0] = principal;
        p[1] = alice;
        p[2] = bob;
        p[3] = carol;
        p[4] = adjudicator;
    }

    // -------------------------------------------------------- lifecycle --

    function test_OpenAwardAndSettlePositiveEpoch() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);

        vm.prank(principal);
        market.award(id, 0);

        MandateMarket.Mandate memory m = market.getMandate(id);
        assertEq(m.agent, alice);
        assertEq(m.bond, 1 ether);
        assertEq(uint8(m.state), uint8(MandateMarket.State.Active));

        // +5% alpha on 10 ether = 0.5 ether gain; 20% fee = 0.1 ether.
        _settle(id, 500);

        m = market.getMandate(id);
        assertEq(market.withdrawable(alice), 0.1 ether, "fee");
        assertEq(m.capital, 10 ether - 0.1 ether, "fee charged to escrow, not minted");
        assertEq(m.cumulativeAlphaBps, 500);
        _assertSolvent(1, _parties());
    }

    function test_WithinToleranceNeitherRewardsNorPunishes() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        _settle(id, -150); // inside the 2% tolerance

        MandateMarket.Mandate memory m = market.getMandate(id);
        assertEq(m.bond, 1 ether, "no slash inside tolerance");
        assertEq(market.withdrawable(alice), 0, "no fee for trailing");
        _assertSolvent(1, _parties());
    }

    function test_UnderperformanceSlashesTheBond() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        _settle(id, -500); // beyond tolerance, not catastrophic

        MandateMarket.Mandate memory m = market.getMandate(id);
        assertEq(m.bond, 0.75 ether, "25% of bond slashed");
        assertEq(m.strikes, 1);

        (uint96 amount,, address who, bool contested, bool resolved) = market.pendingSlash(id, 0);
        assertEq(amount, 0.25 ether);
        assertEq(who, alice);
        assertFalse(contested);
        assertFalse(resolved);
        _assertSolvent(1, _parties());
    }

    // ------------------------------------------------- dismissal, live --

    /// @notice The demo moment: fired and replaced inside one transaction.
    function test_CatastrophicEpochDismissesAndPromotesSuccessorSameTx() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        _bid(id, bob, 2 ether, 450); // stronger commitment, waiting

        vm.prank(principal);
        market.award(id, 0);
        assertEq(market.successor(id), bob);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(adjudicator);

        vm.expectEmit(true, true, false, false);
        emit MandateMarket.AgentDismissed(id, alice, "catastrophic underperformance");
        vm.expectEmit(true, true, false, true);
        emit MandateMarket.MandateAwarded(id, bob, 2 ether);

        market.settleEpoch(id, -1_500); // -15%

        MandateMarket.Mandate memory m = market.getMandate(id);
        assertEq(m.agent, bob, "successor holds the mandate");
        assertEq(m.bond, 2 ether, "successor's bond is now at risk");
        assertEq(uint8(m.state), uint8(MandateMarket.State.Active));
        assertEq(m.strikes, 0, "successor starts clean");

        // Alice keeps the residual of her bond; only the slash is forfeit.
        assertEq(market.withdrawable(alice), 0.75 ether);
        _assertSolvent(1, _parties());
    }

    function test_ThreeConsecutiveFailuresDismiss() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 4 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        _settle(id, -400);
        _settle(id, -400);
        assertEq(market.getMandate(id).agent, alice, "still holding after two");

        _settle(id, -400);
        assertEq(market.getMandate(id).agent, address(0), "dismissed on the third");
        _assertSolvent(1, _parties());
    }

    function test_PositiveEpochResetsStrikes() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 4 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        _settle(id, -400);
        _settle(id, -400);
        _settle(id, 300); // recovery
        assertEq(market.getMandate(id).strikes, 0);
        _settle(id, -400);
        assertEq(market.getMandate(id).agent, alice, "one strike, not three");
        _assertSolvent(1, _parties());
    }

    function test_NoSuccessorLeavesMandateOpen() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(adjudicator);
        market.settleEpoch(id, -2_000);

        MandateMarket.Mandate memory m = market.getMandate(id);
        assertEq(m.agent, address(0));
        assertEq(uint8(m.state), uint8(MandateMarket.State.Open), "reopened for bidding");
        _assertSolvent(1, _parties());
    }

    // ----------------------------------------------------- slash disputes --

    function test_UncontestedSlashClaimableAfterWindow() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);
        _settle(id, -500);

        vm.expectRevert(MandateMarket.WindowOpen.selector);
        market.claimSlash(id, 0);

        vm.warp(block.timestamp + 25 hours);
        market.claimSlash(id, 0);
        assertEq(market.withdrawable(principal), 0.25 ether);
        _assertSolvent(1, _parties());
    }

    function test_ContestedSlashCannotBeClaimedAndOwnerResolves() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);
        _settle(id, -500);

        vm.prank(alice);
        market.contestSlash(id, 0);

        vm.warp(block.timestamp + 25 hours);
        vm.expectRevert(MandateMarket.AlreadyResolved.selector);
        market.claimSlash(id, 0);

        // Overturned: the bond comes back to the agent.
        market.resolveSlash(id, 0, false);
        assertEq(market.withdrawable(alice), 0.25 ether);
        _assertSolvent(1, _parties());
    }

    function test_OnlySlashedAgentMayContest() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);
        _settle(id, -500);

        vm.prank(bob);
        vm.expectRevert(MandateMarket.NotBidder.selector);
        market.contestSlash(id, 0);
    }

    // ------------------------------------------------------ access control --

    function test_OnlyAdjudicatorSettles() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(alice);
        vm.expectRevert(MandateMarket.NotAdjudicator.selector);
        market.settleEpoch(id, 5_000); // an agent cannot pay itself
    }

    function test_OnlyPrincipalAwards() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(alice);
        vm.expectRevert(MandateMarket.NotPrincipal.selector);
        market.award(id, 0);
    }

    function test_AdjudicatorCannotDrainToItself() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);
        _settle(id, 5_000); // maximum flattery
        assertEq(market.withdrawable(adjudicator), 0, "adjudicator earns nothing, ever");
        _assertSolvent(1, _parties());
    }

    function test_AlphaIsBounded() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        vm.warp(block.timestamp + EPOCH);
        vm.prank(adjudicator);
        vm.expectRevert(MandateMarket.BadParameters.selector);
        market.settleEpoch(id, 200_000);
    }

    function test_EpochCannotBeSettledEarly() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        vm.prank(adjudicator);
        vm.expectRevert(MandateMarket.EpochNotElapsed.selector);
        market.settleEpoch(id, 100);
    }

    // ----------------------------------------------------------- bids --

    function test_IncumbentCannotWithdrawItsBond() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        vm.prank(principal);
        market.award(id, 0);

        vm.prank(alice);
        vm.expectRevert(MandateMarket.BidSpent.selector);
        market.withdrawBid(id, 0);
    }

    function test_LosingBidderMayWithdraw() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        _bid(id, bob, 2 ether, 100);
        vm.prank(principal);
        market.award(id, 0);

        vm.prank(bob);
        market.withdrawBid(id, 1);
        assertEq(market.withdrawable(bob), 2 ether);
        assertEq(market.successor(id), address(0), "queue is empty once withdrawn");
        _assertSolvent(1, _parties());
    }

    function test_BondBelowMinimumRejected() public {
        uint256 id = _open(10 ether);
        vm.prank(alice);
        vm.expectRevert(MandateMarket.BondTooSmall.selector);
        market.bid{value: 0.001 ether}(id, 300);
    }

    // --------------------------------------------------------- settlement --

    function test_CloseReturnsCapitalAndReleasesBond() public {
        uint256 id = _open(10 ether);
        _bid(id, alice, 1 ether, 300);
        _bid(id, carol, 1 ether, 100);
        vm.prank(principal);
        market.award(id, 0);

        for (uint256 i = 0; i < EPOCHS; i++) _settle(id, 0);

        market.closeMandate(id);
        assertEq(market.withdrawable(principal), 10 ether, "capital home");
        assertEq(market.withdrawable(alice), 1 ether, "bond released");
        assertEq(market.withdrawable(carol), 1 ether, "queued bond released");
        _assertSolvent(1, _parties());
    }

    function test_WithdrawIsPullAndClearsBalance() public {
        uint256 id = _open(1 ether);
        vm.prank(principal);
        market.closeMandate(id); // abandoned, never awarded

        uint256 before = principal.balance;
        vm.prank(principal);
        market.withdraw();
        assertEq(principal.balance, before + 1 ether);
        assertEq(market.withdrawable(principal), 0);

        vm.prank(principal);
        vm.expectRevert(MandateMarket.NothingToWithdraw.selector);
        market.withdraw();
    }

    // --------------------------------------------------------------- fuzz --

    /// @notice Solvency must hold for any sequence of reported alpha.
    function testFuzz_SolventUnderAnyAlphaSequence(int256 a1, int256 a2, int256 a3) public {
        a1 = bound(a1, -market.MAX_ALPHA_BPS(), market.MAX_ALPHA_BPS());
        a2 = bound(a2, -market.MAX_ALPHA_BPS(), market.MAX_ALPHA_BPS());
        a3 = bound(a3, -market.MAX_ALPHA_BPS(), market.MAX_ALPHA_BPS());

        uint256 id = _open(10 ether);
        _bid(id, alice, 2 ether, 300);
        _bid(id, bob, 2 ether, 200);
        vm.prank(principal);
        market.award(id, 0);

        int256[3] memory alphas = [a1, a2, a3];
        for (uint256 i = 0; i < 3; i++) {
            MandateMarket.Mandate memory m = market.getMandate(id);
            if (m.state != MandateMarket.State.Active) break;
            if (m.epochsSettled >= m.epochsTotal) break;
            _settle(id, alphas[i]);
            _assertSolvent(1, _parties());
        }
        _assertSolvent(1, _parties());
    }
}
