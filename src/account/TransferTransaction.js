import Hbar from "../Hbar.js";
import TokenId from "../token/TokenId.js";
import AccountId from "./AccountId.js";
import Transaction, {
    TRANSACTION_REGISTRY,
} from "../transaction/Transaction.js";
import Long from "long";
import NullableTokenDecimalMap from "./NullableTokenDecimalMap.js";
import Transfer from "../Transfer.js";
import TokenTransfer from "../token/TokenTransfer.js";
import TokenTransferMap from "./TokenTransferMap.js";
import HbarTransferMap from "./HbarTransferMap.js";
import TokenNftTransferMap from "./TokenNftTransferMap.js";
import TokenTransferAccountMap from "./TokenTransferAccountMap.js";
import TokenNftTransfer from "../token/TokenNftTransfer.js";
import NftId from "../token/NftId.js";

/**
 * @typedef {import("../long.js").LongObject} LongObject
 * @typedef {import("bignumber.js").default} BigNumber
 */

/**
 * @namespace proto
 * @typedef {import("@hashgraph/proto").ITransaction} proto.ITransaction
 * @typedef {import("@hashgraph/proto").ISignedTransaction} proto.ISignedTransaction
 * @typedef {import("@hashgraph/proto").TransactionBody} proto.TransactionBody
 * @typedef {import("@hashgraph/proto").ITransactionBody} proto.ITransactionBody
 * @typedef {import("@hashgraph/proto").ITransactionResponse} proto.ITransactionResponse
 * @typedef {import("@hashgraph/proto").ICryptoTransferTransactionBody} proto.ICryptoTransferTransactionBody
 * @typedef {import("@hashgraph/proto").ITokenID} proto.ITokenID
 * @typedef {import("@hashgraph/proto").IAccountID} proto.IAccountID
 * @typedef {import("@hashgraph/proto").IAccountAmount} proto.IAccountAmount
 * @typedef {import("@hashgraph/proto").ITokenTransferList} proto.ITokenTransferList
 */

/**
 * @typedef {import("../channel/Channel.js").default} Channel
 * @typedef {import("../client/Client.js").default<*, *>} Client
 * @typedef {import("../transaction/TransactionId.js").default} TransactionId
 */

/**
 * @typedef {object} TransferTokensInput
 * @property {TokenId | string} tokenId
 * @property {AccountId | string} accountId
 * @property {Long | number} amount
 */

/**
 * @typedef {object} TransferTokenObject
 * @property {TokenId} tokenId
 * @property {AccountId} accountId
 * @property {Long} amount
 */

/**
 * @typedef {object} TransferHbarInput
 * @property {AccountId | string} accountId
 * @property {number | string | Long | BigNumber | Hbar} amount
 */

/**
 * @typedef {object} TransferNftInput
 * @property {TokenId | string} tokenId
 * @property {AccountId | string} sender
 * @property {AccountId | string} recipient
 * @property {Long | number} serial
 */

/**
 * Transfers a new Hedera™ crypto-currency token.
 */
export default class TransferTransaction extends Transaction {
    /**
     * @param {object} [props]
     * @param {(TransferTokensInput)[]} [props.tokenTransfers]
     * @param {(TransferHbarInput)[]} [props.hbarTransfers]
     * @param {(TransferNftInput)[]} [props.nftTransfers]
     */
    constructor(props = {}) {
        super();

        /**
         * @private
         * @type {TokenTransfer[]}
         */
        this._tokenTransfers = [];

        /**
         * @private
         * @type {Transfer[]}
         */
        this._hbarTransfers = [];

        /**
         * @private
         * @type {TokenNftTransfer[]}
         */
        this._nftTransfers = [];

        this._defaultMaxTransactionFee = new Hbar(1);

        for (const transfer of props.tokenTransfers != null
            ? props.tokenTransfers
            : []) {
            this.addTokenTransfer(
                transfer.tokenId,
                transfer.accountId,
                transfer.amount
            );
        }

        for (const transfer of props.hbarTransfers != null
            ? props.hbarTransfers
            : []) {
            this.addHbarTransfer(transfer.accountId, transfer.amount);
        }

        for (const transfer of props.nftTransfers != null
            ? props.nftTransfers
            : []) {
            this.addNftTransfer(
                transfer.tokenId,
                transfer.serial,
                transfer.sender,
                transfer.recipient
            );
        }
    }

    /**
     * @internal
     * @param {proto.ITransaction[]} transactions
     * @param {proto.ISignedTransaction[]} signedTransactions
     * @param {TransactionId[]} transactionIds
     * @param {AccountId[]} nodeIds
     * @param {proto.ITransactionBody[]} bodies
     * @returns {TransferTransaction}
     */
    static _fromProtobuf(
        transactions,
        signedTransactions,
        transactionIds,
        nodeIds,
        bodies
    ) {
        const body = bodies[0];
        const cryptoTransfer =
            /** @type {proto.ICryptoTransferTransactionBody} */ (
                body.cryptoTransfer
            );

        const transfers = new TransferTransaction();

        transfers._tokenTransfers = TokenTransfer._fromProtobuf(
            cryptoTransfer.tokenTransfers != null
                ? cryptoTransfer.tokenTransfers
                : []
        );

        transfers._hbarTransfers = Transfer._fromProtobuf(
            cryptoTransfer.transfers != null
                ? cryptoTransfer.transfers.accountAmounts != null
                    ? cryptoTransfer.transfers.accountAmounts
                    : []
                : []
        );

        transfers._nftTransfers = TokenNftTransfer._fromProtobuf(
            cryptoTransfer.tokenTransfers != null
                ? cryptoTransfer.tokenTransfers
                : []
        );

        return Transaction._fromProtobufTransactions(
            transfers,
            transactions,
            signedTransactions,
            transactionIds,
            nodeIds,
            bodies
        );
    }

    /**
     * @returns {TokenTransferMap}
     */
    get tokenTransfers() {
        const map = new TokenTransferMap();

        for (const transfer of this._tokenTransfers) {
            let transferMap = map.get(transfer.tokenId);

            if (transferMap != null) {
                transferMap._set(transfer.accountId, transfer.amount);
            } else {
                transferMap = new TokenTransferAccountMap();
                transferMap._set(transfer.accountId, transfer.amount);
                map._set(transfer.tokenId, transferMap);
            }
        }

        return map;
    }

    /**
     * @param {TokenId | string} tokenId
     * @param {AccountId | string} accountId
     * @param {number | Long} amount
     * @returns {this}
     */
    addTokenTransfer(tokenId, accountId, amount) {
        this._requireNotFrozen();

        const token =
            tokenId instanceof TokenId ? tokenId : TokenId.fromString(tokenId);
        const account =
            accountId instanceof AccountId
                ? accountId
                : AccountId.fromString(accountId);
        const value = amount instanceof Long ? amount : Long.fromNumber(amount);

        for (const tokenTransfer of this._tokenTransfers) {
            if (
                tokenTransfer.tokenId.compare(token) === 0 &&
                tokenTransfer.accountId.compare(account) === 0
            ) {
                tokenTransfer.amount = tokenTransfer.amount.add(value);
                tokenTransfer.expectedDecimals = null;
                return this;
            }
        }

        this._tokenTransfers.push(
            new TokenTransfer({
                tokenId,
                accountId,
                expectedDecimals: null,
                amount,
                isApproved: false,
            })
        );

        return this;
    }

    /**
     * @param {TokenId | string} tokenId
     * @param {AccountId | string} accountId
     * @param {number | Long} amount
     * @param {number} decimals
     * @returns {this}
     */
    addTokenTransferWithDecimals(tokenId, accountId, amount, decimals) {
        this._requireNotFrozen();

        const token =
            tokenId instanceof TokenId ? tokenId : TokenId.fromString(tokenId);
        const account =
            accountId instanceof AccountId
                ? accountId
                : AccountId.fromString(accountId);
        const value = amount instanceof Long ? amount : Long.fromNumber(amount);

        let found = false;

        for (const tokenTransfer of this._tokenTransfers) {
            if (tokenTransfer.tokenId.compare(token) === 0) {
                if (
                    tokenTransfer.expectedDecimals != null &&
                    tokenTransfer.expectedDecimals !== decimals
                ) {
                    throw new Error("expected decimals mis-match");
                } else {
                    tokenTransfer.expectedDecimals = decimals;
                }

                if (tokenTransfer.accountId.compare(account) === 0) {
                    tokenTransfer.amount = tokenTransfer.amount.add(value);
                    tokenTransfer.expectedDecimals = decimals;
                    found = true;
                }
            }
        }

        if (found) {
            return this;
        }

        this._tokenTransfers.push(
            new TokenTransfer({
                tokenId,
                accountId,
                expectedDecimals: decimals,
                amount,
                isApproved: false,
            })
        );

        return this;
    }

    /**
     * @returns {NullableTokenDecimalMap}
     */
    get tokenIdDecimals() {
        const map = new NullableTokenDecimalMap();

        for (const transfer of this._tokenTransfers) {
            map._set(transfer.tokenId, transfer.expectedDecimals);
        }

        return map;
    }

    /**
     * @returns {HbarTransferMap}
     */
    get hbarTransfers() {
        const map = new HbarTransferMap();

        for (const transfer of this._hbarTransfers) {
            map._set(transfer.accountId, transfer.amount);
        }

        return map;
    }

    /**
     * @internal
     * @param {AccountId | string} accountId
     * @param {number | string | Long | LongObject | BigNumber | Hbar} amount
     * @returns {TransferTransaction}
     */
    addHbarTransfer(accountId, amount) {
        this._requireNotFrozen();

        const account =
            accountId instanceof AccountId
                ? accountId
                : AccountId.fromString(accountId);
        const hbars = amount instanceof Hbar ? amount : new Hbar(amount);

        for (const transfer of this._hbarTransfers) {
            if (transfer.accountId.compare(account) === 0) {
                transfer.amount = Hbar.fromTinybars(
                    transfer.amount.toTinybars().add(hbars.toTinybars())
                );
                return this;
            }
        }

        this._hbarTransfers.push(
            new Transfer({
                accountId: account,
                amount: hbars,
                isApproved: false,
            })
        );

        return this;
    }

    /**
     * @param {Client} client
     */
    _validateChecksums(client) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const transfer of this._hbarTransfers) {
            transfer.accountId.validateChecksum(client);
        }

        for (const transfer of this._tokenTransfers) {
            transfer.tokenId.validateChecksum(client);
            transfer.accountId.validateChecksum(client);
        }

        for (const transfer of this._nftTransfers) {
            transfer.tokenId.validateChecksum(client);
            transfer.senderAccountId.validateChecksum(client);
            transfer.receiverAccountId.validateChecksum(client);
        }
    }

    /**
     * @returns {TokenNftTransferMap}
     */
    get nftTransfers() {
        const map = new TokenNftTransferMap();

        for (const transfer of this._nftTransfers) {
            const transferList = map.get(transfer.tokenId);

            const nftTransfer = {
                sender: transfer.senderAccountId,
                recipient: transfer.receiverAccountId,
                serial: transfer.serialNumber,
                isApproved: transfer.isApproved,
            };

            if (transferList != null) {
                transferList.push(nftTransfer);
            } else {
                map._set(transfer.tokenId, [nftTransfer]);
            }
        }

        return map;
    }

    /**
     * @param {NftId | TokenId | string} tokenIdOrNftId
     * @param {AccountId | string | Long | number} senderAccountIdOrSerialNumber
     * @param {AccountId | string} receiverAccountIdOrSenderAccountId
     * @param {(AccountId | string)=} receiver
     * @returns {TransferTransaction}
     */
    addNftTransfer(
        tokenIdOrNftId,
        senderAccountIdOrSerialNumber,
        receiverAccountIdOrSenderAccountId,
        receiver
    ) {
        this._requireNotFrozen();

        let nftId;
        let senderAccountId;
        let receiverAccountId;

        if (tokenIdOrNftId instanceof NftId) {
            nftId = tokenIdOrNftId;
            senderAccountId =
                typeof senderAccountIdOrSerialNumber === "string"
                    ? AccountId.fromString(senderAccountIdOrSerialNumber)
                    : /** @type {AccountId} */ (senderAccountIdOrSerialNumber);
            receiverAccountId =
                typeof receiverAccountIdOrSenderAccountId === "string"
                    ? AccountId.fromString(receiverAccountIdOrSenderAccountId)
                    : /** @type {AccountId} */ (
                          receiverAccountIdOrSenderAccountId
                      );
        } else if (tokenIdOrNftId instanceof TokenId) {
            nftId = new NftId(
                tokenIdOrNftId,
                /** @type {Long} */ (senderAccountIdOrSerialNumber)
            );
            senderAccountId =
                typeof receiverAccountIdOrSenderAccountId === "string"
                    ? AccountId.fromString(receiverAccountIdOrSenderAccountId)
                    : /** @type {AccountId} */ (
                          receiverAccountIdOrSenderAccountId
                      );
            receiverAccountId =
                typeof receiver === "string"
                    ? AccountId.fromString(receiver)
                    : /** @type {AccountId} */ (receiver);
        } else {
            try {
                nftId = NftId.fromString(tokenIdOrNftId);
                senderAccountId =
                    typeof senderAccountIdOrSerialNumber === "string"
                        ? AccountId.fromString(senderAccountIdOrSerialNumber)
                        : /** @type {AccountId} */ (
                              senderAccountIdOrSerialNumber
                          );
                receiverAccountId =
                    typeof receiverAccountIdOrSenderAccountId === "string"
                        ? AccountId.fromString(
                              receiverAccountIdOrSenderAccountId
                          )
                        : /** @type {AccountId} */ (
                              receiverAccountIdOrSenderAccountId
                          );
            } catch (_) {
                const tokenId = TokenId.fromString(tokenIdOrNftId);
                nftId = new NftId(
                    tokenId,
                    /** @type {Long} */ (senderAccountIdOrSerialNumber)
                );
                senderAccountId =
                    typeof receiverAccountIdOrSenderAccountId === "string"
                        ? AccountId.fromString(
                              receiverAccountIdOrSenderAccountId
                          )
                        : /** @type {AccountId} */ (
                              receiverAccountIdOrSenderAccountId
                          );
                receiverAccountId =
                    typeof receiver === "string"
                        ? AccountId.fromString(receiver)
                        : /** @type {AccountId} */ (receiver);
            }
        }

        for (const nftTransfer of this._nftTransfers) {
            if (
                nftTransfer.tokenId.compare(nftId.tokenId) === 0 &&
                nftTransfer.serialNumber.compare(nftId.serial) === 0
            ) {
                nftTransfer.senderAccountId = senderAccountId;
                nftTransfer.receiverAccountId = receiverAccountId;
                return this;
            }
        }

        this._nftTransfers.push(
            new TokenNftTransfer({
                tokenId: nftId.tokenId,
                serialNumber: nftId.serial,
                senderAccountId,
                receiverAccountId,
                isApproved: false,
            })
        );

        return this;
    }

    /**
     * @param {AccountId | string} accountId
     * @param {boolean} isApproved
     * @returns {TransferTransaction}
     */
    setHbarTransferApproval(accountId, isApproved) {
        const account =
            typeof accountId === "string"
                ? AccountId.fromString(accountId)
                : accountId;

        for (const transfer of this._hbarTransfers) {
            if (transfer.accountId.compare(account) === 0) {
                transfer.isApproved = isApproved;
            }
        }

        return this;
    }

    /**
     * @param {TokenId | string} tokenId
     * @param {AccountId | string} accountId
     * @param {boolean} isApproved
     * @returns {TransferTransaction}
     */
    setTokenTransferApproval(tokenId, accountId, isApproved) {
        const token =
            typeof tokenId === "string" ? TokenId.fromString(tokenId) : tokenId;
        const account =
            typeof accountId === "string"
                ? AccountId.fromString(accountId)
                : accountId;

        for (const tokenTransfer of this._tokenTransfers) {
            if (
                tokenTransfer.tokenId.compare(token) === 0 &&
                tokenTransfer.accountId.compare(account) === 0
            ) {
                tokenTransfer.isApproved = isApproved;
            }
        }

        return this;
    }

    /**
     * @param {NftId | string} nftId
     * @param {boolean} isApproved
     * @returns {TransferTransaction}
     */
    setNftTransferApproval(nftId, isApproved) {
        const nft = typeof nftId === "string" ? NftId.fromString(nftId) : nftId;

        for (const transfer of this._nftTransfers) {
            if (
                transfer.tokenId.compare(nft.tokenId) === 0 &&
                transfer.serialNumber.compare(nft.serial) === 0
            ) {
                transfer.isApproved = isApproved;
            }
        }

        return this;
    }

    /**
     * @override
     * @internal
     * @param {Channel} channel
     * @param {proto.ITransaction} request
     * @returns {Promise<proto.ITransactionResponse>}
     */
    _execute(channel, request) {
        return channel.crypto.cryptoTransfer(request);
    }

    /**
     * @override
     * @protected
     * @returns {NonNullable<proto.TransactionBody["data"]>}
     */
    _getTransactionDataCase() {
        return "cryptoTransfer";
    }

    /**
     * @override
     * @protected
     * @returns {proto.ICryptoTransferTransactionBody}
     */
    _makeTransactionData() {
        /** @type {{tokenId: TokenId; expectedDecimals: number | null; transfers: TokenTransfer[]; nftTransfers: TokenNftTransfer[];}[]} */
        const tokenTransferList = [];

        this._tokenTransfers.sort((a, b) => {
            const compare = a.tokenId.compare(b.tokenId);

            if (compare !== 0) {
                return compare;
            }

            return a.accountId.compare(b.accountId);
        });

        this._nftTransfers.sort((a, b) => {
            const senderComparision = a.senderAccountId.compare(
                b.senderAccountId
            );
            if (senderComparision != 0) {
                return senderComparision;
            }

            const recipientComparision = a.receiverAccountId.compare(
                b.receiverAccountId
            );
            if (recipientComparision != 0) {
                return recipientComparision;
            }

            return a.serialNumber.compare(b.serialNumber);
        });

        let i = 0;
        let j = 0;
        while (
            i < this._tokenTransfers.length ||
            j < this._nftTransfers.length
        ) {
            if (
                i < this._tokenTransfers.length &&
                j < this._nftTransfers.length
            ) {
                const iTokenId = this._tokenTransfers[i].tokenId;
                const jTokenId = this._nftTransfers[j].tokenId;

                const last =
                    tokenTransferList.length > 0
                        ? tokenTransferList[tokenTransferList.length - 1]
                        : null;
                const lastTokenId = last != null ? last.tokenId : null;

                if (
                    last != null &&
                    lastTokenId != null &&
                    lastTokenId.compare(iTokenId) === 0
                ) {
                    last.transfers.push(this._tokenTransfers[i++]);
                    continue;
                }

                if (
                    last != null &&
                    lastTokenId != null &&
                    lastTokenId.compare(jTokenId) === 0
                ) {
                    last.nftTransfers.push(this._nftTransfers[j++]);
                    continue;
                }

                const result = iTokenId.compare(jTokenId);

                if (result === 0) {
                    tokenTransferList.push({
                        tokenId: iTokenId,
                        expectedDecimals:
                            this._tokenTransfers[i].expectedDecimals,
                        transfers: [this._tokenTransfers[i++]],
                        nftTransfers: [this._nftTransfers[j++]],
                    });
                } else if (result <= 0) {
                    tokenTransferList.push({
                        tokenId: iTokenId,
                        expectedDecimals:
                            this._tokenTransfers[i].expectedDecimals,
                        transfers: [this._tokenTransfers[i++]],
                        nftTransfers: [],
                    });
                } else {
                    tokenTransferList.push({
                        tokenId: iTokenId,
                        expectedDecimals: null,
                        transfers: [],
                        nftTransfers: [this._nftTransfers[j++]],
                    });
                }
            } else if (i < this._tokenTransfers.length) {
                const iTokenId = this._tokenTransfers[i].tokenId;

                const last =
                    tokenTransferList.length > 0
                        ? tokenTransferList[tokenTransferList.length - 1]
                        : null;
                const lastTokenId = last != null ? last.tokenId : null;

                if (
                    last != null &&
                    lastTokenId != null &&
                    lastTokenId.compare(iTokenId) === 0
                ) {
                    last.transfers.push(this._tokenTransfers[i++]);
                    continue;
                }

                tokenTransferList.push({
                    tokenId: iTokenId,
                    expectedDecimals: this._tokenTransfers[i].expectedDecimals,
                    transfers: [this._tokenTransfers[i++]],
                    nftTransfers: [],
                });
            } else if (j < this._nftTransfers.length) {
                const jTokenId = this._nftTransfers[j].tokenId;

                const last =
                    tokenTransferList.length > 0
                        ? tokenTransferList[tokenTransferList.length - 1]
                        : null;
                const lastTokenId = last != null ? last.tokenId : null;

                if (
                    last != null &&
                    lastTokenId != null &&
                    lastTokenId.compare(jTokenId) === 0
                ) {
                    last.nftTransfers.push(this._nftTransfers[j++]);
                    continue;
                }

                tokenTransferList.push({
                    tokenId: jTokenId,
                    expectedDecimals: null,
                    transfers: [],
                    nftTransfers: [this._nftTransfers[j++]],
                });
            }
        }

        this._hbarTransfers.sort((a, b) => a.accountId.compare(b.accountId));

        return {
            transfers: {
                accountAmounts: this._hbarTransfers.map((transfer) => {
                    return {
                        accountID: transfer.accountId._toProtobuf(),
                        amount: transfer.amount.toTinybars(),
                        isApproval: transfer.isApproved,
                    };
                }),
            },
            tokenTransfers: tokenTransferList.map((tokenTransfer) => {
                return {
                    token: tokenTransfer.tokenId._toProtobuf(),
                    expectedDecimals:
                        tokenTransfer.expectedDecimals != null
                            ? { value: tokenTransfer.expectedDecimals }
                            : null,
                    transfers: tokenTransfer.transfers.map((transfer) =>
                        transfer._toProtobuf()
                    ),
                    nftTransfers: tokenTransfer.nftTransfers.map((transfer) =>
                        transfer._toProtobuf()
                    ),
                };
            }),
        };
    }
}

TRANSACTION_REGISTRY.set(
    "cryptoTransfer",
    // eslint-disable-next-line @typescript-eslint/unbound-method
    TransferTransaction._fromProtobuf
);
