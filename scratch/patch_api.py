import re

with open('app/api/stripe/create-checkout/route.ts', 'r') as f:
    content = f.read()

content = content.replace("apiVersion: '2024-06-20',", "// apiVersion non specificato per usare la default SDK")
content = content.replace("if (!priceId || !userId) {", "if (!priceId) { return NextResponse.json({ error: 'Manca priceId.' }, { status: 400 }); } if (!userId) { return NextResponse.json({ error: 'Devi effettuare il login per abbonarti.' }, { status: 400 }); }")

with open('app/api/stripe/create-checkout/route.ts', 'w') as f:
    f.write(content)

with open('app/api/stripe/webhook/route.ts', 'r') as f:
    content = f.read()

content = content.replace("apiVersion: '2024-06-20',", "// apiVersion non specificato per usare la default SDK")

with open('app/api/stripe/webhook/route.ts', 'w') as f:
    f.write(content)

print("API routes patched")
