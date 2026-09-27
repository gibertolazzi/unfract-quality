import sys

with open('components/marketing/CampaignSetupView.tsx', 'r') as f:
    content = f.read()

with open('scratch/advancedModal.tsx', 'r') as f:
    modal = f.read()

# Replace the last occurence of '    </div>\n  );\n}'
end_str = "    </div>\n  );\n}"
idx = content.rfind(end_str)
if idx != -1:
    new_content = content[:idx] + modal + "\n" + content[idx:]
    with open('components/marketing/CampaignSetupView.tsx', 'w') as f:
        f.write(new_content)
else:
    print("Not found")
