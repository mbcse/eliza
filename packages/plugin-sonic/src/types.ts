import { Content } from "@elizaos/core";

export interface BalanceContent extends Content {
    address: string;
}

export interface TransferContent extends Content {
    recipient: string;
    amount: string | number;
}

