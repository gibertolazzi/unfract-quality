const fs = require('fs');

let content = fs.readFileSync('components/marketing/EmailEditorView.tsx', 'utf-8');

// 1. Import DragDropContext etc
content = content.replace(
  "import { useToast } from '@/contexts/ToastContext';",
  "import { useToast } from '@/contexts/ToastContext';\nimport { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';"
);

// 2. Add handleDragEnd function
const dragEndFunc = `
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    
    if (source.droppableId === 'blocks-sidebar' && destination.droppableId === 'canvas') {
      const type = result.draggableId;
      const newBlock = { id: Math.random().toString(), type, content: getDefaultContent(type) };
      const newBlocks = Array.from(blocks);
      newBlocks.splice(destination.index, 0, newBlock);
      setBlocks(newBlocks);
    } else if (source.droppableId === 'canvas' && destination.droppableId === 'canvas') {
      const newBlocks = Array.from(blocks);
      const [reorderedItem] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, reorderedItem);
      setBlocks(newBlocks);
    }
  };
`;

content = content.replace(
  "  const handleSaveAndExit = async () => {",
  dragEndFunc + "\n  const handleSaveAndExit = async () => {"
);

// 3. Wrap with DragDropContext
content = content.replace(
  "{editorType === 'dnd' && (",
  "{editorType === 'dnd' && (\n          <DragDropContext onDragEnd={handleDragEnd}>"
);

content = content.replace(
  "          </>\n        )}",
  "          </DragDropContext>\n        )}"
);

// 4. Update sidebar Droppable
const oldBlocksSidebar = `
                      <div className="grid grid-cols-2 gap-3">
                        {BLOCKS.map(block => (
                          <div 
                            key={block.id}
                            onClick={() => addBlock(block.id)}
                            className="aspect-square bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#1A1A1A] transition-all group"
                          >
                            <div className="text-[#858585] group-hover:text-[#0D6EFD] transition-colors">
                              <block.icon size={28} strokeWidth={1.5} />
                            </div>
                            <span className="text-[11px] font-medium text-[#858585] group-hover:text-white">{block.label}</span>
                          </div>
                        ))}
                      </div>
`;

const newBlocksSidebar = `
                      <Droppable droppableId="blocks-sidebar" isDropDisabled={true}>
                        {(provided) => (
                          <div 
                            className="grid grid-cols-2 gap-3"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {BLOCKS.map((block, index) => (
                              <Draggable key={block.id} draggableId={block.id} index={index}>
                                {(provided, snapshot) => (
                                  <React.Fragment>
                                    <div 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="aspect-square bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-grab hover:bg-[#1A1A1A] transition-all group"
                                      style={{...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.5 : 1}}
                                    >
                                      <div className="text-[#858585] group-hover:text-[#0D6EFD] transition-colors">
                                        <block.icon size={28} strokeWidth={1.5} />
                                      </div>
                                      <span className="text-[11px] font-medium text-[#858585] group-hover:text-white">{block.label}</span>
                                    </div>
                                    {snapshot.isDragging && (
                                      <div className="aspect-square bg-[#141414] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-50">
                                        <div className="text-[#858585]">
                                          <block.icon size={28} strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[11px] font-medium text-[#858585]">{block.label}</span>
                                      </div>
                                    )}
                                  </React.Fragment>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
`;

content = content.replace(oldBlocksSidebar, newBlocksSidebar);

// 5. Update canvas Droppable
const oldCanvas = `
              <div className="w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4">
                {blocks.map(block => (
                  <div key={block.id} className="relative group border-2 border-transparent hover:border-blue-300 rounded p-2 transition-colors">
                    <button onClick={() => removeBlock(block.id)} className="absolute -right-2 -top-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Trash2 size={12} />
                    </button>
                    {block.type === 'title' && (
                      <input 
                        value={block.content} 
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        className="w-full text-[#1A1A1A] text-3xl font-bold text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2"
                      />
                    )}
                    {block.type === 'text' && (
                      <textarea 
                        value={block.content} 
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        className="w-full text-gray-600 text-sm text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none"
                      />
                    )}
                    {block.type === 'image' && (
                      <div className="flex flex-col items-center gap-2">
                        <img src={block.content} className="max-w-full rounded-lg shadow-sm" alt="Blocco immagine" />
                        <input 
                          value={block.content} 
                          onChange={(e) => updateBlock(block.id, e.target.value)}
                          placeholder="URL Immagine"
                          className="w-full text-xs p-2 border border-gray-200 rounded text-black opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 left-0 bg-white/90 backdrop-blur"
                        />
                      </div>
                    )}
                    {block.type === 'button' && (
                      <div className="flex justify-center">
                        <input 
                          value={block.content} 
                          onChange={(e) => updateBlock(block.id, e.target.value)}
                          className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium text-center border-none outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    {block.type === 'divider' && (
                      <hr className="border-t border-gray-200 my-4 w-full" />
                    )}
                  </div>
                ))}
              </div>
`;

const newCanvas = `
              <Droppable droppableId="canvas">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={\`w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4 \${snapshot.isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}\`}
                  >
                    {blocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={\`relative group border-2 border-transparent hover:border-blue-300 rounded p-2 transition-colors bg-white \${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}\`}
                          >
                            <button onClick={() => removeBlock(block.id)} className="absolute -right-2 -top-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Trash2 size={12} />
                            </button>
                            {block.type === 'title' && (
                              <input 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-[#1A1A1A] text-3xl font-bold text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2"
                              />
                            )}
                            {block.type === 'text' && (
                              <textarea 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-gray-600 text-sm text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none"
                              />
                            )}
                            {block.type === 'image' && (
                              <div className="flex flex-col items-center gap-2">
                                <img src={block.content} className="max-w-full rounded-lg shadow-sm" alt="Blocco immagine" />
                                <input 
                                  value={block.content} 
                                  onChange={(e) => updateBlock(block.id, e.target.value)}
                                  placeholder="URL Immagine"
                                  className="w-full text-xs p-2 border border-gray-200 rounded text-black opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 left-0 bg-white/90 backdrop-blur"
                                />
                              </div>
                            )}
                            {block.type === 'button' && (
                              <div className="flex justify-center">
                                <input 
                                  value={block.content} 
                                  onChange={(e) => updateBlock(block.id, e.target.value)}
                                  className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium text-center border-none outline-none focus:ring-2 focus:ring-blue-500 pointer-events-none"
                                />
                              </div>
                            )}
                            {block.type === 'divider' && (
                              <hr className="border-t border-gray-200 my-4 w-full" />
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
`;

content = content.replace(oldCanvas, newCanvas);

fs.writeFileSync('components/marketing/EmailEditorView.tsx', content);
console.log('Patched');
