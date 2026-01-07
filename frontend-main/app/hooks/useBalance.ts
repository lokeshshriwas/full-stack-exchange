"use client";

import { useEffect, useState } from "react";
import { getBalances } from "../helper/fetch";
import { User } from "./useUser";

export interface Balance {
    user_id: string;
    asset_id: number;
    available: string;
    locked: string;
    symbol: string;
    decimals: number;
}

export function useBalance(user: User | null, market: string) {
    const [balances, setBalances] = useState<Balance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const [baseAsset, quoteAsset] = market.split("_");

    const fetchBalances = async () => {
        if (!user) {
            setBalances([]);
            setLoading(false);
            return;
        }

        try {
            const response = await getBalances(user.id);
            if (response.data?.balances) {
                setBalances(response.data.balances);
            }
            setError(null);
        } catch (e) {
            console.error("Error fetching balances:", e);
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchBalances();

        // Event-driven balance updates instead of polling
        // Balance changes when: ORDER_PLACED, ORDER_FILL, ORDER_CANCELLED
        if (!user) return;

        const { SignalingManager } = require('../utils/SignalingManager');
        const signalingManager = SignalingManager.getInstance();

        // Wait for authentication before setting up listeners
        const setupBalanceListeners = () => {
            const userId = signalingManager.getAuthenticatedUserId();
            if (!userId) return;

            let reconcileTimeout: NodeJS.Timeout | null = null;

            // Debounced reconciliation with server to account for DB write delay
            const debouncedReconcile = () => {
                if (reconcileTimeout) clearTimeout(reconcileTimeout);
                reconcileTimeout = setTimeout(() => {
                    console.log('[useBalance] Reconciling with server after DB write delay');
                    fetchBalances();
                }, 300); // Wait 300ms for DB writes to complete
            };

            // Optimistically update balance on ORDER_PLACED (funds locked)
            signalingManager.registerCallback(
                'ORDER_PLACED',
                (data: any) => {
                    console.log('[useBalance] ORDER_PLACED - optimistic update', data);
                    const payload = data.payload;

                    // Optimistically update local balance before DB write completes
                    setBalances((prev) => {
                        const updated = [...prev];
                        const side = payload.side;
                        const price = parseFloat(payload.price);
                        const qty = parseFloat(payload.quantity);
                        const executedQty = payload.executedQty || 0;

                        if (side === 'buy') {
                            // Buy order: lock USDC (quote asset)
                            const requiredUsdc = qty * price;
                            const usdcIndex = updated.findIndex(b => b.symbol === quoteAsset);
                            if (usdcIndex !== -1) {
                                const current = updated[usdcIndex];
                                updated[usdcIndex] = {
                                    ...current,
                                    available: (parseFloat(current.available) - requiredUsdc).toFixed(8),
                                    locked: (parseFloat(current.locked) + requiredUsdc).toFixed(8)
                                };
                                console.log(`[useBalance] Optimistic: Locked ${requiredUsdc} ${quoteAsset}`);
                            }
                        } else {
                            // Sell order: lock base asset
                            const baseIndex = updated.findIndex(b => b.symbol === baseAsset);
                            if (baseIndex !== -1) {
                                const current = updated[baseIndex];
                                updated[baseIndex] = {
                                    ...current,
                                    available: (parseFloat(current.available) - qty).toFixed(8),
                                    locked: (parseFloat(current.locked) + qty).toFixed(8)
                                };
                                console.log(`[useBalance] Optimistic: Locked ${qty} ${baseAsset}`);
                            }
                        }

                        return updated;
                    });

                    // Reconcile with server after DB write delay
                    debouncedReconcile();
                },
                `balance-order-placed-${user.id}`
            );

            // Refresh balance on ORDER_FILL (funds transferred)
            signalingManager.registerCallback(
                'ORDER_FILL',
                () => {
                    console.log('[useBalance] ORDER_FILL - refreshing balance');
                    debouncedReconcile();
                },
                `balance-order-fill-${user.id}`
            );

            // Optimistically update balance on ORDER_CANCELLED (funds unlocked)
            signalingManager.registerCallback(
                'ORDER_CANCELLED',
                (data: any) => {
                    console.log('[useBalance] ORDER_CANCELLED - optimistic update', data);
                    const payload = data.payload;

                    // Optimistically unlock funds immediately
                    setBalances((prev) => {
                        const updated = [...prev];
                        const side = payload.side;
                        const price = parseFloat(payload.price);
                        const qty = parseFloat(payload.quantity);
                        const filled = payload.filled || 0;
                        const remainingQty = qty - filled; // Only unlock unfilled portion

                        if (side === 'buy') {
                            // Buy order cancelled: unlock USDC
                            const lockedUsdc = remainingQty * price;
                            const usdcIndex = updated.findIndex(b => b.symbol === quoteAsset);
                            if (usdcIndex !== -1) {
                                const current = updated[usdcIndex];
                                updated[usdcIndex] = {
                                    ...current,
                                    available: (parseFloat(current.available) + lockedUsdc).toFixed(8),
                                    locked: (parseFloat(current.locked) - lockedUsdc).toFixed(8)
                                };
                                console.log(`[useBalance] Optimistic: Unlocked ${lockedUsdc} ${quoteAsset}`);
                            }
                        } else {
                            // Sell order cancelled: unlock base asset
                            const baseIndex = updated.findIndex(b => b.symbol === baseAsset);
                            if (baseIndex !== -1) {
                                const current = updated[baseIndex];
                                updated[baseIndex] = {
                                    ...current,
                                    available: (parseFloat(current.available) + remainingQty).toFixed(8),
                                    locked: (parseFloat(current.locked) - remainingQty).toFixed(8)
                                };
                                console.log(`[useBalance] Optimistic: Unlocked ${remainingQty} ${baseAsset}`);
                            }
                        }

                        return updated;
                    });

                    // Reconcile with server after DB write delay
                    debouncedReconcile();
                },
                `balance-order-cancelled-${user.id}`
            );

            console.log('[useBalance] Event-driven balance listeners set up for user:', userId);
        };

        // Set up listeners if already authenticated, or wait for auth
        if (signalingManager.isAuthenticated()) {
            setupBalanceListeners();
        } else {
            signalingManager.registerCallback(
                'auth_success',
                setupBalanceListeners,
                `balance-auth-${user.id}`
            );
        }

        // Cleanup on unmount
        return () => {
            signalingManager.deRegisterCallback('ORDER_PLACED', `balance-order-placed-${user.id}`);
            signalingManager.deRegisterCallback('ORDER_FILL', `balance-order-fill-${user.id}`);
            signalingManager.deRegisterCallback('ORDER_CANCELLED', `balance-order-cancelled-${user.id}`);
            signalingManager.deRegisterCallback('auth_success', `balance-auth-${user.id}`);
            console.log('[useBalance] Cleaned up balance listeners');
        };
    }, [user?.id, market]);

    // Helper function to get balance for a specific asset
    const getBalanceForAsset = (symbol: string): Balance | null => {
        return balances.find(b => b.symbol === symbol) || null;
    };

    // Get formatted balance string
    const getFormattedBalance = (symbol: string): string => {
        const balance = getBalanceForAsset(symbol);
        if (!balance) return "0.00";
        return parseFloat(balance.available).toFixed(2);
    };

    return {
        balances,
        loading,
        error,
        getBalanceForAsset,  // Expose this for validation
        getFormattedBalance,
        refresh: fetchBalances,
        baseAsset,
        quoteAsset
    };
}
