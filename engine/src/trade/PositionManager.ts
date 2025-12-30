
import { RedisManager } from "../RedisManager";
import { Fill } from "./Orderbook";

export interface Position {
    userId: string;
    market: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    unrealizedPnL: number;
    created_at: number;
}

export class PositionManager {
    // Redis key helpers
    private getPositionKey(userId: string, market: string) {
        return `positions:${userId}:${market}`;
    }

    private async getPosition(userId: string, market: string): Promise<Position | null> {
        const key = this.getPositionKey(userId, market);
        const data = await RedisManager.getInstance().get(key);
        if (!data) return null;
        return JSON.parse(data);
    }

    private async savePosition(position: Position) {
        const key = this.getPositionKey(position.userId, position.market);
        await RedisManager.getInstance().set(key, JSON.stringify(position));

        // Add to active positions set for PnL updates
        await RedisManager.getInstance().client.sAdd(`active_positions:${position.market}`, position.userId);

        // Publish to User (Real-time update)
        RedisManager.getInstance().publishMessage(`positions:${position.userId}`, {
            stream: `positions:${position.userId}`,
            data: {
                e: "POSITION_UPDATE", // Added 'e' for SignalingManager compatibility
                type: "POSITION_UPDATE",
                data: position
            }
        } as any);

        // Persist to DB (Queue)
        this.persistPositionUpdate(position);
    }

    private async deletePosition(userId: string, market: string) {
        const key = this.getPositionKey(userId, market);
        await RedisManager.getInstance().client.del(key);
        await RedisManager.getInstance().client.sRem(`active_positions:${market}`, userId);

        // Notify User of Close
        RedisManager.getInstance().publishMessage(`positions:${userId}`, {
            stream: `positions:${userId}`,
            data: {
                e: "POSITION_CLOSED",
                type: "POSITION_CLOSED",
                data: { userId, market }
            }
        } as any);

        // Persist DB deletion (or update status to closed if tracking closed in same table, but strict design separates them)
        // Here we delete from open_positions and expect history insert
        RedisManager.getInstance().pushMessage({
            type: "POSITION_CLOSED",
            data: { userId, market }
        } as any); // Type needs extension
    }

    private persistPositionUpdate(position: Position) {
        RedisManager.getInstance().pushMessage({
            type: "POSITION_UPDATED",
            data: position
        } as any); // Type needs extension
    }

    private persistHistory(userId: string, market: string, side: "long" | "short", entryPrice: number, closePrice: number, quantity: number, realizedPnL: number, openedAt: number) {
        RedisManager.getInstance().pushMessage({
            type: "POSITION_HISTORY",
            data: {
                userId,
                market,
                side,
                entryPrice,
                closePrice,
                quantity,
                realizedPnL,
                openedAt
            }
        } as any); // Type needs extension
    }

    public async updatePosition(fill: Fill, side: "buy" | "sell", market: string) {
        const userId = fill.otherUserId; // Make sure we handle both Maker and Taker sides!
        // This method processes ONE user's side of the trade. Engine should call this twice (taker, maker).

        // Map order side to position side
        // If user BOUGHT -> They are Long (or reducing Short)
        // If user SOLD -> They are Short (or reducing Long)

        // "side" param is the ORDER side. 
        // If "buy" order -> position effect is LONG
        // If "sell" order -> position effect is SHORT

        const positionSideEffect = side === "buy" ? "long" : "short";

        let position = await this.getPosition(userId, market);

        if (!position) {
            // New Position
            position = {
                userId,
                market,
                side: positionSideEffect,
                entryPrice: Number(fill.price),
                quantity: fill.qty,
                unrealizedPnL: 0,
                created_at: Date.now()
            };
            await this.savePosition(position);
            console.log(`[Positions] New ${position.side} position for ${userId} on ${market}`);
            return;
        }

        // Existing Position
        if (position.side === positionSideEffect) {
            // INCREASE Position
            const totalCost = (position.quantity * position.entryPrice) + (fill.qty * Number(fill.price));
            const newQty = position.quantity + fill.qty;
            const newEntry = totalCost / newQty;

            position.entryPrice = newEntry;
            position.quantity = newQty;

            await this.savePosition(position);
            console.log(`[Positions] Increased ${position.side} position for ${userId}. Avg: ${newEntry}`);

        } else {
            // DECREASE / CLOSE Position (Netting)
            const closeQty = Math.min(position.quantity, fill.qty);
            const remainingQty = position.quantity - fill.qty; // Could be negative if flipping

            // Realized PnL Calculation
            // Long covers (sells): (Exit - Entry)
            // Short covers (buys): (Entry - Exit)

            let pnl = 0;
            if (position.side === "long") {
                pnl = (Number(fill.price) - position.entryPrice) * closeQty;
            } else {
                pnl = (position.entryPrice - Number(fill.price)) * closeQty;
            }

            console.log(`[Positions] Closing ${closeQty} of ${position.side}. PnL: ${pnl}`);

            // Persist History
            this.persistHistory(userId, market, position.side, position.entryPrice, Number(fill.price), closeQty, pnl, position.created_at);

            if (remainingQty > 0) {
                // Partial Close
                position.quantity = remainingQty;
                await this.savePosition(position);
            } else if (remainingQty === 0) {
                // Full Close
                await this.deletePosition(userId, market);
            } else {
                // FLIP Position
                const flipQty = Math.abs(remainingQty);
                await this.deletePosition(userId, market); // Close old

                // Open new opposite
                const newPosition: Position = {
                    userId,
                    market,
                    side: positionSideEffect,
                    entryPrice: Number(fill.price),
                    quantity: flipQty,
                    unrealizedPnL: 0,
                    created_at: Date.now()
                };
                await this.savePosition(newPosition);
                console.log(`[Positions] Flipped to ${newPosition.side} for ${userId}`);
            }
        }
    }

    public async updateUnrealizedPnL(market: string, currentPrice: number) {
        if (!currentPrice || currentPrice <= 0) return;

        const client = RedisManager.getInstance().client;
        const userIds = await client.sMembers(`active_positions:${market}`);

        for (const userId of userIds) {
            const key = this.getPositionKey(userId, market);
            const positionStr = await client.get(key);

            if (positionStr) {
                const position: Position = JSON.parse(positionStr);
                let pnl = 0;

                if (position.side === "long") {
                    pnl = (currentPrice - position.entryPrice) * position.quantity;
                } else {
                    pnl = (position.entryPrice - currentPrice) * position.quantity;
                }

                position.unrealizedPnL = pnl;
                // Update percent as well? 
                // Percent = PnL / (Entry * Qty) * 100
                const initialValue = position.entryPrice * position.quantity;
                if (initialValue > 0) {
                    // const percent = (pnl / initialValue) * 100;
                    // position.unrealizedPnLPercent = percent; 
                    // The interface didn't have percent in saving logic originally but DB has it.
                }

                // We don't necessarily need to SAVE the full object back to Redis if we just want to publish PnL
                // But if we want Redis to be authoritative source of "Unrealized PnL" field, we should set it.
                // For speed, maybe just publish. But requirement says "Redis is authoritative for live PnL".
                // So let's update.

                // OPTIMIZATION: HSET specific field if we stored as Hash. 
                // But current implementation stores JSON string. So we must overwrite.
                await this.savePosition(position);

                // Publish to User
                RedisManager.getInstance().publishMessage(`positions:${userId}`, {
                    stream: `positions:${userId}`,
                    data: {
                        e: "POSITION_UPDATE",
                        type: "POSITION_UPDATE",
                        data: position
                    }
                } as any);

                // console.log(`[PnL] Updated ${userId} ${market}: ${pnl}`);
            } else {
                // Cleanup zombie user ID
                await client.sRem(`active_positions:${market}`, userId);
            }
        }
    }
}
