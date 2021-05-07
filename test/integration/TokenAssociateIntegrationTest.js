import {
    AccountCreateTransaction,
    AccountBalanceQuery,
    AccountInfoQuery,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Hbar,
    Status,
    PrivateKey,
} from "../src/exports.js";
import newClient from "./client/index.js";

describe("TokenAssociate", function () {
    it("should be executable", async function () {
        this.timeout(20000);

        const env = await newClient.new();
        const operatorId = env.operatorId;
        const operatorKey = env.operatorKey.publicKey;
        const key = PrivateKey.generate();

        const response = await new AccountCreateTransaction()
            .setKey(key)
            .setNodeAccountIds(env.nodeAccountIds)
            .setInitialBalance(new Hbar(2))
            .execute(env.client);

        const account = (await response.getReceipt(env.client)).accountId;

        const token = (
            await (
                await new TokenCreateTransaction()
                    .setNodeAccountIds([response.nodeId])
                    .setTokenName("ffff")
                    .setTokenSymbol("F")
                    .setDecimals(3)
                    .setInitialSupply(1000000)
                    .setTreasuryAccountId(operatorId)
                    .setAdminKey(operatorKey)
                    .setKycKey(operatorKey)
                    .setFreezeKey(operatorKey)
                    .setWipeKey(operatorKey)
                    .setSupplyKey(operatorKey)
                    .setFreezeDefault(false)
                    .execute(env.client)
            ).getReceipt(env.client)
        ).tokenId;

        await (
            await (
                await new TokenAssociateTransaction()
                    .setNodeAccountIds([response.nodeId])
                    .setTokenIds([token])
                    .setAccountId(account)
                    .freezeWith(env.client)
                    .sign(key)
            ).execute(env.client)
        ).getReceipt(env.client);

        const balances = await new AccountBalanceQuery()
            .setNodeAccountIds([response.nodeId])
            .setAccountId(account)
            .execute(env.client);

        expect(balances.tokens.get(token).toInt()).to.be.equal(0);

        const info = await new AccountInfoQuery()
            .setNodeAccountIds([response.nodeId])
            .setAccountId(account)
            .execute(env.client);

        const relationship = info.tokenRelationships.get(token);

        expect(relationship).to.be.not.null;
        expect(relationship.tokenId.toString()).to.be.equal(token.toString());
        expect(relationship.balance.toInt()).to.be.equal(0);
        expect(relationship.isKycGranted).to.be.false;
        expect(relationship.isFrozen).to.be.false;
    });

    it("should be executable even when no token IDs are set", async function () {
        this.timeout(10000);

        const env = await newClient.new();
        const operatorId = env.operatorId;

        await (
            await new TokenAssociateTransaction()
                .setNodeAccountIds(env.nodeAccountIds)
                .setAccountId(operatorId)
                .execute(env.client)
        ).getReceipt(env.client);
    });

    it("should error when account ID is not set", async function () {
        this.timeout(10000);

        const env = await newClient.new();
        const operatorId = env.operatorId;
        const operatorKey = env.operatorKey.publicKey;

        const response = await new TokenCreateTransaction()
            .setNodeAccountIds(env.nodeAccountIds)
            .setTokenName("ffff")
            .setTokenSymbol("F")
            .setDecimals(3)
            .setInitialSupply(1000000)
            .setTreasuryAccountId(operatorId)
            .setAdminKey(operatorKey)
            .setKycKey(operatorKey)
            .setFreezeKey(operatorKey)
            .setWipeKey(operatorKey)
            .setSupplyKey(operatorKey)
            .setFreezeDefault(false)
            .execute(env.client);

        const token = (await response.getReceipt(env.client)).tokenId;

        let err = false;

        try {
            await (
                await new TokenAssociateTransaction()
                    .setTokenIds([token])
                    .execute(env.client)
            ).getReceipt(env.client);
        } catch (error) {
            err = error.toString().includes(Status.InvalidAccountId);
        }

        if (!err) {
            throw new Error("token association did not error");
        }
    });
});
