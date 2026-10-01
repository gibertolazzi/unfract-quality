import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

# Replace old Pro price
content = content.replace("'price_1UKwHW4MUA9fNfqqh4p1RJcS'", "'price_1UKx564MUA9fNfqqTx5Vhzup'")

# Replace old Scale price
content = content.replace("'price_1UKwKR4MUA9fNfqqdFw8uxTi'", "'price_1UKx4U4MUA9fNfqqE7MYmuWw'")

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Price IDs updated")
