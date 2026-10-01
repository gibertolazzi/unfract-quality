import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

# Update json parse
content = content.replace("const { priceId, userId, userEmail, quantity } = await req.json();", "const { priceId, userId, userEmail, quantity, planName } = await req.json();")

# Update metadata
old_meta = """      metadata: {
        userId: userId,
      },"""

new_meta = """      metadata: {
        userId: userId,
        planName: planName || 'pro',
      },"""

content = content.replace(old_meta, new_meta)

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)


with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

old_body = """        body: JSON.stringify({
          priceId,
          userId: user?.uid,
          userEmail: user?.email,
        }),"""

new_body = """        body: JSON.stringify({
          priceId,
          userId: user?.uid,
          userEmail: user?.email,
          planName: planName.toLowerCase(),
        }),"""

content = content.replace(old_body, new_body)

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

with open('app/api/stripe/webhook/route.ts', 'r') as f:
    content = f.read()

old_plan = """        const planType = session.amount_total && session.amount_total >= 2500 ? 'scale' : 'pro';"""
new_plan = """        const planType = session.metadata?.planName || 'pro';"""

content = content.replace(old_plan, new_plan)

with open('app/api/stripe/webhook/route.ts', 'w') as f:
    f.write(content)

print("PlanName metadata added")
