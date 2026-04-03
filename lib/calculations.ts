import type { Database } from './database.types';

type Location = Database['public']['Tables']['locations']['Row'];

export interface RentalFinancials {
    gross: number;
    stripeFee: number;
    stripeNet: number;
    salesTax: number;
    distributable: number;
    venueCut: number;
    myProfit: number;
    isLost: boolean;
}

// getEffectiveAmount is now a generated column on the rentals table (effective_amount).
// See migration: 20260403220000_add_effective_amount_generated_column.sql

export function calculateRentalFinancials(
    amountCaptured: number | null,
    location: Location,
    opts?: { isLost?: boolean; dailyCapSnapshot?: number | null }
): RentalFinancials {
    const isLost = opts?.isLost ?? false;
    const dailyCapSnapshot = opts?.dailyCapSnapshot ?? null;

    if (!amountCaptured || amountCaptured === 0) {
        return {
            gross: 0,
            stripeFee: 0,
            stripeNet: 0,
            salesTax: 0,
            distributable: 0,
            venueCut: 0,
            myProfit: 0,
            isLost: false,
        };
    }

    const gross = amountCaptured / 100;
    const stripeFee = gross * 0.027 + 0.05;
    const stripeNet = gross - stripeFee;
    const salesTax = (gross / (1 + location.tax_rate)) * location.tax_rate;
    const distributable = stripeNet - salesTax;

    if (isLost && dailyCapSnapshot !== null && dailyCapSnapshot > 0) {
        const capGross = dailyCapSnapshot / 100;
        const capStripeFee = capGross * 0.027 + 0.05;
        const capStripeNet = capGross - capStripeFee;
        const capSalesTax = (capGross / (1 + location.tax_rate)) * location.tax_rate;
        const capDistributable = capStripeNet - capSalesTax;

        const venueCut = capDistributable * location.venue_split;
        const myProfit = distributable - venueCut;

        return {
            gross,
            stripeFee,
            stripeNet,
            salesTax,
            distributable,
            venueCut,
            myProfit,
            isLost: true,
        };
    }

    const venueCut = distributable * location.venue_split;
    const myProfit = distributable - venueCut;

    return {
        gross,
        stripeFee,
        stripeNet,
        salesTax,
        distributable,
        venueCut,
        myProfit,
        isLost: false,
    };
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}
