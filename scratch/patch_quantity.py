import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

# Remove quantity: 1,
content = content.replace("          quantity: 1,\n", "")

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)

print("Removed quantity parameter")
