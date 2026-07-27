export const MONTHLY_PROMO_CREDITS = 9;

export const GENERATION_CREDIT_COSTS = {
    text: 1,
    standardImage: 2,
    premiumImage: 5,
    standardPost: 3,
    premiumPost: 6,
} as const;

export const CREDIT_PRODUCTS = [
    {
        id: 'flex-20',
        name: 'Flexible top-up',
        priceGel: 2,
        credits: 20,
        bonusCredits: 0,
    },
    {
        id: 'value-240',
        name: 'Best value',
        priceGel: 20,
        credits: 240,
        bonusCredits: 40,
    },
] as const;
