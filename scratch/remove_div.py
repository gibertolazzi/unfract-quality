import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# We need to remove the extra </div> right before:
#             <div className="flex-1 bg-[#050505] overflow-y-auto relative py-12 px-4 flex justify-center items-start"

# Let's find exactly this piece:
bad_code = """                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 bg-[#050505] overflow-y-auto relative py-12 px-4 flex justify-center items-start\""""

good_code = """                    </div>
                  )}
                </div>
              )}

            <div className="flex-1 bg-[#050505] overflow-y-auto relative py-12 px-4 flex justify-center items-start\""""

content = content.replace(bad_code, good_code)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)
