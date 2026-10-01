import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

# Trova la chiamata stripe.checkout.sessions.create
old_session = """    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',"""

new_session = """    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      tax_id_collection: {
        enabled: true,
      },"""

content = content.replace(old_session, new_session)

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)

print("Added promo codes and tax id")
