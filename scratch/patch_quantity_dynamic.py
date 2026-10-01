import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

# Replace the line_items configuration
old_line_items = """      line_items: [
        {
          price: priceId,
        },
      ],"""

new_line_items = """      line_items: [
        {
          price: priceId,
          quantity: quantity || 1, // Calcolato in base al numero di utenti del team
        },
      ],"""

content = content.replace(old_line_items, new_line_items)
content = content.replace("const { priceId, userId, userEmail } = await req.json();", "const { priceId, userId, userEmail, quantity } = await req.json();")

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)

print("Dynamic quantity added")
