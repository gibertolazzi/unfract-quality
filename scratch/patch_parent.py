import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# Replace <DragDropContext onDragEnd={handleDragEnd}> with <DragDropContext onDragEnd={handleDragEnd}><React.Fragment>
content = content.replace(
    "<DragDropContext onDragEnd={handleDragEnd}>",
    "<DragDropContext onDragEnd={handleDragEnd}>\n          <React.Fragment>"
)

# Replace </DragDropContext> with </React.Fragment></DragDropContext>
content = content.replace(
    "</DragDropContext>",
    "          </React.Fragment>\n          </DragDropContext>"
)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)
