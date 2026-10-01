import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

# Replace test Pro price with Live Pro price
content = content.replace("'price_1UKx564MUA9fNfqqTx5Vhzup'", "'price_1UKxvO68FlpSo6ExsBnWibmH'")

# Replace test Scale price with Live Scale price
content = content.replace("'price_1UKx4U4MUA9fNfqqE7MYmuWw'", "'price_1UKxvT68FlpSo6ExSYeKdA0Z'")

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Live Price IDs updated")
