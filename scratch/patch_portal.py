import re

with open('components/marketing/UpgradeModal.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import React from 'react';", "import React, { useEffect, useState } from 'react';\nimport { createPortal } from 'react-dom';")

# Wrap the return
old_return = """  return (
    <div className="fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">"""

new_return = """  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">"""

content = content.replace(old_return, new_return)

# Close the portal
old_end = """      </div>
    </div>
  );
}"""

new_end = """      </div>
    </div>,
    document.body
  );
}"""

content = content.replace(old_end, new_end)

with open('components/marketing/UpgradeModal.tsx', 'w') as f:
    f.write(content)

print("Portal patched")
