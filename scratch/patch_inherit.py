import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Fix Title input
content = content.replace(
    'className="w-full text-[#1A1A1A] text-3xl font-bold text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2"',
    'className="w-full text-3xl font-bold bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2" style={{ color: "inherit", textAlign: "inherit" }}'
)

# Fix Text textarea
content = content.replace(
    'className="w-full text-gray-600 text-sm text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none"',
    'className="w-full text-sm bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none" style={{ color: "inherit", textAlign: "inherit" }}'
)

# Button input doesn't need to inherit text align but needs color for text
content = content.replace(
    'className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium text-center border-none outline-none focus:ring-2 focus:ring-blue-500 pointer-events-none"',
    'className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium border-none outline-none focus:ring-2 focus:ring-blue-500 pointer-events-none" style={{ color: "inherit" }}'
)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)
