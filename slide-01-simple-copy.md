# Slide 01 — Compare Tata stocks vs NIFTY 50 (simple version)

## Headline
**How far ahead or behind is each Tata stock?**

## The idea, plainly
Tata stocks trade at very different prices — some are a few hundred rupees, others are ₹4,000+. You can't line them up on one ruler when the numbers are that far apart.

So we squeeze them onto the same scale using the **log of each price** (ln(price)). This turns a big price into a small, comparable number.

Then we find the **market's number** — the average log price of NIFTY 50 — and subtract it from each stock. What's left is the **gap**: how far that stock sits from the market.

- **Plus** = ahead of the market
- **Minus** = behind the market

## The rule (3 steps)
1. **Change the price** → ln(price): turns a big price into a comparable number.
2. **Market number** → average of log prices: one number for NIFTY 50.
3. **Find the gap** → stock − group: how far one stock sits from the market.

## Worked example (TCS)
| | |
|---|---|
| Price | ₹4,200 |
| Log price | 8.34 |
| Market (NIFTY 50) | 8.00 |
| Gap | 8.34 − 8.00 = **+0.34** |

TCS is 0.34 ahead of NIFTY 50.

## Why this matters (leads into the next slide)
Once every stock is just a "gap" number, we can spot which Tata stocks are unusually far ahead — or unusually far behind — the market. That's what the next slide looks at.
