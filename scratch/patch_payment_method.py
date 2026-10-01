import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

# Remove payment_method_types: ['card'],
content = content.replace("      payment_method_types: ['card'],\n", "")

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)

print("Removed payment_method_types parameter")
