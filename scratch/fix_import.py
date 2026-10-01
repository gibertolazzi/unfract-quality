import re

with open('components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { UpgradeModal } from '@/components/marketing/UpgradeModal';")

with open('components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Import fixed")
